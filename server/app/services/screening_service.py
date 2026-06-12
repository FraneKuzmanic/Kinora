import logging
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.admission import Admission, AdmissionStatus, AdmissionType
from app.models.campaign import CampaignMovie
from app.models.cinema import Cinema, CinemaHall, CinemaLocation
from app.models.geography import City
from app.models.movie import Movie
from app.models.screening import Screening, ScreeningStatus
from app.schemas.screening import ScreeningCreate

log = logging.getLogger(__name__)

_VALID_TICKET_STATUSES = [AdmissionStatus.pending_outcome, AdmissionStatus.active, AdmissionStatus.used]


class ScreeningService:
    """
    Screening business logic: reads, lifecycle transitions, and campaign-derived creation.

    Lifecycle state machine:
        scheduled ──open_sales──► selling ──confirm──► confirmed
            │                         │
            └──cancel─────────────────┴──pending──► pending ──confirm/cancel──► confirmed/cancelled
    """

    # -------------------------------------------------------------------------
    # Read helpers
    # -------------------------------------------------------------------------

    async def list_screenings(
        self,
        session: AsyncSession,
        *,
        city_id: uuid.UUID | None = None,
        cinema_id: uuid.UUID | None = None,
        status: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        active_only: bool = False,
        limit: int | None = None,
    ) -> list[dict]:
        q = self._base_query()
        if active_only:
            q = q.where(
                Screening.status.in_([ScreeningStatus.selling, ScreeningStatus.confirmed]),
                Screening.starts_at >= datetime.now(UTC),
            )
        if city_id:
            q = q.where(CinemaLocation.city_id == city_id)
        if cinema_id:
            q = q.where(Screening.cinema_id == cinema_id)
        if status:
            q = q.where(Screening.status == status)
        if date_from:
            q = q.where(Screening.starts_at >= date_from)
        if date_to:
            q = q.where(Screening.starts_at <= date_to)

        q = q.order_by(Screening.starts_at.asc())
        if limit is not None:
            q = q.limit(limit)

        result = await session.execute(q)
        rows = list(result.all())
        if not rows:
            return []

        screening_ids = [row[0].id for row in rows]
        campaign_ids = [row[0].campaign_id for row in rows if row[0].campaign_id]
        regular_map, earlybird_map = await self._fetch_ticket_maps(session, screening_ids, campaign_ids)

        return [self._to_dict(row, regular_map, earlybird_map) for row in rows]

    async def get_screening(self, session: AsyncSession, screening_id: str) -> dict | None:
        result = await session.execute(
            self._base_query().where(Screening.id == screening_id)
        )
        row = result.first()
        if not row:
            return None

        s: Screening = row[0]
        screening_ids = [s.id]
        campaign_ids = [s.campaign_id] if s.campaign_id else []
        regular_map, earlybird_map = await self._fetch_ticket_maps(session, screening_ids, campaign_ids)
        return self._to_dict(row, regular_map, earlybird_map)

    async def get_screening_orm(self, session: AsyncSession, screening_id: str) -> Screening | None:
        """Return raw ORM Screening for lifecycle mutations."""
        result = await session.execute(select(Screening).where(Screening.id == screening_id))
        return result.scalar_one_or_none()

    # -------------------------------------------------------------------------
    # Ownership helpers
    # -------------------------------------------------------------------------

    def assert_ownership(self, screening: Screening, cinema_id: uuid.UUID) -> None:
        if screening.cinema_id != cinema_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Screening does not belong to your cinema",
            )

    # -------------------------------------------------------------------------
    # Create
    # -------------------------------------------------------------------------

    async def create_screening(
        self,
        session: AsyncSession,
        data: ScreeningCreate,
        cinema_id: uuid.UUID,
        user_id: str | uuid.UUID,
    ) -> dict:
        """Create a standalone screening in `scheduled` status (cinema_admin only)."""
        hall = await self._validate_hall(session, data.hall_id, cinema_id)
        if not hall:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="hall_id does not belong to your cinema",
            )

        movie = await session.execute(select(Movie).where(Movie.id == data.movie_id))
        if not movie.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found")

        if data.ends_at <= data.starts_at:
            raise HTTPException(status_code=400, detail="ends_at must be after starts_at")

        now = datetime.now(UTC)
        screening = Screening(
            id=uuid.uuid4(),
            cinema_id=cinema_id,
            hall_id=data.hall_id,
            movie_id=data.movie_id,
            campaign_id=None,
            status=ScreeningStatus.scheduled,
            starts_at=data.starts_at,
            ends_at=data.ends_at,
            decision_days_before_start=data.decision_days_before_start,
            min_tickets_to_confirm=data.min_tickets_to_confirm,
            max_tickets=data.max_tickets,
            ticket_price_cents=data.ticket_price_cents,
            pending_at=None,
            pending_expires_at=None,
            created_by_user_id=user_id,
            created_at=now,
            updated_at=now,
        )
        session.add(screening)
        await session.commit()
        await session.refresh(screening)
        enriched = await self.get_screening(session, str(screening.id))
        return enriched  # type: ignore[return-value]

    async def create_from_campaign(
        self,
        session: AsyncSession,
        campaign: object,
        winning_movie_id: uuid.UUID,
    ) -> Screening:
        """
        Auto-create a linked screening when a campaign resolves.

        Uses campaign slot times, hall, cinema, min_tickets_to_confirm, max_tickets, and price.
        The screening starts in `scheduled` status and is automatically opened by scheduler.
        """
        now = datetime.now(UTC)
        screening = Screening(
            id=uuid.uuid4(),
            cinema_id=campaign.cinema_id,  # type: ignore[attr-defined]
            hall_id=campaign.hall_id,  # type: ignore[attr-defined]
            movie_id=winning_movie_id,
            campaign_id=campaign.id,  # type: ignore[attr-defined]
            status=ScreeningStatus.scheduled,
            starts_at=campaign.slot_starts_at,  # type: ignore[attr-defined]
            ends_at=campaign.slot_ends_at,  # type: ignore[attr-defined]
            decision_days_before_start=getattr(campaign, "decision_days_before_screening", 7),
            min_tickets_to_confirm=campaign.min_tickets_to_confirm,  # type: ignore[attr-defined]
            max_tickets=getattr(campaign, "max_tickets", None),
            ticket_price_cents=getattr(campaign, "ticket_price_cents", 900),
            pending_at=None,
            pending_expires_at=None,
            created_by_user_id=None,
            created_at=now,
            updated_at=now,
        )
        session.add(screening)
        await session.flush()
        return screening

    # -------------------------------------------------------------------------
    # Lifecycle transitions
    # -------------------------------------------------------------------------

    async def open_sales(self, session: AsyncSession, screening: Screening) -> dict:
        """Transition scheduled → selling."""
        self._assert_status(screening, {ScreeningStatus.scheduled}, "open sales for")
        screening.status = ScreeningStatus.selling
        screening.updated_at = datetime.now(UTC)
        session.add(screening)
        await session.commit()
        enriched = await self.get_screening(session, str(screening.id))
        return enriched  # type: ignore[return-value]

    async def confirm_screening(self, session: AsyncSession, screening: Screening) -> dict:
        """
        Transition selling → confirmed.

        Bulk-transitions pending_outcome admissions → active so ticket holders
        know their seats are guaranteed.
        """
        self._assert_status(screening, {ScreeningStatus.selling, ScreeningStatus.pending}, "confirm")
        now = datetime.now(UTC)
        screening.status = ScreeningStatus.confirmed
        screening.confirmed_at = now
        screening.pending_at = None
        screening.pending_expires_at = None
        screening.updated_at = now
        session.add(screening)

        await session.execute(
            update(Admission)
            .where(
                Admission.screening_id == screening.id,
                Admission.type == AdmissionType.screening_ticket,
                Admission.status == AdmissionStatus.pending_outcome,
            )
            .values(status=AdmissionStatus.active)
        )

        await session.commit()
        enriched = await self.get_screening(session, str(screening.id))
        return enriched  # type: ignore[return-value]

    async def cancel_screening(
        self,
        session: AsyncSession,
        screening: Screening,
        reason: str | None = None,
    ) -> dict:
        """
        Transition scheduled|selling|pending -> cancelled.

        Bulk-transitions pending_outcome admissions → lost_refund_pending so the
        payment/refund job can issue Stripe refunds.
        """
        self._assert_status(
            screening,
            {ScreeningStatus.scheduled, ScreeningStatus.selling, ScreeningStatus.pending},
            "cancel",
        )
        now = datetime.now(UTC)
        screening.status = ScreeningStatus.cancelled
        screening.cancelled_at = now
        screening.cancel_reason = reason
        screening.pending_at = None
        screening.pending_expires_at = None
        screening.updated_at = now
        session.add(screening)

        await session.execute(
            update(Admission)
            .where(
                Admission.screening_id == screening.id,
                Admission.status == AdmissionStatus.pending_outcome,
            )
            .values(status=AdmissionStatus.lost_refund_pending)
        )

        from app.services.payment_service import PaymentService

        await PaymentService().refund_screening_admissions(
            session=session,
            screening_id=screening.id,
            reason=reason or "screening_cancelled",
        )

        await session.commit()
        enriched = await self.get_screening(session, str(screening.id))
        return enriched  # type: ignore[return-value]

    # -------------------------------------------------------------------------
    # Threshold / capacity auto-confirm
    # -------------------------------------------------------------------------

    async def _count_threshold_tickets(
        self,
        session: AsyncSession,
        screening: Screening,
    ) -> int:
        """
        Count all tickets that count toward min_tickets_to_confirm:
        - screening_ticket admissions for this screening
        - campaign_earlybird admissions for the winning movie (campaign-derived screenings only)

        Only statuses that represent a committed purchase are counted:
        pending_outcome, active, used.
        """
        regular = await session.execute(
            select(func.coalesce(func.sum(Admission.quantity), 0))
            .where(
                Admission.screening_id == screening.id,
                Admission.type == AdmissionType.screening_ticket,
                Admission.status.in_(_VALID_TICKET_STATUSES),
            )
        )
        total: int = int(regular.scalar() or 0)

        if screening.campaign_id:
            earlybird = await session.execute(
                select(func.coalesce(func.sum(Admission.quantity), 0))
                .where(
                    Admission.screening_id == screening.id,
                    Admission.type == AdmissionType.campaign_earlybird,
                    Admission.status.in_(_VALID_TICKET_STATUSES),
                )
            )
            total += int(earlybird.scalar() or 0)

        return total

    async def auto_confirm_if_threshold_met(
        self,
        session: AsyncSession,
        screening: Screening,
        hall_capacity: int | None = None,
    ) -> bool:
        """
        Check whether the ticket threshold (or hall capacity) is met and, if so, confirm.

        Returns True when the screening was confirmed, False when not.
        Safe to call on any status — only acts when status is `selling` or `pending`.
        """
        if screening.status not in {ScreeningStatus.selling, ScreeningStatus.pending}:
            return False
        total = await self._count_threshold_tickets(session, screening)
        threshold_met = total >= screening.min_tickets_to_confirm
        capacity_full = False
        if hall_capacity is not None:
            effective_max = screening.max_tickets if screening.max_tickets is not None else hall_capacity
            capacity_full = total >= effective_max
        if threshold_met or capacity_full:
            await self.confirm_screening(session, screening)
            return True
        return False

    # -------------------------------------------------------------------------
    # Scheduler methods (called every 60 s by the background loop)
    # -------------------------------------------------------------------------

    async def open_scheduled_screenings(self, session: AsyncSession) -> None:
        """
        Transition all `scheduled` screenings to `selling`.

        Sales open by scheduler cadence; there is no explicit sales start timestamp.
        """
        now = datetime.now(UTC)
        await session.execute(
            update(Screening)
            .where(
                Screening.status == ScreeningStatus.scheduled,
            )
            .values(status=ScreeningStatus.selling, updated_at=now)
        )
        await session.commit()

    async def confirm_selling_screenings(self, session: AsyncSession) -> None:
        """
        Scan all `selling` screenings and auto-confirm those that have reached
        min_tickets_to_confirm OR filled their effective capacity.

        Per-screening errors are swallowed so one failure cannot block the rest.
        """
        result = await session.execute(
            select(Screening, CinemaHall.capacity.label("hall_capacity"))
            .join(CinemaHall, CinemaHall.id == Screening.hall_id)
            .where(Screening.status.in_([ScreeningStatus.selling, ScreeningStatus.pending]))
        )
        for row in result.all():
            screening: Screening = row[0]
            hall_capacity: int = row[1]
            try:
                confirmed = await self.auto_confirm_if_threshold_met(session, screening, hall_capacity)
                if confirmed:
                    log.info("Auto-confirmed screening %s (threshold or capacity met)", screening.id)
            except Exception:
                await session.rollback()
                log.exception("Failed to auto-confirm screening %s", screening.id)

    async def cancel_undersold_screenings(self, session: AsyncSession) -> None:
        """
        Move undersold `selling` screenings to `pending` at decision deadline.

        Per-screening errors are swallowed so one failure cannot block the rest.
        """
        now = datetime.now(UTC)
        result = await session.execute(
            select(Screening).where(
                Screening.status == ScreeningStatus.selling,
            )
        )
        for screening in result.scalars().all():
            try:
                decision_deadline = screening.starts_at - timedelta(days=screening.decision_days_before_start)
                if now < decision_deadline:
                    continue
                total = await self._count_threshold_tickets(session, screening)
                if total < screening.min_tickets_to_confirm:
                    pending_now = datetime.now(UTC)
                    screening.status = ScreeningStatus.pending
                    screening.pending_at = pending_now
                    screening.pending_expires_at = pending_now + timedelta(days=12)
                    screening.updated_at = pending_now
                    session.add(screening)
                    await session.commit()
                    log.info("Moved screening %s to pending (threshold unmet at decision deadline)", screening.id)
            except Exception:
                await session.rollback()
                log.exception("Failed to transition screening %s to pending", screening.id)

    async def auto_cancel_expired_pending_screenings(self, session: AsyncSession) -> None:
        """
        Cancel pending screenings once grace expires or screening start is reached.

        This method is intended for a lower-frequency scheduler (e.g., every 30 min).
        """
        now = datetime.now(UTC)
        result = await session.execute(
            select(Screening).where(Screening.status == ScreeningStatus.pending)
        )
        for screening in result.scalars().all():
            try:
                grace_expired = screening.pending_expires_at is not None and screening.pending_expires_at <= now
                start_reached = screening.starts_at <= now
                if not (grace_expired or start_reached):
                    continue

                reason = (
                    "Pending decision grace period expired"
                    if grace_expired
                    else "Screening start reached without confirmation"
                )
                await self.cancel_screening(session, screening, reason=reason)
                log.info("Auto-cancelled pending screening %s", screening.id)
            except Exception:
                await session.rollback()
                log.exception("Failed to auto-cancel pending screening %s", screening.id)

    # -------------------------------------------------------------------------
    # Internal helpers
    # -------------------------------------------------------------------------

    def _base_query(self):
        return (
            select(
                Screening,
                Movie.title.label("movie_title"),
                Movie.release_year.label("movie_release_year"),
                Movie.poster_url.label("movie_poster_url"),
                Movie.overview.label("movie_overview"),
                Cinema.name.label("cinema_name"),
                CinemaHall.name.label("hall_name"),
                CinemaHall.capacity.label("hall_capacity"),
                CinemaLocation.id.label("location_id"),
                CinemaLocation.location_name.label("location_name"),
                CinemaLocation.address_line1.label("location_address"),
                City.id.label("city_id"),
                City.name.label("city_name"),
            )
            .join(Movie, Movie.id == Screening.movie_id)
            .join(Cinema, Cinema.id == Screening.cinema_id)
            .join(CinemaHall, CinemaHall.id == Screening.hall_id)
            .join(CinemaLocation, CinemaLocation.id == CinemaHall.location_id)
            .join(City, City.id == CinemaLocation.city_id)
        )

    async def _fetch_ticket_maps(
        self,
        session: AsyncSession,
        screening_ids: list[uuid.UUID],
        campaign_ids: list[uuid.UUID],
    ) -> tuple[dict[uuid.UUID, int], dict[uuid.UUID, int]]:
        """
        Batch-fetch ticket counts to avoid N+1 queries.

        Returns (regular_map, earlybird_map) where:
          regular_map   — screening_id → regular ticket count
          earlybird_map — campaign_id  → early-bird ticket count (winning movie only)
        """
        reg_result = await session.execute(
            select(
                Admission.screening_id,
                func.coalesce(func.sum(Admission.quantity), 0).label("cnt"),
            )
            .where(
                Admission.screening_id.in_(screening_ids),
                Admission.type == AdmissionType.screening_ticket,
                Admission.status.in_(_VALID_TICKET_STATUSES),
            )
            .group_by(Admission.screening_id)
        )
        regular_map: dict[uuid.UUID, int] = {row.screening_id: int(row.cnt) for row in reg_result}

        earlybird_map: dict[uuid.UUID, int] = {}
        if campaign_ids:
            eb_result = await session.execute(
                select(
                    CampaignMovie.campaign_id,
                    func.coalesce(func.sum(Admission.quantity), 0).label("cnt"),
                )
                .join(CampaignMovie, CampaignMovie.id == Admission.campaign_movie_id)
                .where(
                    CampaignMovie.campaign_id.in_(campaign_ids),
                    CampaignMovie.is_winner.is_(True),
                    Admission.type == AdmissionType.campaign_earlybird,
                    Admission.status.in_(_VALID_TICKET_STATUSES),
                )
                .group_by(CampaignMovie.campaign_id)
            )
            earlybird_map = {row.campaign_id: int(row.cnt) for row in eb_result}

        return regular_map, earlybird_map

    def _assert_status(
        self,
        screening: Screening,
        allowed: set[ScreeningStatus],
        action: str,
    ) -> None:
        if screening.status not in allowed:
            allowed_str = ", ".join(s.value for s in allowed)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot {action} a screening with status '{screening.status}' (allowed: {allowed_str})",
            )

    async def _validate_hall(
        self,
        session: AsyncSession,
        hall_id: uuid.UUID,
        cinema_id: uuid.UUID,
    ) -> CinemaHall | None:
        result = await session.execute(
            select(CinemaHall)
            .join(CinemaLocation, CinemaLocation.id == CinemaHall.location_id)
            .where(
                CinemaHall.id == hall_id,
                CinemaLocation.cinema_id == cinema_id,
            )
        )
        return result.scalar_one_or_none()

    def _to_dict(
        self,
        row: object,
        regular_map: dict[uuid.UUID, int],
        earlybird_map: dict[uuid.UUID, int],
    ) -> dict:
        s: Screening = row[0]  # type: ignore[index]
        hall_capacity: int = row[7]  # type: ignore[index]
        effective_max = s.max_tickets if s.max_tickets is not None else hall_capacity
        tickets_sold = regular_map.get(s.id, 0) + (
            earlybird_map.get(s.campaign_id, 0) if s.campaign_id else 0
        )
        return {
            "id": s.id,
            "cinema_id": s.cinema_id,
            "hall_id": s.hall_id,
            "movie_id": s.movie_id,
            "campaign_id": s.campaign_id,
            "status": s.status,
            "starts_at": s.starts_at,
            "ends_at": s.ends_at,
            "decision_days_before_start": s.decision_days_before_start,
            "min_tickets_to_confirm": s.min_tickets_to_confirm,
            "max_tickets": effective_max,
            "tickets_sold": tickets_sold,
            "ticket_price_cents": s.ticket_price_cents,
            "pending_at": s.pending_at,
            "pending_expires_at": s.pending_expires_at,
            "confirmed_at": s.confirmed_at,
            "cancelled_at": s.cancelled_at,
            "cancel_reason": s.cancel_reason,
            "created_at": s.created_at,
            "movie_title": row[1],  # type: ignore[index]
            "movie_release_year": row[2],  # type: ignore[index]
            "movie_poster_url": row[3],  # type: ignore[index]
            "movie_overview": row[4],  # type: ignore[index]
            "cinema_name": row[5],  # type: ignore[index]
            "hall_name": row[6],  # type: ignore[index]
            "hall_capacity": hall_capacity,
            "location_id": row[8],  # type: ignore[index]
            "location_name": row[9],  # type: ignore[index]
            "location_address": row[10],  # type: ignore[index]
            "city_id": row[11],  # type: ignore[index]
            "city_name": row[12],  # type: ignore[index]
        }
