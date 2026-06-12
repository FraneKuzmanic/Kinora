import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admission import Admission, AdmissionStatus, AdmissionType
from app.models.campaign import Campaign, CampaignMovie, CampaignStatus, CampaignVote
from app.models.cinema import CinemaHall
from app.models.movie import Movie
from app.models.movie_recommendation import MovieRecommendation
from app.models.screening import Screening, ScreeningStatus
from app.schemas.analytics import (
    CampaignFunnelItem,
    CampaignFunnelRead,
    ContentDemandRead,
    FilmDemandItem,
    GenreTrendItem,
    RevenueMetricsRead,
    ScreeningHealthRead,
    SlotCell,
    SlotPerformanceRead,
    SlotSummary,
)
from app.services.predictions_service import predict_screening_success


_ACTIVE_STATUSES = [AdmissionStatus.pending_outcome, AdmissionStatus.active, AdmissionStatus.used]
_DOW_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
_HOUR_LABELS = {0: "0–6h", 6: "6–12h", 12: "12–18h", 18: "18–24h"}


async def get_campaign_funnel(
    session: AsyncSession,
    cinema_id: uuid.UUID,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> CampaignFunnelRead:
    """Campaign funnel: views → votes → reservations per campaign and totals."""
    q = select(Campaign).where(
        Campaign.cinema_id == cinema_id,
        Campaign.status.in_([CampaignStatus.voting, CampaignStatus.resolved]),
    )
    if start_date:
        q = q.where(Campaign.created_at >= start_date)
    if end_date:
        q = q.where(Campaign.created_at <= end_date)

    campaign_rows = (await session.execute(q)).scalars().all()
    if not campaign_rows:
        return CampaignFunnelRead(
            total_views=0, total_votes=0, total_reservations=0,
            view_to_vote_rate=0.0, vote_to_reservation_rate=0.0, campaigns=[],
        )

    campaign_ids = [c.id for c in campaign_rows]

    view_rows = await session.execute(
        text(
            "SELECT campaign_id, COUNT(*) AS cnt "
            "FROM public.campaign_views "
            "WHERE campaign_id = ANY(:ids) "
            "GROUP BY campaign_id"
        ),
        {"ids": campaign_ids},
    )
    views_map: dict[uuid.UUID, int] = {row.campaign_id: row.cnt for row in view_rows}

    vote_rows = await session.execute(
        select(CampaignVote.campaign_id, func.count(CampaignVote.id).label("cnt"))
        .where(CampaignVote.campaign_id.in_(campaign_ids))
        .group_by(CampaignVote.campaign_id)
    )
    votes_map: dict[uuid.UUID, int] = {row.campaign_id: row.cnt for row in vote_rows}

    res_rows = await session.execute(
        select(CampaignMovie.campaign_id, func.sum(Admission.quantity).label("cnt"))
        .join(Admission, Admission.campaign_movie_id == CampaignMovie.id)
        .where(
            CampaignMovie.campaign_id.in_(campaign_ids),
            Admission.type == AdmissionType.campaign_earlybird,
            Admission.status.in_(_ACTIVE_STATUSES),
        )
        .group_by(CampaignMovie.campaign_id)
    )
    res_map: dict[uuid.UUID, int] = {row.campaign_id: int(row.cnt or 0) for row in res_rows}

    items: list[CampaignFunnelItem] = []
    for c in campaign_rows:
        v = int(views_map.get(c.id, 0))
        vt = int(votes_map.get(c.id, 0))
        r = int(res_map.get(c.id, 0))
        items.append(
            CampaignFunnelItem(
                campaign_id=str(c.id),
                campaign_title=c.title,
                views=v,
                votes=vt,
                reservations=r,
                threshold=c.min_tickets_to_confirm,
                view_to_vote_rate=round(vt / v, 3) if v > 0 else 0.0,
                vote_to_reservation_rate=round(r / vt, 3) if vt > 0 else 0.0,
            )
        )

    total_v = sum(i.views for i in items)
    total_vt = sum(i.votes for i in items)
    total_r = sum(i.reservations for i in items)

    return CampaignFunnelRead(
        total_views=total_v,
        total_votes=total_vt,
        total_reservations=total_r,
        view_to_vote_rate=round(total_vt / total_v, 3) if total_v > 0 else 0.0,
        vote_to_reservation_rate=round(total_r / total_vt, 3) if total_vt > 0 else 0.0,
        campaigns=items,
    )


async def get_screening_health(
    session: AsyncSession,
    cinema_id: uuid.UUID,
) -> list[ScreeningHealthRead]:
    """Active screenings with ticket progress and AI risk assessment."""
    result = await session.execute(
        select(Screening, CinemaHall.capacity, Movie.title)
        .join(CinemaHall, CinemaHall.id == Screening.hall_id)
        .join(Movie, Movie.id == Screening.movie_id)
        .where(
            Screening.cinema_id == cinema_id,
            Screening.status.in_([ScreeningStatus.selling, ScreeningStatus.pending]),
        )
        .order_by(Screening.starts_at.asc())
    )
    rows = result.all()

    tickets_result = await session.execute(
        select(Admission.screening_id, func.sum(Admission.quantity).label("total"))
        .where(
            Admission.screening_id.in_([row[0].id for row in rows]),
            Admission.status.in_(_ACTIVE_STATUSES),
        )
        .group_by(Admission.screening_id)
    )
    ticket_map: dict[uuid.UUID, int] = {row.screening_id: int(row.total or 0) for row in tickets_result}

    now = datetime.now(UTC)
    health_items: list[ScreeningHealthRead] = []
    for row in rows:
        s: Screening = row[0]
        tickets_sold = ticket_map.get(s.id, 0)
        decision_date = s.starts_at - timedelta(days=s.decision_days_before_start)
        if s.status == ScreeningStatus.pending and s.pending_expires_at:
            decision_date = s.pending_expires_at
        days_left = max((decision_date - now).days, 0)

        try:
            pred = await predict_screening_success(session, s.id)
            prob = pred.probability_of_confirmation
            risk_band = pred.risk_band
        except Exception:
            threshold = s.min_tickets_to_confirm
            prob = min(tickets_sold / threshold, 1.0) if threshold > 0 else 1.0
            risk_band = "green" if prob >= 0.7 else ("yellow" if prob >= 0.4 else "red")

        health_items.append(
            ScreeningHealthRead(
                screening_id=str(s.id),
                title=row[2],
                starts_at=s.starts_at.isoformat(),
                tickets_sold=tickets_sold,
                min_tickets_to_confirm=s.min_tickets_to_confirm,
                days_left=days_left,
                projected_likelihood=round(prob, 3),
                risk_band=risk_band,
                at_risk=(risk_band == "red"),
            )
        )

    return health_items


async def get_slot_performance(
    session: AsyncSession,
    cinema_id: uuid.UUID,
) -> SlotPerformanceRead:
    """Aggregated fill rates by weekday × time bucket for confirmed screenings."""
    rows = await session.execute(
        text(
            "SELECT "
            "  EXTRACT(DOW FROM s.starts_at AT TIME ZONE 'UTC')::int AS dow, "
            "  (FLOOR(EXTRACT(HOUR FROM s.starts_at AT TIME ZONE 'UTC') / 6) * 6)::int AS hour_bucket, "
            "  COALESCE(SUM(a.quantity), 0)::float / NULLIF(h.capacity, 0) AS fill_rate, "
            "  s.id AS screening_id "
            "FROM public.screenings s "
            "JOIN public.cinema_halls h ON h.id = s.hall_id "
            "LEFT JOIN public.admissions a ON a.screening_id = s.id "
            "  AND a.status IN ('active', 'used') "
            "WHERE s.cinema_id = :cid AND s.status = 'confirmed' "
            "GROUP BY s.id, dow, hour_bucket, h.capacity"
        ),
        {"cid": cinema_id},
    )

    from collections import defaultdict
    slot_data: dict[tuple[int, int], list[float]] = defaultdict(list)
    for row in rows:
        dow = int(row.dow)
        hb = int(row.hour_bucket)
        fill = float(row.fill_rate or 0.0)
        slot_data[(dow, hb)].append(fill)

    cells: list[SlotCell] = []
    for (dow, hb), fills in sorted(slot_data.items()):
        cells.append(SlotCell(
            dow=dow,
            hour_bucket=hb,
            avg_fill_rate=round(sum(fills) / len(fills), 3),
            screening_count=len(fills),
        ))

    cells.sort(key=lambda c: c.avg_fill_rate, reverse=True)
    best = [_slot_summary(c) for c in cells[:3]]
    worst = [_slot_summary(c) for c in cells[-3:] if c.avg_fill_rate < 0.5]

    return SlotPerformanceRead(cells=cells, best_slots=best, worst_slots=worst)


async def get_content_demand(
    session: AsyncSession,
    cinema_id: uuid.UUID,
) -> ContentDemandRead:
    """Most voted films, most recommended films, genre trends."""
    vote_rows = await session.execute(
        select(
            Movie.id,
            Movie.title,
            func.count(CampaignVote.id).label("vote_count"),
        )
        .join(CampaignMovie, CampaignMovie.movie_id == Movie.id)
        .join(Campaign, Campaign.id == CampaignMovie.campaign_id)
        .join(CampaignVote, CampaignVote.campaign_movie_id == CampaignMovie.id)
        .where(Campaign.cinema_id == cinema_id)
        .group_by(Movie.id, Movie.title)
        .order_by(func.count(CampaignVote.id).desc())
        .limit(10)
    )
    vote_list = list(vote_rows)

    confirmed_movie_ids = set()
    conf_rows = await session.execute(
        select(Screening.movie_id).where(
            Screening.cinema_id == cinema_id,
            Screening.status == ScreeningStatus.confirmed,
        )
    )
    for row in conf_rows:
        confirmed_movie_ids.add(row.movie_id)

    most_voted = [
        FilmDemandItem(
            movie_id=str(row.id),
            title=row.title,
            vote_count=row.vote_count,
            recommendation_count=0,
            has_screening=row.id in confirmed_movie_ids,
        )
        for row in vote_list
    ]

    rec_rows = await session.execute(
        select(
            MovieRecommendation.movie_id,
            MovieRecommendation.title,
            func.count(MovieRecommendation.id).label("rec_count"),
        )
        .where(MovieRecommendation.cinema_id == cinema_id)
        .group_by(MovieRecommendation.movie_id, MovieRecommendation.title)
        .order_by(func.count(MovieRecommendation.id).desc())
        .limit(10)
    )
    most_recommended = [
        FilmDemandItem(
            movie_id=str(row.movie_id) if row.movie_id else None,
            title=row.title or "Unknown",
            vote_count=0,
            recommendation_count=row.rec_count,
            has_screening=(row.movie_id in confirmed_movie_ids) if row.movie_id else False,
        )
        for row in rec_rows
    ]

    repeated_demand_no_screening = [
        item for item in most_recommended
        if not item.has_screening and item.recommendation_count >= 2
    ]

    genre_rows = await session.execute(
        text(
            "SELECT lower(gen.name) AS genre_name, COUNT(*) AS cnt "
            "FROM public.campaign_votes cv "
            "JOIN public.campaign_movies cm ON cm.id = cv.campaign_movie_id "
            "JOIN public.campaigns c ON c.id = cm.campaign_id AND c.cinema_id = :cid "
            "JOIN public.movie_genres mg ON mg.movie_id = cm.movie_id "
            "JOIN public.genres gen ON gen.id = mg.genre_id "
            "GROUP BY lower(gen.name) "
            "ORDER BY cnt DESC "
            "LIMIT 10"
        ),
        {"cid": cinema_id},
    )
    genre_trends = [
        GenreTrendItem(genre_name=row.genre_name, interaction_count=int(row.cnt))
        for row in genre_rows
    ]

    return ContentDemandRead(
        most_voted=most_voted,
        most_recommended=most_recommended,
        repeated_demand_no_screening=repeated_demand_no_screening,
        genre_trends=genre_trends,
    )


async def get_revenue_metrics(
    session: AsyncSession,
    cinema_id: uuid.UUID,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> RevenueMetricsRead:
    """Confirmed revenue, pending potential, refund and cancellation counts."""
    screening_q = select(Screening.id).where(Screening.cinema_id == cinema_id)
    if start_date:
        screening_q = screening_q.where(Screening.starts_at >= start_date)
    if end_date:
        screening_q = screening_q.where(Screening.starts_at <= end_date)

    confirmed_screening_ids_q = screening_q.where(Screening.status == ScreeningStatus.confirmed)
    pending_screening_ids_q = screening_q.where(
        Screening.status.in_([ScreeningStatus.selling, ScreeningStatus.pending])
    )
    cancelled_count_result = await session.execute(
        select(func.count(Screening.id)).where(
            Screening.cinema_id == cinema_id,
            Screening.status == ScreeningStatus.cancelled,
        )
    )
    cancelled_count = int(cancelled_count_result.scalar() or 0)

    confirmed_revenue = await session.execute(
        select(func.sum(Admission.total_price_cents))
        .where(
            Admission.screening_id.in_(confirmed_screening_ids_q),
            Admission.status.in_([AdmissionStatus.active, AdmissionStatus.used]),
        )
    )
    confirmed_rev = int(confirmed_revenue.scalar() or 0)

    pending_revenue = await session.execute(
        select(func.sum(Admission.total_price_cents))
        .where(
            Admission.screening_id.in_(pending_screening_ids_q),
            Admission.status.in_([AdmissionStatus.pending_outcome, AdmissionStatus.active]),
        )
    )
    pending_rev = int(pending_revenue.scalar() or 0)

    refund_count_result = await session.execute(
        text(
            "SELECT COUNT(DISTINCT r.id) "
            "FROM public.refunds r "
            "JOIN public.refund_lines rl ON rl.refund_id = r.id "
            "JOIN public.admissions a ON a.id = rl.admission_id "
            "JOIN public.screenings s ON s.id = a.screening_id "
            "WHERE s.cinema_id = :cid AND r.status = 'succeeded'"
        ),
        {"cid": cinema_id},
    )
    refund_count = int(refund_count_result.scalar() or 0)

    return RevenueMetricsRead(
        confirmed_revenue_cents=confirmed_rev,
        pending_potential_cents=pending_rev,
        refund_count=refund_count,
        cancelled_screening_count=cancelled_count,
    )


def _slot_summary(cell: SlotCell) -> SlotSummary:
    day = _DOW_NAMES[cell.dow % 7]
    hour_label = _HOUR_LABELS.get(cell.hour_bucket, f"{cell.hour_bucket}h")
    label = f"{day} {hour_label} ({int(cell.avg_fill_rate * 100)}% avg fill)"
    return SlotSummary(
        dow=cell.dow,
        hour_bucket=cell.hour_bucket,
        avg_fill_rate=cell.avg_fill_rate,
        label=label,
    )
