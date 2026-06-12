import logging
import uuid
from datetime import UTC, datetime, timedelta

from asyncpg import InterfaceError as AsyncpgInterfaceError
from asyncpg.exceptions import PostgresConnectionError
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admission import Admission, AdmissionStatus, AdmissionType
from app.models.campaign import Campaign, CampaignMovie, CampaignStatus, CampaignVote
from app.models.cinema import Cinema, CinemaHall, CinemaLocation, CinemaMembership
from app.models.geography import City
from app.models.movie import Movie
from app.notifications.service import NotificationService
from app.schemas.campaign import CampaignCreate, CampaignUpdate
from app.services.loyalty_service import LoyaltyService, POINTS_VOTE
from app.services.movie_recommendation_service import MovieRecommendationService

log = logging.getLogger(__name__)


class CampaignService:
    """
    All campaign business logic: reads, lifecycle transitions, candidate movie
    management, and vote submission.

    Lifecycle state machine:
        draft ──publish──► voting ──resolve──► resolved  (terminal)
          │                   │
          └──cancel───────────┴──cancel──► cancelled     (terminal)

    Auto-resolve: when voting_ends_at passes the background scheduler calls
    resolve_expired_campaigns() which resolves each expired voting campaign and
    creates the linked screening via ScreeningService.create_from_campaign().

    Ownership: every mutating method that takes a Campaign expects the caller to
    have already verified that campaign.cinema_id matches the admin's cinema via
    assert_ownership().
    """

    def __init__(self, notification_service: NotificationService | None = None) -> None:
        self._notification_service = notification_service or NotificationService()

    # -------------------------------------------------------------------------
    # Read helpers
    # -------------------------------------------------------------------------

    async def list_campaigns(
        self,
        session: AsyncSession,
        *,
        city_id: uuid.UUID | None = None,
        cinema_id: uuid.UUID | None = None,
        status: str | None = None,
    ) -> list[dict]:
        q = (
            self._base_campaign_query()
            .order_by(Campaign.voting_ends_at.asc())
        )
        if city_id:
            q = q.where(CinemaLocation.city_id == city_id)
        if cinema_id:
            q = q.where(Campaign.cinema_id == cinema_id)
        if status:
            q = q.where(Campaign.status == status)
        rows = await session.execute(q)
        return [self._campaign_to_dict(row) for row in rows]

    async def list_discover_campaign_cards(
        self,
        session: AsyncSession,
        *,
        city_id: uuid.UUID | None = None,
        cinema_id: uuid.UUID | None = None,
        limit: int = 8,
        user_id: str | uuid.UUID | None = None,
    ) -> list[dict]:
        now = datetime.now(UTC)
        q = (
            self._base_campaign_query()
            .where(Campaign.status == CampaignStatus.voting)
            .where(Campaign.voting_starts_at.is_not(None))
            .where(Campaign.voting_ends_at.is_not(None))
            .where(Campaign.voting_starts_at <= now)
            .where(Campaign.voting_ends_at >= now)
            .order_by(Campaign.voting_ends_at.asc())
            .limit(limit)
        )
        if city_id:
            q = q.where(CinemaLocation.city_id == city_id)
        if cinema_id:
            q = q.where(Campaign.cinema_id == cinema_id)

        rows = list((await session.execute(q)).all())
        if not rows:
            return []

        campaign_ids = [row[0].id for row in rows]
        movie_rows = list(
            (
                await session.execute(
                    select(
                        CampaignMovie,
                        Movie.title.label("movie_title"),
                        Movie.poster_url.label("movie_poster_url"),
                    )
                    .join(Movie, Movie.id == CampaignMovie.movie_id)
                    .where(CampaignMovie.campaign_id.in_(campaign_ids))
                    .order_by(CampaignMovie.campaign_id.asc(), CampaignMovie.sort_order.asc())
                )
            ).all()
        )

        vote_rows = list(
            (
                await session.execute(
                    select(
                        CampaignVote.campaign_movie_id,
                        func.count(CampaignVote.id).label("vote_count"),
                    )
                    .where(CampaignVote.campaign_id.in_(campaign_ids))
                    .group_by(CampaignVote.campaign_movie_id)
                )
            ).all()
        )
        vote_map: dict[uuid.UUID, int] = {
            row.campaign_movie_id: int(row.vote_count) for row in vote_rows
        }
        user_vote_map: dict[uuid.UUID, uuid.UUID] = {}
        if user_id:
            user_vote_rows = list(
                (
                    await session.execute(
                        select(
                            CampaignVote.campaign_id,
                            CampaignVote.campaign_movie_id,
                        ).where(
                            CampaignVote.campaign_id.in_(campaign_ids),
                            CampaignVote.user_id == uuid.UUID(str(user_id)),
                        )
                    )
                ).all()
            )
            user_vote_map = {
                row.campaign_id: row.campaign_movie_id for row in user_vote_rows
            }

        movies_by_campaign: dict[uuid.UUID, list[dict]] = {campaign_id: [] for campaign_id in campaign_ids}
        for row in movie_rows:
            campaign_movie: CampaignMovie = row[0]
            movies_by_campaign[campaign_movie.campaign_id].append(
                {
                    "id": campaign_movie.id,
                    "movie_id": campaign_movie.movie_id,
                    "sort_order": campaign_movie.sort_order,
                    "vote_count": vote_map.get(campaign_movie.id, 0),
                    "movie_title": row[1],
                    "movie_poster_url": row[2],
                }
            )

        cards: list[dict] = []
        for row in rows:
            campaign: Campaign = row[0]
            campaign_movies = movies_by_campaign.get(campaign.id, [])
            if not campaign_movies:
                continue

            leading_movie = max(
                campaign_movies,
                key=lambda movie: (movie["vote_count"], -movie["sort_order"]),
            )
            total_voters = sum(int(movie["vote_count"]) for movie in campaign_movies)
            cards.append(
                {
                    "id": campaign.id,
                    "created_at": campaign.created_at,
                    "cinema_name": row[1],
                    "location_name": row[6],
                    "city_name": row[5],
                    "slot_starts_at": campaign.slot_starts_at,
                    "voting_ends_at": campaign.voting_ends_at,
                    "leading_movie_title": leading_movie["movie_title"],
                    "leading_movie_vote_count": leading_movie["vote_count"],
                    "total_voters": total_voters,
                    "current_user_vote_campaign_movie_id": user_vote_map.get(campaign.id),
                    "movies": [
                        {
                            **movie,
                            "is_leading": movie["id"] == leading_movie["id"],
                        }
                        for movie in campaign_movies
                    ],
                }
            )

        return cards

    async def get_campaign(self, session: AsyncSession, campaign_id: str) -> Campaign | None:
        result = await session.execute(select(Campaign).where(Campaign.id == campaign_id))
        return result.scalar_one_or_none()

    async def enrich_campaign(self, session: AsyncSession, campaign: Campaign) -> dict:
        """Return an enriched dict matching CampaignRead for a known Campaign ORM object."""
        row = await session.execute(
            self._base_campaign_query().where(Campaign.id == campaign.id)
        )
        result = row.first()
        if not result:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
        return self._campaign_to_dict(result)

    async def get_campaign_movie_stats(
        self,
        session: AsyncSession,
        campaign_id: str,
        include_ticket_counts: bool = False,
    ) -> list[dict]:
        """
        Return per-movie vote and (optionally) ticket counts for a campaign,
        with movie metadata joined in.

        include_ticket_counts should only be True when the caller is the
        cinema_admin who owns the campaign.
        """
        movies_result = await session.execute(
            select(
                CampaignMovie,
                Movie.title,
                Movie.release_year,
                Movie.poster_url,
                Movie.overview,
                Movie.runtime_minutes,
            )
            .join(Movie, Movie.id == CampaignMovie.movie_id)
            .where(CampaignMovie.campaign_id == campaign_id)
            .order_by(CampaignMovie.sort_order.asc())
        )
        movie_rows = list(movies_result.all())
        if not movie_rows:
            return []

        movies = [r[0] for r in movie_rows]
        movie_id_to_meta = {
            r[0].id: {
                "title": r[1],
                "release_year": r[2],
                "poster_url": r[3],
                "overview": r[4],
                "runtime_minutes": r[5],
            }
            for r in movie_rows
        }
        movie_ids = [m.id for m in movies]

        vote_rows = await session.execute(
            select(
                CampaignVote.campaign_movie_id,
                func.count(CampaignVote.id).label("vote_count"),
            )
            .where(CampaignVote.campaign_id == campaign_id)
            .group_by(CampaignVote.campaign_movie_id)
        )
        vote_map: dict[uuid.UUID, int] = {row.campaign_movie_id: int(row.vote_count) for row in vote_rows}

        ticket_map: dict[uuid.UUID, int] = {}
        if include_ticket_counts:
            ticket_rows = await session.execute(
                select(
                    Admission.campaign_movie_id,
                    func.coalesce(func.sum(Admission.quantity), 0).label("ticket_count"),
                )
                .where(
                    Admission.campaign_movie_id.in_(movie_ids),
                    Admission.type == AdmissionType.campaign_earlybird,
                    Admission.status.in_([
                        AdmissionStatus.pending_outcome,
                        AdmissionStatus.active,
                        AdmissionStatus.used,
                    ]),
                )
                .group_by(Admission.campaign_movie_id)
            )
            ticket_map = {row.campaign_movie_id: int(row.ticket_count) for row in ticket_rows}

        meta = movie_id_to_meta
        return [
            {
                "id": m.id,
                "campaign_id": m.campaign_id,
                "movie_id": m.movie_id,
                "sort_order": m.sort_order,
                "is_winner": m.is_winner,
                "vote_count": vote_map.get(m.id, 0),
                "ticket_count": ticket_map.get(m.id, 0) if include_ticket_counts else None,
                "movie_title": meta[m.id]["title"],
                "movie_release_year": meta[m.id]["release_year"],
                "movie_poster_url": meta[m.id]["poster_url"],
                "movie_overview": meta[m.id]["overview"],
                "movie_runtime_minutes": meta[m.id]["runtime_minutes"],
            }
            for m in movies
        ]

    async def list_campaign_movies(self, session: AsyncSession, campaign_id: str) -> list[CampaignMovie]:
        result = await session.execute(
            select(CampaignMovie)
            .where(CampaignMovie.campaign_id == campaign_id)
            .order_by(CampaignMovie.sort_order.asc())
        )
        return list(result.scalars().all())

    async def get_campaign_early_bird_total(
        self,
        session: AsyncSession,
        campaign_id: str,
    ) -> int:
        movie_rows = await session.execute(
            select(CampaignMovie.id).where(CampaignMovie.campaign_id == uuid.UUID(str(campaign_id)))
        )
        campaign_movie_ids = list(movie_rows.scalars().all())
        if not campaign_movie_ids:
            return 0

        total_result = await session.execute(
            select(func.coalesce(func.sum(Admission.quantity), 0))
            .where(
                Admission.campaign_movie_id.in_(campaign_movie_ids),
                Admission.type == AdmissionType.campaign_earlybird,
                Admission.status.in_([
                    AdmissionStatus.pending_outcome,
                    AdmissionStatus.active,
                    AdmissionStatus.used,
                ]),
            )
        )
        return int(total_result.scalar() or 0)

    async def get_user_campaign_vote(
        self,
        session: AsyncSession,
        campaign_id: str,
        user_id: str | uuid.UUID,
    ) -> CampaignVote | None:
        result = await session.execute(
            select(CampaignVote).where(
                CampaignVote.campaign_id == uuid.UUID(str(campaign_id)),
                CampaignVote.user_id == uuid.UUID(str(user_id)),
            )
        )
        return result.scalar_one_or_none()

    # -------------------------------------------------------------------------
    # Ownership helpers
    # -------------------------------------------------------------------------

    async def get_admin_cinema_id(self, session: AsyncSession, user_id: str | uuid.UUID) -> uuid.UUID | None:
        """Return the cinema_id from cinema_memberships for the given user, or None."""
        result = await self._execute_with_retry(
            session,
            lambda: session.execute(
                select(CinemaMembership.cinema_id).where(CinemaMembership.user_id == user_id)
            ),
        )
        return result.scalar_one_or_none()

    def assert_ownership(self, campaign: Campaign, cinema_id: uuid.UUID) -> None:
        """Raise 403 when the campaign does not belong to cinema_id."""
        if campaign.cinema_id != cinema_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Campaign does not belong to your cinema",
            )

    # -------------------------------------------------------------------------
    # Creation & editing (draft only)
    # -------------------------------------------------------------------------

    async def create_campaign(
        self,
        session: AsyncSession,
        payload: CampaignCreate,
        user_id: str | uuid.UUID,
        cinema_id: uuid.UUID,
    ) -> Campaign:
        """
        Create a campaign in draft status.

        Validates:
        - hall belongs to the admin's cinema (hall -> location -> cinema chain)
        - slot ordering constraints
        """
        self._validate_slot_time_ordering(payload.slot_starts_at, payload.slot_ends_at)

        hall_check = await session.execute(
            select(CinemaHall)
            .join(CinemaLocation, CinemaLocation.id == CinemaHall.location_id)
            .where(
                CinemaHall.id == payload.hall_id,
                CinemaLocation.cinema_id == cinema_id,
            )
        )
        if not hall_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="hall_id does not belong to your cinema",
            )

        now = datetime.now(UTC)
        campaign = Campaign(
            id=uuid.uuid4(),
            cinema_id=cinema_id,
            hall_id=payload.hall_id,
            title=payload.title,
            description=payload.description,
            status=CampaignStatus.draft,
            voting_starts_at=None,
            voting_ends_at=None,
            voting_duration_days=payload.voting_duration_days,
            slot_starts_at=payload.slot_starts_at,
            slot_ends_at=payload.slot_ends_at,
            decision_days_before_screening=payload.decision_days_before_screening,
            min_tickets_to_confirm=payload.min_tickets_to_confirm,
            max_tickets=payload.max_tickets,
            ticket_price_cents=payload.ticket_price_cents,
            created_by_user_id=user_id,
            created_at=now,
            updated_at=now,
        )
        session.add(campaign)
        await session.commit()
        await session.refresh(campaign)
        return campaign

    async def update_campaign(
        self,
        session: AsyncSession,
        campaign: Campaign,
        payload: CampaignUpdate,
    ) -> Campaign:
        """
        Partially update a campaign. Only allowed in draft status.

        Merges supplied fields onto the existing values, then re-validates slot
        ordering so partial updates cannot produce an inconsistent schedule.
        """
        self._assert_status(campaign, {CampaignStatus.draft}, "edit")

        if payload.title is not None:
            campaign.title = payload.title
        if payload.description is not None:
            campaign.description = payload.description
        if payload.slot_starts_at is not None:
            campaign.slot_starts_at = payload.slot_starts_at
        if payload.slot_ends_at is not None:
            campaign.slot_ends_at = payload.slot_ends_at
        if payload.voting_duration_days is not None:
            campaign.voting_duration_days = payload.voting_duration_days
        if payload.decision_days_before_screening is not None:
            campaign.decision_days_before_screening = payload.decision_days_before_screening
        if payload.min_tickets_to_confirm is not None:
            campaign.min_tickets_to_confirm = payload.min_tickets_to_confirm
        if payload.max_tickets is not None:
            campaign.max_tickets = payload.max_tickets
        if payload.ticket_price_cents is not None:
            campaign.ticket_price_cents = payload.ticket_price_cents

        self._validate_slot_time_ordering(campaign.slot_starts_at, campaign.slot_ends_at)

        campaign.updated_at = datetime.now(UTC)
        session.add(campaign)
        await session.commit()
        await session.refresh(campaign)
        return campaign

    # -------------------------------------------------------------------------
    # Lifecycle transitions
    # -------------------------------------------------------------------------

    async def publish_campaign(self, session: AsyncSession, campaign: Campaign) -> Campaign:
        """
        Transition draft → voting.

        Requires at least one candidate movie to be attached, so that voters
        immediately have options when the campaign goes live.
        """
        self._assert_status(campaign, {CampaignStatus.draft}, "publish")

        movies_check = await session.execute(
            select(func.count(CampaignMovie.id)).where(CampaignMovie.campaign_id == campaign.id)
        )
        if (movies_check.scalar() or 0) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Campaign must have at least one candidate movie before publishing",
            )

        now = datetime.now(UTC)
        voting_ends_at = now + timedelta(days=campaign.voting_duration_days)
        if voting_ends_at >= campaign.slot_starts_at:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Computed voting window overlaps screening slot start",
            )

        campaign.status = CampaignStatus.voting
        campaign.voting_starts_at = now
        campaign.voting_ends_at = voting_ends_at
        campaign.updated_at = datetime.now(UTC)
        session.add(campaign)

        campaign_movie_rows = await session.execute(
            select(CampaignMovie.movie_id, CampaignMovie.sort_order).where(
                CampaignMovie.campaign_id == campaign.id
            )
        )
        movie_order = {
            row.movie_id: int(row.sort_order)
            for row in campaign_movie_rows
        }

        await MovieRecommendationService(
            notification_service=self._notification_service
        ).enqueue_campaign_arrival_notifications(
            session,
            campaign=campaign,
            movie_order=movie_order,
        )

        await session.commit()
        await session.refresh(campaign)
        return campaign

    async def resolve_campaign(
        self,
        session: AsyncSession,
        campaign: Campaign,
        *,
        email_notification: str | None = None,
    ) -> Campaign:
        """
        Transition voting → resolved, selecting a winning movie, and auto-creating
        a linked screening.

        Winner selection rules (applied in order):
        1. Auto-win: if any movie has early-bird ticket quantity >=
           min_tickets_to_confirm, those movies are the only candidates.
           Among them pick: most tickets → most votes → lowest sort_order.
        2. No auto-win: pick by most votes → most early-bird tickets →
           lowest sort_order.

        After selecting the winner a Screening is created via ScreeningService
        using the campaign's slot window, hall, and cinema.
        """
        self._assert_status(campaign, {CampaignStatus.voting}, "resolve")

        movies_result = await session.execute(
            select(CampaignMovie).where(CampaignMovie.campaign_id == campaign.id)
        )
        movies = list(movies_result.scalars().all())
        if not movies:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Campaign has no candidate movies to resolve",
            )

        movie_ids = [m.id for m in movies]

        ticket_rows = await session.execute(
            select(
                Admission.campaign_movie_id,
                func.coalesce(func.sum(Admission.quantity), 0).label("ticket_count"),
            )
            .where(
                Admission.campaign_movie_id.in_(movie_ids),
                Admission.type == AdmissionType.campaign_earlybird,
                Admission.status.in_([
                    AdmissionStatus.pending_outcome,
                    AdmissionStatus.active,
                    AdmissionStatus.used,
                ]),
            )
            .group_by(Admission.campaign_movie_id)
        )
        ticket_map: dict[uuid.UUID, int] = {
            row.campaign_movie_id: int(row.ticket_count) for row in ticket_rows
        }

        vote_rows = await session.execute(
            select(
                CampaignVote.campaign_movie_id,
                func.count(CampaignVote.id).label("vote_count"),
            )
            .where(CampaignVote.campaign_id == campaign.id)
            .group_by(CampaignVote.campaign_movie_id)
        )
        vote_map: dict[uuid.UUID, int] = {
            row.campaign_movie_id: int(row.vote_count) for row in vote_rows
        }

        threshold = campaign.min_tickets_to_confirm
        auto_win_pool = [m for m in movies if ticket_map.get(m.id, 0) >= threshold]

        if auto_win_pool:
            winner = max(
                auto_win_pool,
                key=lambda m: (ticket_map.get(m.id, 0), vote_map.get(m.id, 0), -m.sort_order),
            )
        else:
            winner = max(
                movies,
                key=lambda m: (vote_map.get(m.id, 0), ticket_map.get(m.id, 0), -m.sort_order),
            )

        winner.is_winner = True
        session.add(winner)

        now = datetime.now(UTC)
        campaign.winning_movie_id = winner.movie_id
        campaign.status = CampaignStatus.resolved
        campaign.resolved_at = now
        campaign.updated_at = now
        session.add(campaign)
        await self._notification_service.enqueue_screening_confirmed(
            session,
            campaign,
            email_notification=email_notification,
        )

        # Auto-create the screening for the winning movie in this campaign's slot
        from app.services.screening_service import ScreeningService
        screening = await ScreeningService().create_from_campaign(
            session,
            campaign,
            winner.movie_id,
        )

        from app.services.payment_service import PaymentService

        await PaymentService().mark_campaign_outcome(session, campaign, screening.id)

        await session.commit()
        await session.refresh(campaign)
        return campaign

    async def cancel_campaign(
        self,
        session: AsyncSession,
        campaign: Campaign,
        *,
        email_notification: str | None = None,
    ) -> Campaign:
        """
        Transition draft|voting → cancelled.

        Cancelling a voting campaign does not automatically refund early-bird
        admissions — that is handled by a separate refund job (pending Stripe
        integration).
        """
        self._assert_status(campaign, {CampaignStatus.draft, CampaignStatus.voting}, "cancel")

        campaign.status = CampaignStatus.cancelled
        campaign.updated_at = datetime.now(UTC)
        session.add(campaign)

        from app.services.payment_service import PaymentService

        await PaymentService().refund_campaign_admissions(
            session=session,
            campaign_id=campaign.id,
            reason="campaign_cancelled",
        )
        await self._notification_service.enqueue_screening_cancelled(
            session,
            campaign,
            reason="campaign_cancelled",
            email_notification=email_notification,
        )
        await session.commit()
        await session.refresh(campaign)
        return campaign

    # -------------------------------------------------------------------------
    # Scheduled auto-resolve
    # -------------------------------------------------------------------------

    async def resolve_expired_campaigns(self, session: AsyncSession) -> None:
        """
        Called by the background scheduler every 60 seconds.

        Finds all campaigns in `voting` status whose voting_ends_at has passed
        and resolves each one, creating the linked screening automatically.
        Per-campaign errors are swallowed so a single bad campaign cannot block
        the rest of the batch.
        """
        now = datetime.now(UTC)
        expired_result = await session.execute(
            select(Campaign).where(
                Campaign.status == CampaignStatus.voting,
                Campaign.voting_ends_at.is_not(None),
                Campaign.voting_ends_at < now,
            )
        )
        expired = list(expired_result.scalars().all())

        for campaign in expired:
            try:
                await self.resolve_campaign(session, campaign)
                log.info("Auto-resolved campaign %s (winner: %s)", campaign.id, campaign.winning_movie_id)
            except Exception:
                await session.rollback()
                log.exception("Failed to auto-resolve campaign %s", campaign.id)

    # -------------------------------------------------------------------------
    # Candidate movie management (draft only)
    # -------------------------------------------------------------------------

    async def add_campaign_movie(
        self,
        session: AsyncSession,
        campaign: Campaign,
        movie_id: uuid.UUID,
        sort_order: int,
    ) -> CampaignMovie:
        """
        Attach a candidate movie to a draft campaign.

        Raises 404 if the movie does not exist in the movies catalog.
        Raises 409 if the movie is already attached to this campaign
        (enforced by DB unique constraint on (campaign_id, movie_id)).
        """
        self._assert_status(campaign, {CampaignStatus.draft}, "add movies to")

        movie_exists = await session.execute(select(Movie.id).where(Movie.id == movie_id))
        if not movie_exists.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found")

        now = datetime.now(UTC)
        entry = CampaignMovie(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            movie_id=movie_id,
            sort_order=sort_order,
            is_winner=False,
            created_at=now,
        )
        session.add(entry)
        try:
            await session.commit()
        except IntegrityError:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Movie is already a candidate in this campaign",
            )

        await session.refresh(entry)
        return entry

    async def remove_campaign_movie(
        self,
        session: AsyncSession,
        campaign: Campaign,
        campaign_movie_id: uuid.UUID,
    ) -> None:
        """
        Remove a candidate movie from a draft campaign.

        campaign_movie_id is the campaign_movies.id (PK), not the movies.id.
        Raises 404 if the entry does not exist or belongs to a different campaign.
        """
        self._assert_status(campaign, {CampaignStatus.draft}, "remove movies from")

        result = await session.execute(
            select(CampaignMovie).where(
                CampaignMovie.id == campaign_movie_id,
                CampaignMovie.campaign_id == campaign.id,
            )
        )
        entry = result.scalar_one_or_none()
        if not entry:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign movie not found")

        await session.delete(entry)
        await session.commit()

    # -------------------------------------------------------------------------
    # Voting (audience)
    # -------------------------------------------------------------------------

    async def create_vote(
        self,
        session: AsyncSession,
        campaign_id: str,
        campaign_movie_id: str,
        user_id: str,
    ) -> CampaignVote:
        """
        Submit a vote for a candidate movie.

        Guards:
        - Campaign must be in voting status.
        - Current time must be within [voting_starts_at, voting_ends_at].
        - campaign_movie_id must belong to this campaign.
        - One active vote per user per campaign.
        - Re-voting for another movie switches the existing vote instead of rejecting.
        """
        campaign = await self.get_campaign(session, campaign_id)
        if not campaign:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

        if campaign.status != CampaignStatus.voting:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Voting is not open for this campaign",
            )

        now = datetime.now(UTC)
        if not campaign.voting_starts_at or not campaign.voting_ends_at:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Voting window is not configured for this campaign",
            )

        if not (campaign.voting_starts_at <= now <= campaign.voting_ends_at):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Voting window is not currently active",
            )

        movie_result = await session.execute(
            select(CampaignMovie).where(CampaignMovie.id == campaign_movie_id)
        )
        movie = movie_result.scalar_one_or_none()
        if not movie or str(movie.campaign_id) != campaign_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="campaign_movie_id does not belong to this campaign",
            )

        existing_vote_result = await session.execute(
            select(CampaignVote).where(
                CampaignVote.campaign_id == uuid.UUID(campaign_id),
                CampaignVote.user_id == uuid.UUID(user_id),
            )
        )
        existing_vote = existing_vote_result.scalar_one_or_none()
        if existing_vote:
            if existing_vote.campaign_movie_id != movie.id:
                existing_vote.campaign_movie_id = movie.id
                session.add(existing_vote)
                await session.commit()
                await session.refresh(existing_vote)
            return existing_vote

        vote = CampaignVote(
            id=uuid.uuid4(),
            campaign_id=uuid.UUID(campaign_id),
            campaign_movie_id=uuid.UUID(campaign_movie_id),
            user_id=uuid.UUID(user_id),
            created_at=now,
        )
        session.add(vote)
        try:
            await session.commit()
        except IntegrityError:
            await session.rollback()
            existing_vote_result = await session.execute(
                select(CampaignVote).where(
                    CampaignVote.campaign_id == uuid.UUID(campaign_id),
                    CampaignVote.user_id == uuid.UUID(user_id),
                )
            )
            existing_vote = existing_vote_result.scalar_one_or_none()
            if existing_vote:
                if existing_vote.campaign_movie_id != movie.id:
                    existing_vote.campaign_movie_id = movie.id
                    session.add(existing_vote)
                    await session.commit()
                    await session.refresh(existing_vote)
                return existing_vote
            raise

        await session.refresh(vote)
        await LoyaltyService().award_points(
            session,
            user_id=vote.user_id,
            points=POINTS_VOTE,
            reason="Campaign vote",
            source_type="campaign_vote",
            source_id=vote.id,
            cinema_id=campaign.cinema_id,
            created_at=vote.created_at,
        )
        await LoyaltyService().evaluate_badges(session, vote.user_id)
        await session.commit()
        return vote

    # -------------------------------------------------------------------------
    # Internal helpers
    # -------------------------------------------------------------------------

    def _base_campaign_query(self):
        return (
            select(
                Campaign,
                Cinema.name.label("cinema_name"),
                CinemaHall.name.label("hall_name"),
                CinemaHall.capacity.label("hall_capacity"),
                CinemaLocation.city_id.label("city_id"),
                City.name.label("city_name"),
                CinemaLocation.location_name.label("location_name"),
            )
            .join(Cinema, Cinema.id == Campaign.cinema_id)
            .join(CinemaHall, CinemaHall.id == Campaign.hall_id)
            .join(CinemaLocation, CinemaLocation.id == CinemaHall.location_id)
            .join(City, City.id == CinemaLocation.city_id)
        )

    def _assert_status(
        self,
        campaign: Campaign,
        allowed: set[CampaignStatus],
        action: str,
    ) -> None:
        if campaign.status not in allowed:
            allowed_str = ", ".join(s.value for s in allowed)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot {action} a campaign with status '{campaign.status}' (allowed: {allowed_str})",
            )

    def _validate_slot_time_ordering(
        self,
        slot_starts_at: datetime,
        slot_ends_at: datetime,
    ) -> None:
        if slot_ends_at <= slot_starts_at:
            raise HTTPException(400, "slot_ends_at must be after slot_starts_at")

    def _campaign_to_dict(self, row: object) -> dict:
        c: Campaign = row[0]  # type: ignore[index]
        return {
            "id": c.id,
            "cinema_id": c.cinema_id,
            "hall_id": c.hall_id,
            "cinema_name": row[1],  # type: ignore[index]
            "hall_name": row[2],  # type: ignore[index]
            "hall_capacity": row[3],  # type: ignore[index]
            "city_id": row[4],  # type: ignore[index]
            "city_name": row[5],  # type: ignore[index]
            "location_name": row[6],  # type: ignore[index]
            "title": c.title,
            "description": c.description,
            "status": c.status,
            "voting_starts_at": c.voting_starts_at,
            "voting_ends_at": c.voting_ends_at,
            "voting_duration_days": c.voting_duration_days,
            "slot_starts_at": c.slot_starts_at,
            "slot_ends_at": c.slot_ends_at,
            "decision_days_before_screening": c.decision_days_before_screening,
            "min_tickets_to_confirm": c.min_tickets_to_confirm,
            "max_tickets": c.max_tickets,
            "ticket_price_cents": c.ticket_price_cents,
            "winning_movie_id": c.winning_movie_id,
            "resolved_at": c.resolved_at,
        }

    async def _execute_with_retry(self, session: AsyncSession, operation):
        for attempt in range(2):
            try:
                return await operation()
            except (DBAPIError, PostgresConnectionError, AsyncpgInterfaceError, OSError) as exc:
                if not self._is_retryable_disconnect(exc) or attempt == 1:
                    raise
                await session.close()

    def _is_retryable_disconnect(self, exc: Exception) -> bool:
        if isinstance(exc, (PostgresConnectionError, AsyncpgInterfaceError, ConnectionResetError)):
            return True
        if isinstance(exc, DBAPIError) and getattr(exc, "connection_invalidated", False):
            return True
        message = str(exc).lower()
        return (
            "connection was closed in the middle of operation" in message
            or "connectiondoesnotexisterror" in message
            or "forcibly closed by the remote host" in message
        )
