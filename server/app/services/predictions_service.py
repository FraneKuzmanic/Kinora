import uuid
from datetime import UTC, datetime, timedelta
from math import exp, log1p
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admission import Admission, AdmissionStatus
from app.models.cinema import CinemaHall, CinemaLocation
from app.models.screening import Screening, ScreeningStatus
from app.schemas.ml import AttendancePredictionResponse, ScreeningPredictionRead


_VALID_TICKET_STATUSES = [AdmissionStatus.pending_outcome, AdmissionStatus.active, AdmissionStatus.used]
_HISTORICAL_TICKET_STATUSES = [
    "pending_outcome",
    "active",
    "used",
    "lost_refund_pending",
    "lost_no_refund",
    "refunded",
]

_WEEKEND_DAYS = {4, 5, 6}  # Fri=4, Sat=5, Sun=6
_DEFAULT_FILL_RATE = 0.35


async def predict_screening_success(
    session: AsyncSession,
    screening_id: uuid.UUID,
) -> ScreeningPredictionRead:
    """
    Heuristic confirmation-probability prediction for an active (selling/pending) screening.
    Based on current ticket pace and days remaining to the decision deadline.
    """
    result = await session.execute(
        select(
            Screening,
            CinemaHall.capacity.label("hall_capacity"),
        )
        .join(CinemaHall, CinemaHall.id == Screening.hall_id)
        .where(Screening.id == screening_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Screening not found")

    screening: Screening = row[0]
    hall_capacity: int = row[1]

    if screening.status not in {ScreeningStatus.selling, ScreeningStatus.pending}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Prediction only available for screenings in selling or pending status",
        )

    tickets_sold = await _count_tickets(session, screening)

    now = datetime.now(UTC)
    decision_date = screening.starts_at - timedelta(days=screening.decision_days_before_start)

    if screening.status == ScreeningStatus.pending and screening.pending_expires_at:
        decision_date = screening.pending_expires_at

    hours_left = max((decision_date - now).total_seconds() / 3600, 0.0)
    hours_elapsed = max((now - _as_utc(screening.created_at)).total_seconds() / 3600, 6.0)
    total_window_hours = max(hours_elapsed + hours_left, 6.0)

    prior_fill, prior_samples = await _historical_fill_rate(session, screening, hall_capacity)
    prior_expected_tickets = prior_fill * hall_capacity
    prior_rate = prior_expected_tickets / total_window_hours
    observed_rate = tickets_sold / hours_elapsed

    observation_weight = hours_elapsed / (hours_elapsed + 72.0)
    blended_rate = (observation_weight * observed_rate) + ((1 - observation_weight) * prior_rate)
    projected = int(round(tickets_sold + blended_rate * hours_left))
    projected = min(projected, hall_capacity)

    threshold = screening.min_tickets_to_confirm
    if threshold <= 0:
        prob = 1.0
        current_progress = 1.0
        projected_progress = 1.0
    else:
        current_progress = min(tickets_sold / threshold, 1.0)
        projected_progress = min(projected / threshold, 1.5)
        if tickets_sold >= threshold:
            prob = 0.98
        else:
            uncertainty = max(4.0, threshold * (0.35 + (1 - observation_weight) * 0.65))
            prob = _sigmoid((projected - threshold) / uncertainty)
            prob = _clamp(prob, 0.05, 0.95)

    risk_band = _risk_band(prob)
    confidence = _prediction_confidence(hours_elapsed, tickets_sold, prior_samples)
    tickets_remaining = max(threshold - tickets_sold, 0)
    label = f"{int(round(prob * 100))}% likely to confirm"
    if tickets_remaining:
        label = f"{label} - {tickets_remaining} more needed"

    return ScreeningPredictionRead(
        probability_of_confirmation=round(prob, 3),
        risk_band=risk_band,
        projected_tickets_at_decision=projected,
        tickets_sold=tickets_sold,
        tickets_remaining=tickets_remaining,
        current_progress=round(current_progress, 3),
        projected_progress=round(projected_progress, 3),
        confidence=confidence,
        label=label,
    )


async def predict_attendance(
    session: AsyncSession,
    hall_id: uuid.UUID,
    tmdb_popularity: float,
    starts_at: datetime,
    cinema_id: uuid.UUID,
    movie_id: uuid.UUID | None = None,
) -> AttendancePredictionResponse:
    """
    What-If attendance prediction for a cinema admin planning a new screening.
    Validates the hall belongs to the cinema, then applies heuristic multipliers.
    """
    hall_result = await session.execute(
        select(CinemaHall)
        .join(CinemaLocation, CinemaLocation.id == CinemaHall.location_id)
        .where(
            CinemaHall.id == hall_id,
            CinemaLocation.cinema_id == cinema_id,
        )
    )
    hall = hall_result.scalar_one_or_none()
    if not hall:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hall not found or does not belong to your cinema",
        )

    prior_fill, _ = await _historical_fill_rate_for_slot(
        session=session,
        cinema_id=cinema_id,
        hall_capacity=hall.capacity,
        starts_at=starts_at,
        movie_id=movie_id,
    )
    popularity_signal = _normalized_popularity(tmdb_popularity)
    popularity_factor = 0.75 + (0.5 * popularity_signal)
    predicted = int(round(hall.capacity * prior_fill * popularity_factor))
    predicted = min(predicted, hall.capacity)

    fill_rate = predicted / hall.capacity if hall.capacity > 0 else 0.0
    suggested_threshold = max(int(predicted * 0.60), 1)
    risk_band = _risk_band(fill_rate)

    dow = starts_at.weekday()
    hour = starts_at.hour
    best_slot_hint = _best_slot_hint(dow, hour)

    return AttendancePredictionResponse(
        predicted_attendance=predicted,
        predicted_fill_rate=round(fill_rate, 3),
        suggested_threshold=suggested_threshold,
        risk_band=risk_band,
        best_slot_hint=best_slot_hint,
    )


async def _count_tickets(session: AsyncSession, screening: Screening) -> int:
    result = await session.execute(
        select(func.sum(Admission.quantity))
        .where(
            Admission.screening_id == screening.id,
            Admission.status.in_(_VALID_TICKET_STATUSES),
        )
    )
    return int(result.scalar() or 0)


def _risk_band(probability: float) -> Literal["green", "yellow", "red"]:
    if probability >= 0.70:
        return "green"
    if probability >= 0.40:
        return "yellow"
    return "red"


async def _historical_fill_rate(
    session: AsyncSession,
    screening: Screening,
    hall_capacity: int,
) -> tuple[float, int]:
    return await _historical_fill_rate_for_slot(
        session=session,
        cinema_id=screening.cinema_id,
        hall_capacity=hall_capacity,
        starts_at=screening.starts_at,
        movie_id=screening.movie_id,
        exclude_screening_id=screening.id,
    )


async def _historical_fill_rate_for_slot(
    session: AsyncSession,
    cinema_id: uuid.UUID,
    hall_capacity: int,
    starts_at: datetime,
    movie_id: uuid.UUID | None = None,
    exclude_screening_id: uuid.UUID | None = None,
) -> tuple[float, int]:
    dow = starts_at.weekday()
    hour_bucket = (starts_at.hour // 6) * 6
    exclude_clause = "AND s.id <> :exclude_screening_id" if exclude_screening_id else ""

    rows = await session.execute(
        text(
            "WITH ticket_counts AS ("
            "  SELECT s.id, s.starts_at, h.capacity, "
            "         COALESCE(SUM(CASE WHEN a.status::text = ANY(:ticket_statuses) "
            "             THEN a.quantity ELSE 0 END), 0)::float AS tickets "
            "  FROM public.screenings s "
            "  JOIN public.cinema_halls h ON h.id = s.hall_id "
            "  LEFT JOIN public.admissions a ON a.screening_id = s.id "
            "  WHERE s.cinema_id = :cinema_id "
            f"    {exclude_clause} "
            "    AND s.status IN ('confirmed', 'cancelled') "
            "  GROUP BY s.id, s.starts_at, h.capacity"
            ") "
            "SELECT "
            "  COUNT(*) AS overall_count, "
            "  AVG(tickets / NULLIF(capacity, 0)) AS overall_fill, "
            "  COUNT(*) FILTER (WHERE (EXTRACT(ISODOW FROM starts_at)::int - 1) = :dow "
            "    AND (FLOOR(EXTRACT(HOUR FROM starts_at) / 6) * 6)::int = :hour_bucket) AS slot_count, "
            "  AVG(tickets / NULLIF(capacity, 0)) FILTER (WHERE "
            "    (EXTRACT(ISODOW FROM starts_at)::int - 1) = :dow "
            "    AND (FLOOR(EXTRACT(HOUR FROM starts_at) / 6) * 6)::int = :hour_bucket"
            "  ) AS slot_fill "
            "FROM ticket_counts"
        ),
        {
            "cinema_id": cinema_id,
            "exclude_screening_id": exclude_screening_id,
            "ticket_statuses": _HISTORICAL_TICKET_STATUSES,
            "dow": dow,
            "hour_bucket": hour_bucket,
        },
    )
    row = rows.first()
    overall_count = int(row.overall_count or 0) if row else 0
    slot_count = int(row.slot_count or 0) if row else 0
    overall_fill = _smooth_fill(row.overall_fill if row else None, overall_count, _DEFAULT_FILL_RATE, 6)
    slot_fill = _smooth_fill(row.slot_fill if row else None, slot_count, overall_fill, 4)

    genre_fill = overall_fill
    genre_count = 0
    genre_ids = await _movie_genre_ids(session, movie_id) if movie_id else []
    if genre_ids:
        genre_rows = await session.execute(
            text(
                "WITH ticket_counts AS ("
                "  SELECT s.id, h.capacity, "
                "         COALESCE(SUM(CASE WHEN a.status::text = ANY(:ticket_statuses) "
                "             THEN a.quantity ELSE 0 END), 0)::float AS tickets "
                "  FROM public.screenings s "
                "  JOIN public.cinema_halls h ON h.id = s.hall_id "
                "  LEFT JOIN public.admissions a ON a.screening_id = s.id "
                "  JOIN public.movie_genres mg ON mg.movie_id = s.movie_id "
                "  WHERE s.cinema_id = :cinema_id "
                f"    {exclude_clause} "
                "    AND s.status IN ('confirmed', 'cancelled') "
                "    AND mg.genre_id = ANY(:genre_ids) "
                "  GROUP BY s.id, h.capacity"
                ") "
                "SELECT COUNT(*) AS genre_count, "
                "       AVG(tickets / NULLIF(capacity, 0)) AS genre_fill "
                "FROM ticket_counts"
            ),
            {
                "cinema_id": cinema_id,
                "exclude_screening_id": exclude_screening_id,
                "ticket_statuses": _HISTORICAL_TICKET_STATUSES,
                "genre_ids": genre_ids,
            },
        )
        genre_row = genre_rows.first()
        genre_count = int(genre_row.genre_count or 0) if genre_row else 0
        genre_fill = _smooth_fill(genre_row.genre_fill if genre_row else None, genre_count, overall_fill, 4)

    weighted_fill = (0.45 * slot_fill) + (0.35 * genre_fill) + (0.20 * overall_fill)
    weighted_fill = _clamp(weighted_fill, 0.08, 0.95)
    return weighted_fill, overall_count + slot_count + genre_count


async def _movie_genre_ids(session: AsyncSession, movie_id: uuid.UUID | None) -> list[uuid.UUID]:
    if not movie_id:
        return []
    rows = await session.execute(
        text("SELECT genre_id FROM public.movie_genres WHERE movie_id = :movie_id"),
        {"movie_id": movie_id},
    )
    return [row.genre_id for row in rows]


def _smooth_fill(value: object, count: int, prior: float, prior_weight: int) -> float:
    if value is None or count <= 0:
        return prior
    return ((float(value) * count) + (prior * prior_weight)) / (count + prior_weight)


def _prediction_confidence(
    hours_elapsed: float,
    tickets_sold: int,
    prior_samples: int,
) -> Literal["low", "medium", "high"]:
    evidence = (hours_elapsed / 24.0) + tickets_sold + min(prior_samples, 20) / 2
    if evidence >= 18:
        return "high"
    if evidence >= 7:
        return "medium"
    return "low"


def _normalized_popularity(popularity: float) -> float:
    return _clamp(log1p(max(popularity, 0.0)) / log1p(300.0), 0.0, 1.0)


def _sigmoid(value: float) -> float:
    if value >= 20:
        return 1.0
    if value <= -20:
        return 0.0
    return 1 / (1 + exp(-value))


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(value, maximum))


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _best_slot_hint(dow: int, hour: int) -> str:
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    day_name = day_names[dow]
    if dow not in _WEEKEND_DAYS and hour < 18:
        return "Consider Friday–Sunday or evening slots for better attendance"
    if dow in _WEEKEND_DAYS and 18 <= hour < 21:
        return f"{day_name} evening is a strong slot"
    if dow in _WEEKEND_DAYS:
        return f"{day_name} is a strong day — evening slot (18–21h) would boost attendance further"
    return "Evening slot (18–21h) on a weekend would maximize attendance"
