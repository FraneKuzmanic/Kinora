from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api.deps.auth import get_current_user
from app.api.deps.db import get_db
from app.main import app
from app.models.cinema import CinemaHall
from app.models.payment import Order, OrderStatus, Payment
from app.models.private_booking import PrivateBookingRequest, PrivateBookingStatus
from app.schemas.private_booking import PrivateBookingCancel, PrivateBookingReview
from app.services.campaign_service import CampaignService
from app.services.payment_notification_service import PaymentNotificationService
from app.services.payment_service import PaymentService
from app.services.private_booking_service import PrivateBookingService
from app.services.profile_service import ProfileService

client = TestClient(app)


async def _override_db():
    yield None


def _set_overrides(user_payload: dict) -> None:
    async def _override_user():
        return user_payload

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = _override_user


def _clear_overrides() -> None:
    app.dependency_overrides.clear()


def _booking(**overrides):
    now = datetime.now(UTC)
    data = {
        "id": uuid4(),
        "requester_user_id": uuid4(),
        "cinema_id": uuid4(),
        "preferred_location_id": None,
        "preferred_start_at": now,
        "preferred_end_at": None,
        "group_size": 12,
        "notes": None,
        "status": PrivateBookingStatus.submitted,
        "offered_location_id": None,
        "offered_hall_id": None,
        "offered_start_at": None,
        "offered_end_at": None,
        "quoted_price_cents": None,
        "currency": "EUR",
        "cinema_response_message": None,
        "responded_by_user_id": None,
        "responded_at": None,
        "accepted_at": None,
        "order_id": None,
        "cancelled_at": None,
        "cancelled_by_user_id": None,
        "cancellation_reason": None,
        "created_at": now,
        "updated_at": now,
    }
    data.update(overrides)
    return SimpleNamespace(**data)


class _ScalarResult:
    def __init__(self, value=None, values=None):
        self.value = value
        self.values = values or []

    def scalar_one_or_none(self):
        return self.value

    def scalars(self):
        return self

    def all(self):
        return self.values


class _FakeSession:
    def __init__(self, booking=None, order=None, payment=None, hall=None):
        self.booking = booking
        self.order = order
        self.payment = payment
        self.hall = hall
        self.added = []
        self.committed = False
        self.flushed = False

    async def get(self, model, item_id):
        if model is PrivateBookingRequest:
            return self.booking if self.booking and self.booking.id == item_id else None
        if model is Order:
            return self.order if self.order and self.order.id == item_id else None
        if model is CinemaHall:
            return self.hall if self.hall and self.hall.id == item_id else None
        return None

    async def execute(self, statement):
        return _ScalarResult(self.payment)

    def add(self, item):
        self.added.append(item)
        if isinstance(item, Payment):
            self.payment = item

    async def flush(self):
        self.flushed = True

    async def commit(self):
        self.committed = True

    async def refresh(self, item):
        return None


def test_audience_list_uses_requester_filter(monkeypatch) -> None:
    user_id = uuid4()
    row = _booking(requester_user_id=user_id)

    async def _fake_get_profile(self, session, profile_user_id):
        return SimpleNamespace(role="audience")

    async def _fake_list(self, session, *, requester_user_id=None, cinema_id=None):
        assert requester_user_id == str(user_id)
        assert cinema_id is None
        return [row]

    monkeypatch.setattr(ProfileService, "get_by_user_id", _fake_get_profile)
    monkeypatch.setattr(PrivateBookingService, "list_requests", _fake_list)
    _set_overrides({"id": str(user_id), "app_metadata": {}, "user_metadata": {}})

    response = client.get("/api/v1/private-bookings")
    _clear_overrides()

    assert response.status_code == 200
    assert response.json()[0]["requester_user_id"] == str(user_id)


def test_cinema_admin_list_uses_membership_cinema(monkeypatch) -> None:
    user_id = uuid4()
    owned_cinema_id = uuid4()
    row = _booking(cinema_id=owned_cinema_id)

    async def _fake_get_profile(self, session, profile_user_id):
        return SimpleNamespace(role="cinema_admin")

    async def _fake_get_admin_cinema_id(self, session, profile_user_id):
        return owned_cinema_id

    async def _fake_list(self, session, *, requester_user_id=None, cinema_id=None):
        assert requester_user_id is None
        assert cinema_id == owned_cinema_id
        return [row]

    monkeypatch.setattr(ProfileService, "get_by_user_id", _fake_get_profile)
    monkeypatch.setattr(CampaignService, "get_admin_cinema_id", _fake_get_admin_cinema_id)
    monkeypatch.setattr(PrivateBookingService, "list_requests", _fake_list)
    _set_overrides({"id": str(user_id), "app_metadata": {}, "user_metadata": {}})

    response = client.get("/api/v1/private-bookings")
    _clear_overrides()

    assert response.status_code == 200
    assert response.json()[0]["cinema_id"] == str(owned_cinema_id)


def test_private_booking_create_uses_current_user_email(monkeypatch) -> None:
    user_id = uuid4()
    seen = []
    row = _booking(requester_user_id=user_id)

    async def _fake_get_profile(self, session, profile_user_id):
        return SimpleNamespace(role="audience")

    async def _fake_create(self, session, requester_user_id, payload, *, email_notification=None):
        assert requester_user_id == str(user_id)
        seen.append(email_notification)
        return row

    monkeypatch.setattr(ProfileService, "get_by_user_id", _fake_get_profile)
    monkeypatch.setattr(PrivateBookingService, "create_request", _fake_create)
    _set_overrides(
        {
            "id": str(user_id),
            "email": "audience@example.com",
            "app_metadata": {},
            "user_metadata": {},
        }
    )

    response = client.post(
        "/api/v1/private-bookings",
        json={
            "cinema_id": str(row.cinema_id),
            "preferred_start_at": row.preferred_start_at.isoformat(),
            "group_size": row.group_size,
            "event_type": "birthday",
            "notes": "Birthday screening",
        },
    )
    _clear_overrides()

    assert response.status_code == 201
    assert seen == ["audience@example.com"]


def test_private_booking_checkout_uses_current_user_email(monkeypatch) -> None:
    user_id = uuid4()
    booking_id = uuid4()

    async def _fake_get_profile(self, session, profile_user_id):
        return SimpleNamespace(role="audience")

    async def _fake_checkout(self, session, booking_id, buyer_user_id, email_notification=None):
        assert email_notification == "receipt@example.com"
        return {"order_id": uuid4(), "session_id": "cs_test_private", "checkout_url": "https://checkout"}

    monkeypatch.setattr(ProfileService, "get_by_user_id", _fake_get_profile)
    monkeypatch.setattr(PaymentService, "create_private_booking_checkout_session", _fake_checkout)
    _set_overrides(
        {
            "id": str(user_id),
            "email": "receipt@example.com",
            "app_metadata": {},
            "user_metadata": {},
        }
    )

    response = client.post(f"/api/v1/private-bookings/{booking_id}/accept/checkout-session")
    _clear_overrides()

    assert response.status_code == 200
    assert response.json()["session_id"] == "cs_test_private"


@pytest.mark.asyncio
async def test_non_owner_admin_review_is_blocked() -> None:
    service = PrivateBookingService(notification_service=SimpleNamespace())
    booking = _booking(cinema_id=uuid4())
    session = _FakeSession(booking=booking)

    with pytest.raises(HTTPException) as exc:
        await service.review_request(
            session=session,
            booking_id=str(booking.id),
            reviewer_user_id=str(uuid4()),
            cinema_id=uuid4(),
            payload=PrivateBookingReview(status="in_review"),
        )

    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_invalid_transition_is_blocked() -> None:
    service = PrivateBookingService(notification_service=SimpleNamespace())
    booking = _booking(status=PrivateBookingStatus.paid)
    session = _FakeSession(booking=booking)

    with pytest.raises(HTTPException) as exc:
        await service.review_request(
            session=session,
            booking_id=str(booking.id),
            reviewer_user_id=str(uuid4()),
            cinema_id=booking.cinema_id,
            payload=PrivateBookingReview(status="offered"),
        )

    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_offer_requires_complete_fields() -> None:
    service = PrivateBookingService(notification_service=SimpleNamespace())
    booking = _booking(status=PrivateBookingStatus.submitted)
    session = _FakeSession(booking=booking)

    with pytest.raises(HTTPException) as exc:
        await service.review_request(
            session=session,
            booking_id=str(booking.id),
            reviewer_user_id=str(uuid4()),
            cinema_id=booking.cinema_id,
            payload=PrivateBookingReview(status="offered", quoted_price_cents=10000),
        )

    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_review_offer_enqueues_private_booking_response() -> None:
    class _NotificationService:
        def __init__(self) -> None:
            self.reviewed = []

        async def enqueue_private_booking_reviewed(self, session, booking, *, email_notification=None):
            self.reviewed.append((booking.status, booking.quoted_price_cents, booking.cinema_response_message))

    notification_service = _NotificationService()
    service = PrivateBookingService(notification_service=notification_service)
    location_id = uuid4()
    hall_id = uuid4()
    booking = _booking(status=PrivateBookingStatus.submitted, group_size=20)
    hall = SimpleNamespace(
        id=hall_id,
        location_id=location_id,
        allow_private_booking=True,
        capacity=80,
    )
    session = _FakeSession(booking=booking, hall=hall)
    starts_at = datetime.now(UTC)

    row = await service.review_request(
        session=session,
        booking_id=str(booking.id),
        reviewer_user_id=str(uuid4()),
        cinema_id=booking.cinema_id,
        payload=PrivateBookingReview(
            status="offered",
            offered_location_id=location_id,
            offered_hall_id=hall_id,
            offered_start_at=starts_at,
            offered_end_at=starts_at + timedelta(hours=1),
            quoted_price_cents=10000,
            cinema_response_message="We can host you.",
        ),
    )

    assert row.status == PrivateBookingStatus.offered
    assert notification_service.reviewed == [
        (PrivateBookingStatus.offered, 10000, "We can host you.")
    ]


@pytest.mark.asyncio
async def test_review_rejection_enqueues_private_booking_response() -> None:
    class _NotificationService:
        def __init__(self) -> None:
            self.reviewed = []

        async def enqueue_private_booking_reviewed(self, session, booking, *, email_notification=None):
            self.reviewed.append((booking.status, booking.cinema_response_message))

    notification_service = _NotificationService()
    service = PrivateBookingService(notification_service=notification_service)
    booking = _booking(status=PrivateBookingStatus.submitted)
    session = _FakeSession(booking=booking)

    row = await service.review_request(
        session=session,
        booking_id=str(booking.id),
        reviewer_user_id=str(uuid4()),
        cinema_id=booking.cinema_id,
        payload=PrivateBookingReview(
            status="rejected",
            cinema_response_message="The hall is unavailable.",
        ),
    )

    assert row.status == PrivateBookingStatus.rejected
    assert notification_service.reviewed == [
        (PrivateBookingStatus.rejected, "The hall is unavailable.")
    ]


@pytest.mark.asyncio
async def test_requester_accept_creates_checkout_and_links_order(monkeypatch) -> None:
    requester_id = uuid4()
    booking = _booking(
        requester_user_id=requester_id,
        status=PrivateBookingStatus.offered,
        quoted_price_cents=25000,
    )
    session = _FakeSession(booking=booking)

    async def _fake_checkout(self, order, name, quantity, unit_price_cents, metadata):
        assert metadata["order_kind"] == "private_booking"
        assert metadata["booking_id"] == str(booking.id)
        return {"order_id": order.id, "session_id": "cs_test_private", "checkout_url": "https://checkout"}

    monkeypatch.setattr(PaymentService, "_create_checkout_session", _fake_checkout)

    checkout = await PaymentService().create_private_booking_checkout_session(
        session=session,
        booking_id=str(booking.id),
        buyer_user_id=str(requester_id),
    )

    assert checkout["session_id"] == "cs_test_private"
    assert booking.status == PrivateBookingStatus.accepted
    assert booking.order_id == checkout["order_id"]
    assert session.committed


@pytest.mark.asyncio
async def test_non_requester_accept_is_blocked() -> None:
    booking = _booking(status=PrivateBookingStatus.offered, quoted_price_cents=25000)
    session = _FakeSession(booking=booking)

    with pytest.raises(HTTPException) as exc:
        await PaymentService().create_private_booking_checkout_session(
            session=session,
            booking_id=str(booking.id),
            buyer_user_id=str(uuid4()),
        )

    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_private_booking_webhook_marks_paid_without_admission(monkeypatch) -> None:
    requester_id = uuid4()
    order = Order(
        id=uuid4(),
        buyer_user_id=requester_id,
        status=OrderStatus.pending,
        currency="EUR",
        subtotal_cents=25000,
        fees_cents=0,
        total_cents=25000,
        metadata_json={},
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    booking = _booking(
        requester_user_id=requester_id,
        status=PrivateBookingStatus.accepted,
        order_id=order.id,
    )
    session = _FakeSession(booking=booking, order=order)
    checkout_session = {
        "metadata": {
            "order_id": str(order.id),
            "buyer_user_id": str(requester_id),
            "order_kind": "private_booking",
            "booking_id": str(booking.id),
            "email_notification": "receipt@example.com",
            "description": "Kinora private cinema booking",
            "quantity": "1",
        },
        "payment_intent": "pi_private",
        "amount_total": 25000,
        "currency": "eur",
    }
    notifications = []

    async def _fake_payment_succeeded(self, session, **kwargs):
        notifications.append(kwargs)

    monkeypatch.setattr(PaymentNotificationService, "handle_payment_succeeded", _fake_payment_succeeded)

    await PaymentService().handle_checkout_completed(session, checkout_session)
    await PaymentService().handle_checkout_completed(session, checkout_session)

    assert booking.status == PrivateBookingStatus.paid
    assert order.status == OrderStatus.paid
    assert len([item for item in session.added if isinstance(item, Payment)]) == 1
    assert len(notifications) == 1
    assert notifications[0]["email_notification"] == "receipt@example.com"


@pytest.mark.asyncio
async def test_paid_cancellation_refunds_and_records_audit(monkeypatch) -> None:
    actor_id = uuid4()
    booking = _booking(
        requester_user_id=actor_id,
        status=PrivateBookingStatus.paid,
        order_id=uuid4(),
    )
    session = _FakeSession(booking=booking)
    calls = []

    async def _fake_refund(self, session, booking, requested_by_user_id, reason):
        calls.append((booking.id, requested_by_user_id, reason))
        return SimpleNamespace(id=uuid4())

    monkeypatch.setattr(PaymentService, "refund_private_booking", _fake_refund)

    row = await PrivateBookingService(notification_service=SimpleNamespace()).cancel_request(
        session=session,
        booking_id=str(booking.id),
        actor_user_id=str(actor_id),
        actor_role="audience",
        cinema_id=None,
        payload=PrivateBookingCancel(reason="change of plans"),
    )

    assert row.status == PrivateBookingStatus.cancelled
    assert row.cancelled_by_user_id == actor_id
    assert row.cancellation_reason == "change of plans"
    assert calls == [(booking.id, actor_id, "change of plans")]


def test_private_booking_analytics_route(monkeypatch) -> None:
    user_id = uuid4()
    cinema_id = uuid4()

    async def _fake_get_profile(self, session, profile_user_id):
        return SimpleNamespace(role="cinema_admin")

    async def _fake_get_admin_cinema_id(self, session, profile_user_id):
        return cinema_id

    async def _fake_analytics(self, session, cinema_id_arg):
        assert cinema_id_arg == cinema_id
        return {
            "request_count": 4,
            "approved_count": 2,
            "rejected_count": 1,
            "approval_rate": 0.5,
            "average_group_size": 11.25,
            "most_requested_dates": [{"date": "2026-05-10", "request_count": 2}],
            "most_requested_time_ranges": [{"hour": "19:00:00", "request_count": 2}],
        }

    monkeypatch.setattr(ProfileService, "get_by_user_id", _fake_get_profile)
    monkeypatch.setattr(CampaignService, "get_admin_cinema_id", _fake_get_admin_cinema_id)
    monkeypatch.setattr(PrivateBookingService, "get_analytics", _fake_analytics)
    _set_overrides({"id": str(user_id), "app_metadata": {}, "user_metadata": {}})

    response = client.get("/api/v1/private-bookings/analytics")
    _clear_overrides()

    assert response.status_code == 200
    assert response.json()["approval_rate"] == 0.5


def test_private_booking_cancel_link_redirects_to_frontend_confirmation() -> None:
    booking_id = uuid4()

    response = client.get(f"/api/v1/private-bookings/{booking_id}/cancel-link", follow_redirects=False)

    assert response.status_code == 307
    assert response.headers["location"] == (
        f"http://localhost:5173/private-booking?source=email&booking_id={booking_id}"
    )
