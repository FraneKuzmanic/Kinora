from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.models.email_outbox import EmailRecipientKind
from app.notifications.service import NotificationService
from app.notifications.templates import render_email_content, render_email_message
from app.notifications.types import NotificationEvent, NotificationTemplate
from app.services.payment_notification_service import PaymentNotificationService


class RecordingRepository:
    def __init__(self) -> None:
        self.rows: list[dict] = []

    async def enqueue(self, session, **kwargs):
        self.rows.append(kwargs)
        return SimpleNamespace(**kwargs)


@pytest.mark.asyncio
async def test_private_booking_submitted_enqueues_audience_notification(monkeypatch) -> None:
    repository = RecordingRepository()
    service = NotificationService(repository=repository)

    async def _fake_audience_email(self, session, user_id: str) -> str:
        assert user_id
        return "audience@example.com"

    monkeypatch.setattr(NotificationService, "_get_audience_email", _fake_audience_email)

    booking = SimpleNamespace(
        id=uuid4(),
        requester_user_id=uuid4(),
        cinema_id=uuid4(),
        group_size=8,
        preferred_start_at=datetime.now(UTC),
        preferred_end_at=None,
        notes="Birthday event",
    )

    await service.enqueue_private_booking_submitted(None, booking)

    assert len(repository.rows) == 1
    assert repository.rows[0]["event_type"] == NotificationEvent.private_booking_submitted.value
    assert repository.rows[0]["template_key"] == NotificationTemplate.private_booking_submitted_audience.value
    assert repository.rows[0]["recipient_kind"] == EmailRecipientKind.audience
    assert repository.rows[0]["to_email"] == "audience@example.com"
    assert repository.rows[0]["payload"]["cancel_url"].endswith(
        f"/api/v1/private-bookings/{booking.id}/cancel-link"
    )


@pytest.mark.asyncio
async def test_private_booking_submitted_uses_notification_override(monkeypatch) -> None:
    repository = RecordingRepository()
    service = NotificationService(repository=repository)

    async def _unexpected_lookup(*args, **kwargs) -> str:
        raise AssertionError("recipient lookup should be bypassed when email_notification is supplied")

    monkeypatch.setattr(NotificationService, "_get_audience_email", _unexpected_lookup)

    booking = SimpleNamespace(
        id=uuid4(),
        requester_user_id=uuid4(),
        cinema_id=uuid4(),
        group_size=8,
        preferred_start_at=datetime.now(UTC),
        preferred_end_at=None,
        notes="Birthday event",
    )

    await service.enqueue_private_booking_submitted(
        None,
        booking,
        email_notification="test-recipient@example.com",
    )

    assert [row["to_email"] for row in repository.rows] == ["test-recipient@example.com"]
    assert repository.rows[0]["payload"]["cancel_url"].endswith(
        f"/api/v1/private-bookings/{booking.id}/cancel-link"
    )


def test_private_booking_submitted_template_includes_cancel_url() -> None:
    booking_id = uuid4()
    cancel_url = f"http://localhost:8000/api/v1/private-bookings/{booking_id}/cancel-link"

    subject, body = render_email_content(
        NotificationTemplate.private_booking_submitted_audience,
        {
            "booking_id": str(booking_id),
            "cinema_id": str(uuid4()),
            "group_size": 8,
            "cancel_url": cancel_url,
        },
    )

    assert subject == "Private booking request received"
    assert cancel_url in body


@pytest.mark.asyncio
async def test_private_booking_reviewed_enqueues_audience_notification(monkeypatch) -> None:
    repository = RecordingRepository()
    service = NotificationService(repository=repository)

    async def _fake_audience_email(self, session, user_id: str) -> str:
        assert user_id
        return "audience@example.com"

    monkeypatch.setattr(NotificationService, "_get_audience_email", _fake_audience_email)

    booking = SimpleNamespace(
        id=uuid4(),
        requester_user_id=uuid4(),
        status=SimpleNamespace(value="offered"),
        quoted_price_cents=18500,
        currency="EUR",
        offered_start_at=datetime.now(UTC),
        offered_end_at=datetime.now(UTC),
        cinema_response_message="We can host this screening.",
    )

    await service.enqueue_private_booking_reviewed(None, booking)

    assert len(repository.rows) == 1
    assert repository.rows[0]["event_type"] == NotificationEvent.private_booking_reviewed.value
    assert repository.rows[0]["template_key"] == NotificationTemplate.private_booking_reviewed_audience.value
    assert repository.rows[0]["recipient_kind"] == EmailRecipientKind.audience
    assert repository.rows[0]["to_email"] == "audience@example.com"
    assert repository.rows[0]["payload"]["booking_url"].endswith("/private-booking")


def test_private_booking_offered_template_renders_offer_details() -> None:
    booking_id = uuid4()
    booking_url = "http://localhost:5173/private-booking"

    message = render_email_message(
        NotificationTemplate.private_booking_reviewed_audience,
        {
            "booking_id": str(booking_id),
            "status": "offered",
            "quoted_price_cents": 18500,
            "currency": "EUR",
            "offered_start_at": "2026-05-01T18:00:00Z",
            "offered_end_at": "2026-05-01T21:00:00Z",
            "cinema_response_message": "We can host this screening.",
            "booking_url": booking_url,
            "cancel_url": f"http://localhost:8000/api/v1/private-bookings/{booking_id}/cancel-link",
        },
    )

    assert message.subject == "Private booking offer"
    assert "185.00 EUR" in message.text
    assert "We can host this screening." in message.text
    assert booking_url in message.text


def test_private_booking_rejected_template_renders_response_without_payment_cta() -> None:
    booking_id = uuid4()

    message = render_email_message(
        NotificationTemplate.private_booking_reviewed_audience,
        {
            "booking_id": str(booking_id),
            "status": "rejected",
            "quoted_price_cents": None,
            "currency": "EUR",
            "offered_start_at": None,
            "offered_end_at": None,
            "cinema_response_message": "The hall is unavailable.",
            "booking_url": "http://localhost:5173/private-booking",
            "cancel_url": f"http://localhost:8000/api/v1/private-bookings/{booking_id}/cancel-link",
        },
    )

    assert message.subject == "Private booking response"
    assert "The hall is unavailable." in message.text
    assert "Review offer" not in message.text
    assert "Offered price" not in message.text


@pytest.mark.asyncio
async def test_payment_notification_hook_enqueues_expected_template(monkeypatch) -> None:
    repository = RecordingRepository()
    notification_service = NotificationService(repository=repository)
    payment_service = PaymentNotificationService(notification_service=notification_service)

    async def _fake_audience_email(self, session, user_id: str) -> str:
        assert user_id
        return "buyer@example.com"

    monkeypatch.setattr(NotificationService, "_get_audience_email", _fake_audience_email)

    await payment_service.handle_payment_failed(
        None,
        audience_user_id=str(uuid4()),
        order_id=str(uuid4()),
        payment_id=str(uuid4()),
        amount_cents=2450,
        currency="EUR",
        reason="card_declined",
    )

    assert len(repository.rows) == 1
    row = repository.rows[0]
    assert row["event_type"] == NotificationEvent.payment_failed.value
    assert row["template_key"] == NotificationTemplate.payment_failed.value
    assert row["payload"]["reason"] == "card_declined"


@pytest.mark.asyncio
async def test_payment_succeeded_uses_notification_override(monkeypatch) -> None:
    repository = RecordingRepository()
    notification_service = NotificationService(repository=repository)
    payment_service = PaymentNotificationService(notification_service=notification_service)

    async def _unexpected_lookup(*args, **kwargs) -> str:
        raise AssertionError("recipient lookup should be bypassed when email_notification is supplied")

    monkeypatch.setattr(NotificationService, "_get_audience_email", _unexpected_lookup)

    await payment_service.handle_payment_succeeded(
        None,
        audience_user_id=str(uuid4()),
        order_id=str(uuid4()),
        payment_id=str(uuid4()),
        admission_id=str(uuid4()),
        amount_cents=2450,
        currency="EUR",
        email_notification="receipt@example.com",
        description="Kinora screening ticket",
        quantity=2,
        refund_url="http://localhost:8000/api/v1/admissions/admission/refund-link?token=token",
    )

    assert len(repository.rows) == 1
    row = repository.rows[0]
    assert row["event_type"] == NotificationEvent.payment_succeeded.value
    assert row["template_key"] == NotificationTemplate.payment_succeeded.value
    assert row["to_email"] == "receipt@example.com"
    assert row["payload"]["description"] == "Kinora screening ticket"
    assert row["payload"]["quantity"] == 2
    assert row["payload"]["refund_url"].endswith("/admissions/admission/refund-link?token=token")


def test_payment_succeeded_template_renders_receipt_details() -> None:
    order_id = uuid4()
    payment_id = uuid4()

    subject, body = render_email_content(
        NotificationTemplate.payment_succeeded,
        {
            "order_id": str(order_id),
            "payment_id": str(payment_id),
            "admission_id": str(uuid4()),
            "amount_cents": 2450,
            "currency": "EUR",
            "description": "Kinora early-bird ticket: Arrival",
            "quantity": 2,
            "refund_url": f"http://localhost:8000/api/v1/admissions/{uuid4()}/refund-link?token=token",
        },
    )

    assert subject == "Your Kinora receipt"
    assert "24.50 EUR" in body
    assert str(order_id) in body
    assert str(payment_id) in body
    assert "Kinora early-bird ticket: Arrival" in body
    assert "ticket PDF is attached" in body
    assert "request a refund here" in body
    assert "/refund-link?token=token" in body


def test_payment_succeeded_html_omits_logo_image() -> None:
    message = render_email_message(
        NotificationTemplate.payment_succeeded,
        {
            "order_id": str(uuid4()),
            "payment_id": str(uuid4()),
            "amount_cents": 2450,
            "currency": "EUR",
        },
    )

    assert "data:image/svg+xml;base64," not in message.html
    assert "<img" not in message.html
