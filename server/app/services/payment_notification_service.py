from sqlalchemy.ext.asyncio import AsyncSession

from app.notifications.service import NotificationService


class PaymentNotificationService:
    """Hook service for payment and refund workflows until Stripe handlers are added."""

    def __init__(self, notification_service: NotificationService | None = None) -> None:
        self._notification_service = notification_service or NotificationService()

    async def handle_payment_succeeded(
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
        await self._notification_service.enqueue_payment_succeeded(
            session,
            audience_user_id=audience_user_id,
            order_id=order_id,
            payment_id=payment_id,
            admission_id=admission_id,
            amount_cents=amount_cents,
            currency=currency,
            email_notification=email_notification,
            description=description,
            quantity=quantity,
            refund_url=refund_url,
        )

    async def handle_payment_failed(
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
        await self._notification_service.enqueue_payment_failed(
            session,
            audience_user_id=audience_user_id,
            order_id=order_id,
            payment_id=payment_id,
            amount_cents=amount_cents,
            currency=currency,
            reason=reason,
        )

    async def handle_refund_succeeded(
        self,
        session: AsyncSession,
        *,
        audience_user_id: str,
        refund_id: str,
        payment_id: str,
        amount_cents: int,
        currency: str,
    ) -> None:
        await self._notification_service.enqueue_refund_succeeded(
            session,
            audience_user_id=audience_user_id,
            refund_id=refund_id,
            payment_id=payment_id,
            amount_cents=amount_cents,
            currency=currency,
        )

    async def handle_refund_failed(
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
        await self._notification_service.enqueue_refund_failed(
            session,
            audience_user_id=audience_user_id,
            refund_id=refund_id,
            payment_id=payment_id,
            amount_cents=amount_cents,
            currency=currency,
            reason=reason,
        )
