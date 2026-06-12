import base64
from uuid import UUID

from app.core.config import settings
from app.models.email_outbox import EmailOutbox
from app.notifications.attachments import EmailAttachment
from app.notifications.providers.resend import EmailDeliveryError, ResendEmailProvider
from app.notifications.repository import EmailOutboxRepository
from app.notifications.templates import render_email_message
from app.notifications.types import DeliveryErrorKind, NotificationTemplate
from app.services.admission_pdf_service import AdmissionPdfService


class EmailOutboxDispatcher:
    def __init__(
        self,
        repository: EmailOutboxRepository | None = None,
        provider: ResendEmailProvider | None = None,
    ) -> None:
        self._repository = repository or EmailOutboxRepository()
        self._provider = provider

    async def dispatch_batch(self, session, *, batch_size: int) -> int:
        rows = await self._repository.claim_due_batch(session, batch_size=batch_size)
        if not rows:
            await session.commit()
            return 0

        for row in rows:
            await self._dispatch_one(session, row)

        await session.commit()
        return len(rows)

    async def _dispatch_one(self, session, row: EmailOutbox) -> None:
        if self._provider is None:
            raise RuntimeError("Email provider is not configured")

        try:
            message = render_email_message(row.template_key, row.payload)
        except (ValueError, KeyError) as exc:
            await self._repository.mark_failed(
                session,
                row,
                error_message=f"Unsupported email template or payload: {exc}",
            )
            return

        try:
            attachments = await self._build_attachments(session, row)
        except Exception as exc:
            await self._reschedule_or_fail(session, row, error_message=str(exc), transient=True)
            return

        try:
            result = await self._provider.send_email(
                row.to_email,
                message.subject,
                message.text,
                html_body=message.html,
                attachments=attachments,
            )
        except EmailDeliveryError as exc:
            await self._reschedule_or_fail(
                session,
                row,
                error_message=str(exc),
                transient=exc.kind is DeliveryErrorKind.transient,
            )
            return

        await self._repository.mark_sent(
            session,
            row,
            provider_message_id=result.provider_message_id,
        )

    async def _build_attachments(self, session, row: EmailOutbox) -> list[EmailAttachment] | None:
        if row.template_key != NotificationTemplate.payment_succeeded.value:
            return None
        admission_id = row.payload.get("admission_id")
        if not admission_id:
            return None

        # Validate UUID early so unsupported legacy payloads fail before touching storage.
        admission_uuid = UUID(str(admission_id))
        pdf = await AdmissionPdfService().get_or_generate_by_id(
            session,
            admission_uuid,
            settings.pdf_storage_path,
        )
        return [
            EmailAttachment(
                filename=f"kinora-ticket-{admission_uuid}.pdf",
                content=base64.b64encode(pdf.bytes).decode("ascii"),
                content_type="application/pdf",
            )
        ]

    async def _reschedule_or_fail(
        self,
        session,
        row: EmailOutbox,
        *,
        error_message: str,
        transient: bool,
    ) -> None:
        should_retry = transient and row.attempt_count < row.max_attempts
        if should_retry:
            delay_seconds = min(300, 2 ** max(row.attempt_count, 1))
            await self._repository.reschedule(
                session,
                row,
                error_message=error_message,
                delay_seconds=delay_seconds,
            )
        else:
            await self._repository.mark_failed(session, row, error_message=error_message)
