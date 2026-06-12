import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admission import Admission, AdmissionRedemption, AdmissionStatus
from app.models.campaign import Campaign, CampaignMovie
from app.models.movie import Movie
from app.models.screening import Screening
from app.schemas.validator import RedemptionRequest, TicketValidationRequest, TicketValidationResponse
from app.services.loyalty_service import LoyaltyService, POINTS_ATTENDANCE


class ValidatorService:
    """Ticket validation and redemption operations for validator role."""

    async def validate_admission(
        self,
        session: AsyncSession,
        qr_token: str,
        validator_user_id: str,
        payload: TicketValidationRequest | None = None,
    ) -> TicketValidationResponse:
        admission = await self._get_admission_by_reference(session, qr_token)
        if not admission:
            return TicketValidationResponse(
                valid=False,
                redeemable=False,
                reason="Admission not found",
            )
        cinema_id = await self._get_admission_cinema_id(session, admission)

        existing = await self._get_existing_redemption(session, admission.id)
        context = await self._get_ticket_context(session, admission)
        status_value = self._enum_value(admission.status)
        type_value = self._enum_value(admission.type)

        if not await self._has_validator_permission(session, validator_user_id, cinema_id):
            return TicketValidationResponse(
                valid=True,
                redeemable=False,
                reason="Validator is not assigned to this ticket's cinema",
                admission_id=admission.id,
                admission_status=status_value,
                admission_type=type_value,
                quantity=admission.quantity,
                screening_id=admission.screening_id,
                campaign_movie_id=admission.campaign_movie_id,
                movie_title=context.get("movie_title"),
                starts_at=context.get("starts_at"),
                ends_at=context.get("ends_at"),
            )

        if existing:
            return TicketValidationResponse(
                valid=True,
                redeemable=False,
                reason="Admission already redeemed",
                admission_id=admission.id,
                admission_status=status_value,
                admission_type=type_value,
                quantity=admission.quantity,
                screening_id=admission.screening_id,
                campaign_movie_id=admission.campaign_movie_id,
                movie_title=context.get("movie_title"),
                starts_at=context.get("starts_at"),
                ends_at=context.get("ends_at"),
                redeemed_at=existing.redeemed_at,
                redemption_id=existing.id,
            )

        if status_value != AdmissionStatus.active.value:
            return TicketValidationResponse(
                valid=True,
                redeemable=False,
                reason=f"Admission is not redeemable (status: {status_value})",
                admission_id=admission.id,
                admission_status=status_value,
                admission_type=type_value,
                quantity=admission.quantity,
                screening_id=admission.screening_id,
                campaign_movie_id=admission.campaign_movie_id,
                movie_title=context.get("movie_title"),
                starts_at=context.get("starts_at"),
                ends_at=context.get("ends_at"),
            )

        return TicketValidationResponse(
            valid=True,
            redeemable=True,
            reason=None,
            admission_id=admission.id,
            admission_status=status_value,
            admission_type=type_value,
            quantity=admission.quantity,
            screening_id=admission.screening_id,
            campaign_movie_id=admission.campaign_movie_id,
            movie_title=context.get("movie_title"),
            starts_at=context.get("starts_at"),
            ends_at=context.get("ends_at"),
        )

    async def redeem_admission(
        self,
        session: AsyncSession,
        qr_token: str,
        validator_user_id: str,
        payload: RedemptionRequest,
    ) -> AdmissionRedemption:
        admission = await self._get_admission_by_reference(session, qr_token)
        if not admission:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admission not found")
        cinema_id = await self._get_admission_cinema_id(session, admission)
        await self._assert_validator_permission(session, validator_user_id, cinema_id)

        status_value = self._enum_value(admission.status)
        if status_value != AdmissionStatus.active.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Admission is not redeemable (status: {status_value})",
            )

        existing = await self._get_existing_redemption(session, admission.id)
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Admission already redeemed")

        redemption = AdmissionRedemption(
            id=uuid.uuid4(),
            admission_id=admission.id,
            redeemed_at=datetime.now(UTC),
            validator_user_id=uuid.UUID(validator_user_id),
            location_id=payload.location_id,
            hall_id=payload.hall_id,
            device_info=payload.device_info or {},
        )
        session.add(redemption)
        await session.commit()
        await session.refresh(redemption)
        await LoyaltyService().award_points(
            session,
            user_id=admission.buyer_user_id,
            points=POINTS_ATTENDANCE,
            reason="Ticket attended",
            source_type="ticket_attendance",
            source_id=redemption.id,
            cinema_id=cinema_id,
            created_at=redemption.redeemed_at,
        )
        await LoyaltyService().evaluate_badges(session, admission.buyer_user_id)
        await session.commit()
        return redemption

    async def _get_admission_by_reference(
        self,
        session: AsyncSession,
        reference: str,
    ) -> Admission | None:
        cleaned_reference = reference.strip()
        conditions = [Admission.qr_token == cleaned_reference]

        try:
            conditions.append(Admission.id == uuid.UUID(cleaned_reference))
        except ValueError:
            pass

        admission_result = await session.execute(select(Admission).where(or_(*conditions)))
        return admission_result.scalar_one_or_none()

    async def _get_existing_redemption(
        self,
        session: AsyncSession,
        admission_id: uuid.UUID,
    ) -> AdmissionRedemption | None:
        redemption_result = await session.execute(
            select(AdmissionRedemption).where(AdmissionRedemption.admission_id == admission_id)
        )
        return redemption_result.scalar_one_or_none()

    async def _get_ticket_context(
        self,
        session: AsyncSession,
        admission: Admission,
    ) -> dict[str, Any]:
        if admission.screening_id:
            result = await session.execute(
                select(Movie.title, Screening.starts_at, Screening.ends_at)
                .join(Movie, Movie.id == Screening.movie_id)
                .where(Screening.id == admission.screening_id)
            )
            row = result.one_or_none()
            if row:
                return {
                    "movie_title": row.title,
                    "starts_at": row.starts_at,
                    "ends_at": row.ends_at,
                }

        if admission.campaign_movie_id:
            result = await session.execute(
                select(Movie.title)
                .join(CampaignMovie, CampaignMovie.movie_id == Movie.id)
                .where(CampaignMovie.id == admission.campaign_movie_id)
            )
            movie_title = result.scalar_one_or_none()
            if movie_title:
                return {"movie_title": movie_title}

        return {}

    async def _get_admission_cinema_id(self, session: AsyncSession, admission: Admission) -> uuid.UUID:
        if admission.screening_id:
            result = await session.execute(
                select(Screening.cinema_id).where(Screening.id == admission.screening_id)
            )
            cinema_id = result.scalar_one_or_none()
            if cinema_id:
                return cinema_id

        if admission.campaign_movie_id:
            result = await session.execute(
                select(Campaign.cinema_id)
                .join(CampaignMovie, CampaignMovie.campaign_id == Campaign.id)
                .where(CampaignMovie.id == admission.campaign_movie_id)
            )
            cinema_id = result.scalar_one_or_none()
            if cinema_id:
                return cinema_id

        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Admission is not linked to a cinema")

    async def _has_validator_permission(
        self,
        session: AsyncSession,
        validator_user_id: str,
        cinema_id: uuid.UUID,
    ) -> bool:
        from app.services.cinema_service import CinemaService

        return await CinemaService().has_active_validator_permission(
            session,
            cinema_id=cinema_id,
            validator_user_id=uuid.UUID(validator_user_id),
        )

    async def _assert_validator_permission(
        self,
        session: AsyncSession,
        validator_user_id: str,
        cinema_id: uuid.UUID,
    ) -> None:
        if not await self._has_validator_permission(session, validator_user_id, cinema_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Validator is not assigned to this cinema",
            )

    def _enum_value(self, value: object) -> str:
        return str(value.value if hasattr(value, "value") else value)
