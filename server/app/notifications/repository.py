import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email_outbox import EmailDeliveryStatus, EmailOutbox, EmailRecipientKind


class EmailOutboxRepository:
    async def enqueue(
        self,
        session: AsyncSession,
        *,
        event_type: str,
        template_key: str,
        recipient_kind: EmailRecipientKind,
        to_email: str,
        payload: dict,
        max_attempts: int,
    ) -> EmailOutbox:
        row = EmailOutbox(
            id=uuid.uuid4(),
            event_type=event_type,
            template_key=template_key,
            recipient_kind=recipient_kind,
            to_email=to_email,
            payload=payload,
            max_attempts=max_attempts,
        )
        session.add(row)
        return row

    async def claim_due_batch(self, session: AsyncSession, *, batch_size: int) -> list[EmailOutbox]:
        statement = text(
            """
            with due_rows as (
              select id
              from public.email_outbox
              where status = 'queued'
                and next_attempt_at <= now()
              order by next_attempt_at asc, created_at asc
              limit :batch_size
              for update skip locked
            )
            update public.email_outbox as eo
            set status = 'processing',
                processing_started_at = now(),
                last_attempt_at = now(),
                attempt_count = eo.attempt_count + 1
            from due_rows
            where eo.id = due_rows.id
            returning eo.*
            """
        )
        result = await session.execute(
            select(EmailOutbox).from_statement(statement),
            {"batch_size": batch_size},
        )
        return list(result.scalars().all())

    async def mark_sent(
        self,
        session: AsyncSession,
        row: EmailOutbox,
        *,
        provider_message_id: str,
    ) -> None:
        row.status = EmailDeliveryStatus.sent
        row.provider_message_id = provider_message_id
        row.sent_at = datetime.now(UTC)
        row.processing_started_at = None
        row.last_error = None
        session.add(row)

    async def reschedule(
        self,
        session: AsyncSession,
        row: EmailOutbox,
        *,
        error_message: str,
        delay_seconds: int,
    ) -> None:
        row.status = EmailDeliveryStatus.queued
        row.last_error = error_message
        row.processing_started_at = None
        row.next_attempt_at = datetime.now(UTC) + timedelta(seconds=delay_seconds)
        session.add(row)

    async def mark_failed(self, session: AsyncSession, row: EmailOutbox, *, error_message: str) -> None:
        row.status = EmailDeliveryStatus.failed
        row.last_error = error_message
        row.processing_started_at = None
        session.add(row)

    async def list_by_event(self, session: AsyncSession, *, event_type: str) -> list[EmailOutbox]:
        result = await session.execute(
            select(EmailOutbox)
            .where(EmailOutbox.event_type == event_type)
            .order_by(EmailOutbox.created_at.asc())
        )
        return list(result.scalars().all())
