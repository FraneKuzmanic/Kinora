import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.campaign import Campaign
from app.models.cinema import Cinema
from app.models.email_outbox import EmailRecipientKind
from app.models.movie import Movie
from app.models.private_booking import PrivateBookingRequest
from app.notifications.repository import EmailOutboxRepository
from app.notifications.schemas import (
    MovieRequestArrivedPayload,
    PaymentOutcomePayload,
    PrivateBookingReviewedPayload,
    PrivateBookingSubmittedPayload,
    RefundOutcomePayload,
    ScreeningOutcomePayload,
)
from app.notifications.types import DEFAULT_MAX_ATTEMPTS, NotificationEvent, NotificationTemplate


logger = logging.getLogger(__name__)


class NotificationService:
    """Enqueue domain notifications into the retryable outbox."""

    def __init__(self, repository: EmailOutboxRepository | None = None) -> None:
        self._repository = repository or EmailOutboxRepository()

    async def enqueue_private_booking_submitted(
        self,
        session: AsyncSession,
        booking: PrivateBookingRequest,
        *,
        email_notification: str | None = None,
    ) -> None:
        payload = PrivateBookingSubmittedPayload(
            booking_id=booking.id,
            cinema_id=booking.cinema_id,
            group_size=booking.group_size,
            preferred_start_at=booking.preferred_start_at,
            preferred_end_at=booking.preferred_end_at,
            notes=booking.notes,
            cancel_url=self.build_private_booking_cancel_link_url(str(booking.id)),
        ).model_dump(mode="json")

        audience_email = email_notification or await self._get_audience_email(
            session, str(booking.requester_user_id)
        )
        await self._repository.enqueue(
            session,
            event_type=NotificationEvent.private_booking_submitted.value,
            template_key=NotificationTemplate.private_booking_submitted_audience.value,
            recipient_kind=EmailRecipientKind.audience,
            to_email=audience_email,
            payload=payload,
            max_attempts=DEFAULT_MAX_ATTEMPTS,
        )
        await self._dispatch_inline_if_enabled(session)

    async def enqueue_private_booking_reviewed(
        self,
        session: AsyncSession,
        booking: PrivateBookingRequest,
        *,
        email_notification: str | None = None,
    ) -> None:
        payload = PrivateBookingReviewedPayload(
            booking_id=booking.id,
            status=booking.status.value if hasattr(booking.status, "value") else str(booking.status),
            quoted_price_cents=booking.quoted_price_cents,
            currency=booking.currency,
            offered_start_at=booking.offered_start_at,
            offered_end_at=booking.offered_end_at,
            cinema_response_message=booking.cinema_response_message,
            booking_url=self.build_private_booking_url(),
            cancel_url=self.build_private_booking_cancel_link_url(str(booking.id)),
        ).model_dump(mode="json")
        audience_email = email_notification or await self._get_audience_email(
            session, str(booking.requester_user_id)
        )
        await self._repository.enqueue(
            session,
            event_type=NotificationEvent.private_booking_reviewed.value,
            template_key=NotificationTemplate.private_booking_reviewed_audience.value,
            recipient_kind=EmailRecipientKind.audience,
            to_email=audience_email,
            payload=payload,
            max_attempts=DEFAULT_MAX_ATTEMPTS,
        )
        await self._dispatch_inline_if_enabled(session)

    async def enqueue_payment_succeeded(
        self,
        session: AsyncSession,
        *,
        audience_user_id: str,
        order_id: str,
        payment_id: str,
        amount_cents: int,
        currency: str,
        admission_id: str | None = None,
        email_notification: str | None = None,
        description: str | None = None,
        quantity: int | None = None,
        refund_url: str | None = None,
    ) -> None:
        await self._enqueue_payment_event(
            session,
            event_type=NotificationEvent.payment_succeeded,
            template_key=NotificationTemplate.payment_succeeded,
            audience_user_id=audience_user_id,
            order_id=order_id,
            payment_id=payment_id,
            admission_id=admission_id,
            amount_cents=amount_cents,
            currency=currency,
            reason=None,
            email_notification=email_notification,
            description=description,
            quantity=quantity,
            refund_url=refund_url,
        )

    async def enqueue_payment_failed(
        self,
        session: AsyncSession,
        *,
        audience_user_id: str,
        order_id: str,
        payment_id: str,
        amount_cents: int,
        currency: str,
        reason: str | None,
    ) -> None:
        await self._enqueue_payment_event(
            session,
            event_type=NotificationEvent.payment_failed,
            template_key=NotificationTemplate.payment_failed,
            audience_user_id=audience_user_id,
            order_id=order_id,
            payment_id=payment_id,
            admission_id=None,
            amount_cents=amount_cents,
            currency=currency,
            reason=reason,
            email_notification=None,
            description=None,
            quantity=None,
            refund_url=None,
        )

    async def enqueue_refund_succeeded(
        self,
        session: AsyncSession,
        *,
        audience_user_id: str,
        refund_id: str,
        payment_id: str,
        amount_cents: int,
        currency: str,
    ) -> None:
        await self._enqueue_refund_event(
            session,
            event_type=NotificationEvent.refund_succeeded,
            template_key=NotificationTemplate.refund_succeeded,
            audience_user_id=audience_user_id,
            refund_id=refund_id,
            payment_id=payment_id,
            amount_cents=amount_cents,
            currency=currency,
            reason=None,
        )

    async def enqueue_refund_failed(
        self,
        session: AsyncSession,
        *,
        audience_user_id: str,
        refund_id: str,
        payment_id: str,
        amount_cents: int,
        currency: str,
        reason: str | None,
    ) -> None:
        await self._enqueue_refund_event(
            session,
            event_type=NotificationEvent.refund_failed,
            template_key=NotificationTemplate.refund_failed,
            audience_user_id=audience_user_id,
            refund_id=refund_id,
            payment_id=payment_id,
            amount_cents=amount_cents,
            currency=currency,
            reason=reason,
        )

    async def enqueue_screening_confirmed(
        self,
        session: AsyncSession,
        campaign: Campaign,
        *,
        email_notification: str | None = None,
    ) -> None:
        await self._enqueue_screening_outcome(
            session,
            campaign=campaign,
            event_type=NotificationEvent.screening_confirmed,
            template_key=NotificationTemplate.screening_confirmed,
            reason=None,
            email_notification=email_notification,
        )

    async def enqueue_screening_cancelled(
        self,
        session: AsyncSession,
        campaign: Campaign,
        *,
        reason: str | None = None,
        email_notification: str | None = None,
    ) -> None:
        await self._enqueue_screening_outcome(
            session,
            campaign=campaign,
            event_type=NotificationEvent.screening_cancelled,
            template_key=NotificationTemplate.screening_cancelled,
            reason=reason,
            email_notification=email_notification,
        )

    async def enqueue_movie_request_arrived_in_campaign(
        self,
        session: AsyncSession,
        *,
        recommendation_id: uuid.UUID,
        audience_user_id: uuid.UUID,
        requested_movie_title: str,
        requester_name: str,
        campaign: Campaign,
        email_notification: str | None = None,
    ) -> str:
        audience_email = email_notification or await self._get_audience_email(
            session, str(audience_user_id)
        )
        payload = MovieRequestArrivedPayload(
            recommendation_id=recommendation_id,
            requested_movie_title=requested_movie_title or "Requested movie",
            requested_by_name=requester_name,
            campaign_id=campaign.id,
            campaign_title=campaign.title,
            campaign_url=self.build_campaign_url(str(campaign.id)),
        ).model_dump(mode="json")
        await self._repository.enqueue(
            session,
            event_type=NotificationEvent.movie_request_arrived_in_campaign.value,
            template_key=NotificationTemplate.movie_request_arrived_in_campaign.value,
            recipient_kind=EmailRecipientKind.audience,
            to_email=audience_email,
            payload=payload,
            max_attempts=DEFAULT_MAX_ATTEMPTS,
        )
        await self._dispatch_inline_if_enabled(session)
        return audience_email

    def build_campaign_url(self, campaign_id: str) -> str:
        return f"{settings.client_url.rstrip('/')}/campaigns/{campaign_id}"

    def build_private_booking_url(self) -> str:
        return f"{settings.client_url.rstrip('/')}/private-booking"

    def build_private_booking_cancel_link_url(self, booking_id: str) -> str:
        base_url = settings.api_public_url.rstrip("/")
        api_prefix = settings.api_v1_prefix.strip("/")
        return f"{base_url}/{api_prefix}/private-bookings/{booking_id}/cancel-link"

    def build_private_booking_cancel_confirmation_url(self, booking_id: str) -> str:
        return (
            f"{settings.client_url.rstrip('/')}/private-booking"
            f"?source=email&booking_id={booking_id}"
        )

    async def _enqueue_payment_event(
        self,
        session: AsyncSession,
        *,
        event_type: NotificationEvent,
        template_key: NotificationTemplate,
        audience_user_id: str,
        order_id: str,
        payment_id: str,
        admission_id: str | None,
        amount_cents: int,
        currency: str,
        reason: str | None,
        email_notification: str | None,
        description: str | None,
        quantity: int | None,
        refund_url: str | None,
    ) -> None:
        audience_email = email_notification or await self._get_audience_email(session, audience_user_id)
        payload = PaymentOutcomePayload(
            order_id=uuid.UUID(order_id),
            payment_id=uuid.UUID(payment_id),
            admission_id=uuid.UUID(admission_id) if admission_id else None,
            amount_cents=amount_cents,
            currency=currency,
            description=description,
            quantity=quantity,
            refund_url=refund_url,
            reason=reason,
        ).model_dump(mode="json")
        await self._repository.enqueue(
            session,
            event_type=event_type.value,
            template_key=template_key.value,
            recipient_kind=EmailRecipientKind.audience,
            to_email=audience_email,
            payload=payload,
            max_attempts=DEFAULT_MAX_ATTEMPTS,
        )
        await self._dispatch_inline_if_enabled(session)

    async def _enqueue_refund_event(
        self,
        session: AsyncSession,
        *,
        event_type: NotificationEvent,
        template_key: NotificationTemplate,
        audience_user_id: str,
        refund_id: str,
        payment_id: str,
        amount_cents: int,
        currency: str,
        reason: str | None,
    ) -> None:
        audience_email = await self._get_audience_email(session, audience_user_id)
        payload = RefundOutcomePayload(
            refund_id=uuid.UUID(refund_id),
            payment_id=uuid.UUID(payment_id),
            amount_cents=amount_cents,
            currency=currency,
            reason=reason,
        ).model_dump(mode="json")
        await self._repository.enqueue(
            session,
            event_type=event_type.value,
            template_key=template_key.value,
            recipient_kind=EmailRecipientKind.audience,
            to_email=audience_email,
            payload=payload,
            max_attempts=DEFAULT_MAX_ATTEMPTS,
        )
        await self._dispatch_inline_if_enabled(session)

    async def _enqueue_screening_outcome(
        self,
        session: AsyncSession,
        *,
        campaign: Campaign,
        event_type: NotificationEvent,
        template_key: NotificationTemplate,
        reason: str | None,
        email_notification: str | None,
    ) -> None:
        cinema_email = email_notification or await self._get_cinema_email(session, campaign.cinema_id)
        movie_title = None
        if campaign.winning_movie_id:
            movie_result = await session.execute(select(Movie.title).where(Movie.id == campaign.winning_movie_id))
            movie_title = movie_result.scalar_one_or_none()

        payload = ScreeningOutcomePayload(
            campaign_id=campaign.id,
            cinema_id=campaign.cinema_id,
            title=campaign.title,
            slot_starts_at=campaign.slot_starts_at,
            slot_ends_at=campaign.slot_ends_at,
            movie_title=movie_title,
            reason=reason,
        ).model_dump(mode="json")
        await self._repository.enqueue(
            session,
            event_type=event_type.value,
            template_key=template_key.value,
            recipient_kind=EmailRecipientKind.cinema_partner,
            to_email=cinema_email,
            payload=payload,
            max_attempts=DEFAULT_MAX_ATTEMPTS,
        )
        await self._dispatch_inline_if_enabled(session)

    async def _dispatch_inline_if_enabled(self, session: AsyncSession) -> None:
        if not settings.dispatch_notifications_inline:
            return
        if not (settings.resend_api_key and settings.email_from):
            logger.warning("Inline notification dispatch skipped because Resend is not configured")
            return

        from app.notifications.dispatcher import EmailOutboxDispatcher
        from app.notifications.providers.resend import ResendEmailProvider

        provider = ResendEmailProvider(settings.resend_api_key, settings.email_from)
        dispatcher = EmailOutboxDispatcher(provider=provider)
        try:
            await dispatcher.dispatch_batch(
                session,
                batch_size=settings.notification_batch_size,
            )
        except Exception:
            logger.exception("Inline notification dispatch failed")

    async def _get_cinema_email(self, session: AsyncSession, cinema_id: uuid.UUID) -> str:
        result = await session.execute(select(Cinema.email).where(Cinema.id == cinema_id))
        email = result.scalar_one_or_none()
        if not email:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Cinema email is not configured for notifications",
            )
        return email

    async def _get_audience_email(self, session: AsyncSession, user_id: str) -> str:
        result = await session.execute(
            text(
                """
                select email
                from auth.users
                where id = cast(:user_id as uuid)
                """
            ),
            {"user_id": user_id},
        )
        email = result.scalar_one_or_none()
        if not email:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Audience email is not configured for notifications",
            )
        return str(email)
