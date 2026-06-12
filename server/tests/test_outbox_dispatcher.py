from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.models.email_outbox import EmailDeliveryStatus
from app.notifications.attachments import EmailAttachment
from app.notifications.dispatcher import EmailOutboxDispatcher
from app.notifications.providers.resend import EmailDeliveryError, EmailSendResult, ResendEmailProvider
from app.services.admission_pdf_service import AdmissionPdfService, AdmissionPdf
from app.notifications.types import DeliveryErrorKind


class FakeRepository:
    def __init__(self, rows):
        self.rows = rows
        self.sent: list[tuple[str, str]] = []
        self.rescheduled: list[tuple[str, int, str]] = []
        self.failed: list[tuple[str, str]] = []

    async def claim_due_batch(self, session, *, batch_size: int):
        return self.rows[:batch_size]

    async def mark_sent(self, session, row, *, provider_message_id: str) -> None:
        row.status = EmailDeliveryStatus.sent
        row.provider_message_id = provider_message_id
        self.sent.append((str(row.id), provider_message_id))

    async def reschedule(self, session, row, *, error_message: str, delay_seconds: int) -> None:
        row.status = EmailDeliveryStatus.queued
        self.rescheduled.append((str(row.id), delay_seconds, error_message))

    async def mark_failed(self, session, row, *, error_message: str) -> None:
        row.status = EmailDeliveryStatus.failed
        self.failed.append((str(row.id), error_message))


class FakeProvider:
    def __init__(self, *, error: EmailDeliveryError | None = None):
        self.error = error
        self.sent: list[dict] = []

    async def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        *,
        html_body: str | None = None,
        attachments: list[EmailAttachment] | None = None,
    ):
        if self.error is not None:
            raise self.error
        self.sent.append(
            {
                "to_email": to_email,
                "subject": subject,
                "body": body,
                "html_body": html_body,
                "attachments": attachments,
            }
        )
        return EmailSendResult(provider_message_id="msg_123")


class FakeSession:
    def __init__(self) -> None:
        self.commit_count = 0

    async def commit(self) -> None:
        self.commit_count += 1


def _row(*, attempt_count: int = 0, max_attempts: int = 5, admission_id: str | None = None):
    return SimpleNamespace(
        id=uuid4(),
        template_key="payment_succeeded",
        payload={
            "order_id": str(uuid4()),
            "payment_id": str(uuid4()),
            **({"admission_id": admission_id} if admission_id else {}),
            "amount_cents": 1234,
            "currency": "EUR",
        },
        to_email="user@example.com",
        attempt_count=attempt_count,
        max_attempts=max_attempts,
        status=EmailDeliveryStatus.processing,
        provider_message_id=None,
        last_error=None,
        processing_started_at=datetime.now(UTC),
    )


@pytest.mark.asyncio
async def test_dispatcher_marks_successful_send_as_sent() -> None:
    row = _row()
    repository = FakeRepository([row])
    provider = FakeProvider()
    dispatcher = EmailOutboxDispatcher(repository=repository, provider=provider)
    session = FakeSession()

    processed = await dispatcher.dispatch_batch(session, batch_size=10)

    assert processed == 1
    assert row.status == EmailDeliveryStatus.sent
    assert repository.sent == [(str(row.id), "msg_123")]
    assert provider.sent[0]["html_body"]
    assert "data:image/svg+xml;base64," not in provider.sent[0]["html_body"]
    assert provider.sent[0]["attachments"] is None
    assert session.commit_count == 1


@pytest.mark.asyncio
async def test_dispatcher_attaches_ticket_pdf_for_payment_receipt(monkeypatch) -> None:
    admission_id = uuid4()
    row = _row(admission_id=str(admission_id))
    repository = FakeRepository([row])
    provider = FakeProvider()
    dispatcher = EmailOutboxDispatcher(repository=repository, provider=provider)
    session = FakeSession()

    async def _fake_pdf(self, session, admission_id_arg, storage_root):
        assert str(admission_id_arg) == str(admission_id)
        return AdmissionPdf(bytes=b"%PDF ticket", relative_path=f"admissions/{admission_id}.pdf", generated=True)

    monkeypatch.setattr(AdmissionPdfService, "get_or_generate_by_id", _fake_pdf)

    await dispatcher.dispatch_batch(session, batch_size=10)

    attachment = provider.sent[0]["attachments"][0]
    assert attachment.filename == f"kinora-ticket-{admission_id}.pdf"
    assert attachment.content == "JVBERiB0aWNrZXQ="
    assert attachment.content_type == "application/pdf"
    assert repository.sent == [(str(row.id), "msg_123")]


@pytest.mark.asyncio
async def test_dispatcher_reschedules_when_ticket_pdf_generation_fails(monkeypatch) -> None:
    row = _row(admission_id=str(uuid4()))
    repository = FakeRepository([row])
    provider = FakeProvider()
    dispatcher = EmailOutboxDispatcher(repository=repository, provider=provider)
    session = FakeSession()

    async def _raise_pdf_error(self, session, admission_id_arg, storage_root):
        raise RuntimeError("pdf unavailable")

    monkeypatch.setattr(AdmissionPdfService, "get_or_generate_by_id", _raise_pdf_error)

    await dispatcher.dispatch_batch(session, batch_size=10)

    assert provider.sent == []
    assert row.status == EmailDeliveryStatus.queued
    assert repository.rescheduled
    assert "pdf unavailable" in repository.rescheduled[0][2]


@pytest.mark.asyncio
async def test_dispatcher_reschedules_transient_errors() -> None:
    row = _row(attempt_count=1, max_attempts=5)
    repository = FakeRepository([row])
    provider = FakeProvider(error=EmailDeliveryError("try again", DeliveryErrorKind.transient))
    dispatcher = EmailOutboxDispatcher(repository=repository, provider=provider)
    session = FakeSession()

    await dispatcher.dispatch_batch(session, batch_size=10)

    assert row.status == EmailDeliveryStatus.queued
    assert repository.rescheduled
    assert repository.rescheduled[0][1] >= 2
    assert session.commit_count == 1


@pytest.mark.asyncio
async def test_dispatcher_fails_permanent_errors_or_attempt_exhaustion() -> None:
    row = _row(attempt_count=5, max_attempts=5)
    repository = FakeRepository([row])
    provider = FakeProvider(error=EmailDeliveryError("bad request", DeliveryErrorKind.transient))
    dispatcher = EmailOutboxDispatcher(repository=repository, provider=provider)
    session = FakeSession()

    await dispatcher.dispatch_batch(session, batch_size=10)

    assert row.status == EmailDeliveryStatus.failed
    assert repository.failed == [(str(row.id), "bad request")]
    assert session.commit_count == 1


@pytest.mark.asyncio
async def test_resend_provider_serializes_attachments(monkeypatch) -> None:
    captured = {}

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"id": "msg_123"}

    class FakeClient:
        def __init__(self, timeout):
            assert timeout == 15.0

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def post(self, url, *, headers, json):
            captured["json"] = json
            return FakeResponse()

    monkeypatch.setattr("httpx.AsyncClient", FakeClient)

    result = await ResendEmailProvider("re_test", "from@example.com").send_email(
        "to@example.com",
        "Subject",
        "Text",
        html_body="<p>Text</p>",
        attachments=[
            EmailAttachment(
                filename="ticket.pdf",
                content="JVBERg==",
                content_type="application/pdf",
            )
        ],
    )

    assert result.provider_message_id == "msg_123"
    assert captured["json"]["attachments"] == [
        {
            "filename": "ticket.pdf",
            "content": "JVBERg==",
            "content_type": "application/pdf",
        }
    ]
