import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign
from app.models.campaign import CampaignMovie
from app.models.cinema import Cinema, CinemaLocation
from app.models.geography import City
from app.models.movie import Movie
from app.models.movie_recommendation import MovieRecommendation, RecommendationStatus
from app.models.profile import Profile
from app.notifications.service import NotificationService
from app.schemas.movie_recommendation import MovieRecommendationCreate, MovieRecommendationModerationUpdate
from app.services.loyalty_service import (
    LoyaltyService,
    POINTS_RECOMMENDATION,
    POINTS_RECOMMENDATION_ACCEPTED,
)


class MovieRecommendationService:
    """Recommendation workflows used by cinema admins and notifications."""

    def __init__(self, notification_service: NotificationService | None = None) -> None:
        self._notification_service = notification_service or NotificationService()

    async def get_recommendation(
        self,
        session: AsyncSession,
        recommendation_id: str,
    ) -> MovieRecommendation | None:
        result = await session.execute(
            select(MovieRecommendation).where(MovieRecommendation.id == recommendation_id)
        )
        return result.scalar_one_or_none()

    async def create_recommendation(
        self,
        session: AsyncSession,
        *,
        user_id: str,
        payload: MovieRecommendationCreate,
    ) -> MovieRecommendation:
        if not payload.movie_id and not payload.title:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Provide either movie_id or a custom title",
            )

        movie_title = payload.title
        if payload.movie_id:
            movie_result = await session.execute(
                select(Movie).where(Movie.id == payload.movie_id)
            )
            movie = movie_result.scalar_one_or_none()
            if not movie:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Movie not found",
                )
            if not movie_title:
                movie_title = movie.title

        if payload.cinema_id:
            cinema_result = await session.execute(
                select(Cinema).where(Cinema.id == payload.cinema_id)
            )
            cinema = cinema_result.scalar_one_or_none()
            if not cinema:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Cinema not found",
                )

        recommendation = MovieRecommendation(
            id=uuid.uuid4(),
            user_id=uuid.UUID(user_id),
            cinema_id=payload.cinema_id,
            city_id=payload.city_id,
            movie_id=payload.movie_id,
            title=movie_title,
            message=payload.message,
            status=RecommendationStatus.new,
            created_at=datetime.now(UTC),
        )
        session.add(recommendation)
        await session.commit()
        await session.refresh(recommendation)
        await LoyaltyService().award_points(
            session,
            user_id=recommendation.user_id,
            points=POINTS_RECOMMENDATION,
            reason="Movie recommendation",
            source_type="movie_recommendation",
            source_id=recommendation.id,
            cinema_id=recommendation.cinema_id,
            created_at=recommendation.created_at,
        )
        await LoyaltyService().evaluate_badges(session, recommendation.user_id)
        await session.commit()
        return recommendation

    async def list_admin_recommendations(
        self,
        session: AsyncSession,
        *,
        cinema_id: uuid.UUID,
        status_filter: str | None = None,
    ) -> list[dict]:
        rows = await self._fetch_visible_recommendations(
            session,
            cinema_id=cinema_id,
            recommendation_id=None,
            status_filter=status_filter,
        )
        return [self._row_to_admin_read(row) for row in rows]

    async def moderate_recommendation(
        self,
        session: AsyncSession,
        *,
        cinema_id: uuid.UUID,
        recommendation_id: str,
        payload: MovieRecommendationModerationUpdate,
    ) -> dict:
        rows = await self._fetch_visible_recommendations(
            session,
            cinema_id=cinema_id,
            recommendation_id=recommendation_id,
            status_filter=None,
        )
        if not rows:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recommendation not found")

        row = rows[0]
        recommendation: MovieRecommendation = row[0]
        current_status = self._status_value(recommendation.status)
        target_status = RecommendationStatus(payload.status)
        allowed = {
            RecommendationStatus.new: {
                RecommendationStatus.reviewed,
                RecommendationStatus.accepted,
                RecommendationStatus.rejected,
            },
            RecommendationStatus.reviewed: {
                RecommendationStatus.reviewed,
                RecommendationStatus.accepted,
                RecommendationStatus.rejected,
            },
            RecommendationStatus.accepted: {RecommendationStatus.accepted},
            RecommendationStatus.rejected: {RecommendationStatus.rejected},
        }
        if target_status not in allowed[RecommendationStatus(current_status)]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot transition recommendation from {current_status} to {target_status.value}",
            )

        should_commit = recommendation.status != target_status

        if target_status == RecommendationStatus.accepted:
            resolved_movie = await self._resolve_moderated_movie(
                session,
                recommendation=recommendation,
                payload=payload,
            )
            if recommendation.movie_id != resolved_movie.id or recommendation.title != resolved_movie.title:
                should_commit = True
                recommendation.movie_id = resolved_movie.id
                recommendation.title = resolved_movie.title

        if should_commit:
            recommendation.status = target_status
            session.add(recommendation)
            await session.commit()
            await session.refresh(recommendation)
            if target_status == RecommendationStatus.accepted and recommendation.user_id:
                await LoyaltyService().award_points(
                    session,
                    user_id=recommendation.user_id,
                    points=POINTS_RECOMMENDATION_ACCEPTED,
                    reason="Accepted movie recommendation",
                    source_type="movie_recommendation_accepted",
                    source_id=recommendation.id,
                    cinema_id=recommendation.cinema_id,
                    created_at=datetime.now(UTC),
                )
                await LoyaltyService().evaluate_badges(session, recommendation.user_id)
                await session.commit()
            rows = await self._fetch_visible_recommendations(
                session,
                cinema_id=cinema_id,
                recommendation_id=recommendation.id,
                status_filter=None,
            )
            row = rows[0]

        return self._row_to_admin_read(row)

    async def enqueue_campaign_arrival_notifications(
        self,
        session: AsyncSession,
        *,
        campaign: Campaign,
        movie_order: dict[uuid.UUID, int] | None = None,
    ) -> int:
        rows = await self._fetch_visible_recommendations_for_campaign(
            session,
            cinema_id=campaign.cinema_id,
            campaign_id=campaign.id,
        )

        queued_count = 0
        seen_user_ids: set[uuid.UUID] = set()
        ordered_rows = sorted(
            rows,
            key=lambda row: (
                movie_order.get(row.campaign_movie_movie_id, 10_000) if movie_order else 10_000,
                row.created_at,
                row.id,
            ),
        )
        for row in ordered_rows:
            if row.user_id is None or row.user_id in seen_user_ids:
                continue

            seen_user_ids.add(row.user_id)
            await self._notification_service.enqueue_movie_request_arrived_in_campaign(
                session,
                recommendation_id=row.id,
                audience_user_id=row.user_id,
                requested_movie_title=row.movie_title or row.title or "Requested movie",
                requester_name=row.requester_display_name or "movie fan",
                campaign=campaign,
            )
            queued_count += 1

        return queued_count

    async def _fetch_visible_recommendations(
        self,
        session: AsyncSession,
        *,
        cinema_id: uuid.UUID,
        recommendation_id: str | uuid.UUID | None,
        status_filter: str | None,
    ):
        city_rows = await session.execute(
            select(CinemaLocation.city_id)
            .where(
                CinemaLocation.cinema_id == cinema_id,
                CinemaLocation.city_id.is_not(None),
            )
            .distinct()
        )
        city_ids = [city_id for city_id in city_rows.scalars().all() if city_id is not None]

        visibility_filters = [MovieRecommendation.cinema_id == cinema_id]
        if city_ids:
            visibility_filters.append(
                and_(
                    MovieRecommendation.cinema_id.is_(None),
                    MovieRecommendation.city_id.in_(city_ids),
                )
            )

        statement = (
            select(
                MovieRecommendation,
                Movie.title.label("movie_title"),
                Cinema.name.label("cinema_name"),
                City.name.label("city_name"),
                Profile.display_name.label("requester_display_name"),
            )
            .outerjoin(Movie, Movie.id == MovieRecommendation.movie_id)
            .outerjoin(Cinema, Cinema.id == MovieRecommendation.cinema_id)
            .outerjoin(City, City.id == MovieRecommendation.city_id)
            .outerjoin(Profile, Profile.user_id == MovieRecommendation.user_id)
            .where(or_(*visibility_filters))
            .order_by(MovieRecommendation.created_at.desc(), MovieRecommendation.id.desc())
        )
        if recommendation_id is not None:
            statement = statement.where(MovieRecommendation.id == recommendation_id)
        if status_filter is not None:
            try:
                recommendation_status = RecommendationStatus(status_filter)
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Invalid recommendation status filter",
                ) from exc
            statement = statement.where(MovieRecommendation.status == recommendation_status)

        result = await session.execute(statement)
        return list(result.all())

    async def _fetch_visible_recommendations_for_campaign(
        self,
        session: AsyncSession,
        *,
        cinema_id: uuid.UUID,
        campaign_id: uuid.UUID,
    ):
        city_rows = await session.execute(
            select(CinemaLocation.city_id)
            .where(
                CinemaLocation.cinema_id == cinema_id,
                CinemaLocation.city_id.is_not(None),
            )
            .distinct()
        )
        city_ids = [city_id for city_id in city_rows.scalars().all() if city_id is not None]

        visibility_filters = [MovieRecommendation.cinema_id == cinema_id]
        if city_ids:
            visibility_filters.append(
                and_(
                    MovieRecommendation.cinema_id.is_(None),
                    MovieRecommendation.city_id.in_(city_ids),
                )
            )

        statement = (
            select(
                MovieRecommendation.id,
                MovieRecommendation.user_id,
                MovieRecommendation.title,
                MovieRecommendation.created_at,
                Movie.title.label("movie_title"),
                Profile.display_name.label("requester_display_name"),
                CampaignMovie.movie_id.label("campaign_movie_movie_id"),
            )
            .join(CampaignMovie, CampaignMovie.movie_id == MovieRecommendation.movie_id)
            .outerjoin(Movie, Movie.id == MovieRecommendation.movie_id)
            .outerjoin(Profile, Profile.user_id == MovieRecommendation.user_id)
            .where(
                CampaignMovie.campaign_id == campaign_id,
                MovieRecommendation.user_id.is_not(None),
                or_(*visibility_filters),
            )
        )
        result = await session.execute(statement)
        return list(result.all())

    async def _resolve_moderated_movie(
        self,
        session: AsyncSession,
        *,
        recommendation: MovieRecommendation,
        payload: MovieRecommendationModerationUpdate,
    ) -> Movie:
        movie_id = payload.movie_id or recommendation.movie_id
        if movie_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Accepted recommendations must be linked to an existing movie",
            )

        movie_result = await session.execute(select(Movie).where(Movie.id == movie_id))
        movie = movie_result.scalar_one_or_none()
        if not movie:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found")
        return movie

    def _row_to_admin_read(self, row) -> dict:
        recommendation: MovieRecommendation = row[0]
        requested_title = row.movie_title or recommendation.title
        return {
            "id": recommendation.id,
            "user_id": recommendation.user_id,
            "cinema_id": recommendation.cinema_id,
            "city_id": recommendation.city_id,
            "movie_id": recommendation.movie_id,
            "title": recommendation.title,
            "message": recommendation.message,
            "status": self._status_value(recommendation.status),
            "created_at": recommendation.created_at,
            "movie_title": requested_title,
            "cinema_name": row.cinema_name,
            "city_name": row.city_name,
            "requester_display_name": row.requester_display_name,
        }

    def _status_value(self, value: RecommendationStatus | str) -> str:
        return value.value if isinstance(value, RecommendationStatus) else str(value)
