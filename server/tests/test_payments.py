import asyncio
from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.api.deps.auth import get_current_user
from app.api.deps.db import get_db
from app.main import app
from app.models.admission import AdmissionStatus, AdmissionType, LossDecision
from app.models.payment import Order, OrderStatus, Payment
from app.services.email_link_service import EmailLinkService
from app.services.payment_notification_service import PaymentNotificationService
from app.services.payment_service import PaymentService
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


async def _noop_award_purchase_points(self, session, admission):
    return None


def test_screening_checkout_requires_authentication() -> None:
    response = client.post(f"/api/v1/screenings/{uuid4()}/checkout-session", json={"quantity": 1})

    assert response.status_code == 401


def test_screening_checkout_uses_payment_service(monkeypatch) -> None:
    order_id = uuid4()
    user_id = uuid4()
    screening_id = uuid4()

    async def _fake_get_profile(self, session, profile_user_id):
        return SimpleNamespace(role="audience")

    async def _fake_checkout(self, session, screening_id, buyer_user_id, quantity, coupon_id=None, email_notification=None):
        assert coupon_id is None
        assert email_notification is None
        return {
            "order_id": order_id,
            "session_id": "cs_test_123",
            "checkout_url": "https://checkout.stripe.com/c/pay/cs_test_123",
        }

    monkeypatch.setattr(ProfileService, "get_by_user_id", _fake_get_profile)
    monkeypatch.setattr(PaymentService, "create_screening_checkout_session", _fake_checkout)
    _set_overrides({"id": str(user_id), "app_metadata": {"role": "audience"}, "user_metadata": {}})

    response = client.post(f"/api/v1/screenings/{screening_id}/checkout-session", json={"quantity": 2})
    _clear_overrides()

    assert response.status_code == 200
    assert response.json()["session_id"] == "cs_test_123"
    assert response.json()["order_id"] == str(order_id)


def test_screening_checkout_uses_current_user_email_when_no_override(monkeypatch) -> None:
    order_id = uuid4()
    user_id = uuid4()
    screening_id = uuid4()
    seen = []

    async def _fake_get_profile(self, session, profile_user_id):
        return SimpleNamespace(role="audience")

    async def _fake_checkout(self, session, screening_id, buyer_user_id, quantity, coupon_id=None, email_notification=None):
        assert coupon_id is None
        seen.append(email_notification)
        return {
            "order_id": order_id,
            "session_id": "cs_test_123",
            "checkout_url": "https://checkout.stripe.com/c/pay/cs_test_123",
        }

    monkeypatch.setattr(ProfileService, "get_by_user_id", _fake_get_profile)
    monkeypatch.setattr(PaymentService, "create_screening_checkout_session", _fake_checkout)
    _set_overrides(
        {
            "id": str(user_id),
            "email": "buyer@example.com",
            "app_metadata": {"role": "audience"},
            "user_metadata": {},
        }
    )

    response = client.post(f"/api/v1/screenings/{screening_id}/checkout-session", json={"quantity": 1})
    _clear_overrides()

    assert response.status_code == 200
    assert seen == ["buyer@example.com"]


def test_campaign_checkout_uses_current_user_email_when_no_override(monkeypatch) -> None:
    order_id = uuid4()
    user_id = uuid4()
    campaign_id = uuid4()
    campaign_movie_id = uuid4()
    seen = []

    async def _fake_get_profile(self, session, profile_user_id):
        return SimpleNamespace(role="audience")

    async def _fake_checkout(
        self,
        session,
        campaign_id,
        campaign_movie_id,
        buyer_user_id,
        quantity,
        coupon_id=None,
        email_notification=None,
    ):
        assert coupon_id is None
        seen.append(email_notification)
        return {
            "order_id": order_id,
            "session_id": "cs_test_123",
            "checkout_url": "https://checkout.stripe.com/c/pay/cs_test_123",
        }

    monkeypatch.setattr(ProfileService, "get_by_user_id", _fake_get_profile)
    monkeypatch.setattr(PaymentService, "create_campaign_checkout_session", _fake_checkout)
    _set_overrides(
        {
            "id": str(user_id),
            "email": "earlybird@example.com",
            "app_metadata": {"role": "audience"},
            "user_metadata": {},
        }
    )

    response = client.post(
        f"/api/v1/campaigns/{campaign_id}/movies/{campaign_movie_id}/checkout-session",
        json={"quantity": 2},
    )
    _clear_overrides()

    assert response.status_code == 200
    assert seen == ["earlybird@example.com"]


@pytest.mark.asyncio
async def test_screening_checkout_stores_email_notification_in_metadata(monkeypatch) -> None:
    buyer_user_id = str(uuid4())
    screening_id = uuid4()
    order_id = uuid4()
    captured_metadata = {}

    async def _fake_get_screening(self, session, screening_id_arg):
        assert screening_id_arg == str(screening_id)
        return SimpleNamespace(id=screening_id, ticket_price_cents=900)

    async def _fake_create_order(
        self,
        session,
        buyer_user_id,
        unit_price_cents,
        quantity,
        metadata,
        discount_cents=0,
    ):
        assert discount_cents == 0
        captured_metadata["order"] = metadata
        return SimpleNamespace(id=order_id)

    async def _fake_create_checkout_session(
        self,
        order,
        name,
        quantity,
        unit_price_cents,
        metadata,
        discount_cents=0,
    ):
        assert discount_cents == 0
        captured_metadata["stripe"] = metadata
        return {"order_id": order.id, "session_id": "cs_test_123", "checkout_url": "https://checkout"}

    monkeypatch.setattr(PaymentService, "_get_screening_for_checkout", _fake_get_screening)
    monkeypatch.setattr(PaymentService, "_create_order", _fake_create_order)
    monkeypatch.setattr(PaymentService, "_create_checkout_session", _fake_create_checkout_session)

    await PaymentService().create_screening_checkout_session(
        session=None,
        screening_id=str(screening_id),
        buyer_user_id=buyer_user_id,
        quantity=2,
        email_notification="receipt@example.com",
    )

    assert captured_metadata["order"]["email_notification"] == "receipt@example.com"
    assert captured_metadata["stripe"]["email_notification"] == "receipt@example.com"
    assert captured_metadata["stripe"]["description"] == "Kinora screening ticket"


@pytest.mark.asyncio
async def test_stripe_checkout_receives_customer_email(monkeypatch) -> None:
    order = SimpleNamespace(
        id=uuid4(),
        metadata_json={"email_notification": "receipt@example.com"},
    )
    captured = {}

    def _fake_create(**kwargs):
        captured.update(kwargs)
        return {"id": "cs_test_123", "url": "https://checkout"}

    monkeypatch.setattr("stripe.checkout.Session.create", _fake_create)

    checkout = await PaymentService()._create_checkout_session(
        order=order,
        name="Kinora screening ticket",
        quantity=1,
        unit_price_cents=900,
        metadata={"order_id": str(order.id)},
    )

    assert checkout["session_id"] == "cs_test_123"
    assert captured["customer_email"] == "receipt@example.com"
    assert captured["success_url"] == (
        "http://localhost:8000/api/v1/stripe/checkout/success?session_id={CHECKOUT_SESSION_ID}"
    )
    assert captured["cancel_url"].startswith("http://localhost:8000/api/v1/stripe/checkout/cancel")


@pytest.mark.asyncio
async def test_screening_checkout_completed_enqueues_one_receipt(monkeypatch) -> None:
    buyer_user_id = uuid4()
    admission_id = uuid4()
    order = Order(
        id=uuid4(),
        buyer_user_id=buyer_user_id,
        status=OrderStatus.pending,
        currency="EUR",
        subtotal_cents=1800,
        fees_cents=0,
        total_cents=1800,
        metadata_json={},
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    added = []
    notifications = []
    payment_by_intent = {"value": None}

    class FakeSession:
        def add(self, item):
            added.append(item)
            if isinstance(item, Payment):
                payment_by_intent["value"] = item

    async def _fake_get_order(self, session, order_id):
        assert order_id == str(order.id)
        return order

    async def _fake_get_payment_by_intent(self, session, payment_intent_id):
        assert payment_intent_id == "pi_screening"
        return payment_by_intent["value"]

    async def _fake_get_admission_by_order(self, session, order_id):
        assert order_id == order.id
        return None

    async def _fake_build_admission(self, session, order, buyer_user_id, admission_type, quantity, metadata, now):
        return SimpleNamespace(
            id=admission_id,
            order_id=order.id,
            type=AdmissionType.screening_ticket,
            quantity=quantity,
        )

    async def _fake_payment_succeeded(self, session, **kwargs):
        notifications.append(kwargs)

    monkeypatch.setattr(PaymentService, "_get_order", _fake_get_order)
    monkeypatch.setattr(PaymentService, "_get_payment_by_intent", _fake_get_payment_by_intent)
    monkeypatch.setattr(PaymentService, "_get_admission_by_order", _fake_get_admission_by_order)
    monkeypatch.setattr(PaymentService, "_build_admission_from_metadata", _fake_build_admission)
    monkeypatch.setattr(PaymentService, "_retrieve_payment_intent", lambda self, payment_intent_id: None)
    monkeypatch.setattr(PaymentService, "_award_purchase_points", _noop_award_purchase_points)
    monkeypatch.setattr(PaymentNotificationService, "handle_payment_succeeded", _fake_payment_succeeded)

    checkout_session = {
        "metadata": {
            "order_id": str(order.id),
            "buyer_user_id": str(buyer_user_id),
            "admission_type": AdmissionType.screening_ticket.value,
            "screening_id": str(uuid4()),
            "email_notification": "receipt@example.com",
            "description": "Kinora screening ticket",
            "quantity": "2",
        },
        "payment_intent": "pi_screening",
        "amount_total": 1800,
        "currency": "eur",
    }

    service = PaymentService()
    await service.handle_checkout_completed(FakeSession(), checkout_session)
    await service.handle_checkout_completed(FakeSession(), checkout_session)

    assert order.status == OrderStatus.paid
    assert len([item for item in added if isinstance(item, Payment)]) == 1
    assert len(notifications) == 1
    assert notifications[0]["email_notification"] == "receipt@example.com"
    assert notifications[0]["admission_id"] == str(admission_id)
    assert notifications[0]["quantity"] == 2


@pytest.mark.asyncio
async def test_screening_checkout_completed_uses_stripe_customer_email(monkeypatch) -> None:
    buyer_user_id = uuid4()
    admission_id = uuid4()
    order = Order(
        id=uuid4(),
        buyer_user_id=buyer_user_id,
        status=OrderStatus.pending,
        currency="EUR",
        subtotal_cents=900,
        fees_cents=0,
        total_cents=900,
        metadata_json={},
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    payment_by_intent = {"value": None}
    notifications = []

    class FakeSession:
        def add(self, item):
            if isinstance(item, Payment):
                payment_by_intent["value"] = item

    async def _fake_get_order(self, session, order_id):
        return order

    async def _fake_get_payment_by_intent(self, session, payment_intent_id):
        return payment_by_intent["value"]

    async def _fake_get_admission_by_order(self, session, order_id):
        return None

    async def _fake_build_admission(self, session, order, buyer_user_id, admission_type, quantity, metadata, now):
        return SimpleNamespace(
            id=admission_id,
            order_id=order.id,
            type=AdmissionType.screening_ticket,
            quantity=quantity,
        )

    async def _fake_payment_succeeded(self, session, **kwargs):
        notifications.append(kwargs)

    monkeypatch.setattr(PaymentService, "_get_order", _fake_get_order)
    monkeypatch.setattr(PaymentService, "_get_payment_by_intent", _fake_get_payment_by_intent)
    monkeypatch.setattr(PaymentService, "_get_admission_by_order", _fake_get_admission_by_order)
    monkeypatch.setattr(PaymentService, "_build_admission_from_metadata", _fake_build_admission)
    monkeypatch.setattr(PaymentService, "_retrieve_payment_intent", lambda self, payment_intent_id: None)
    monkeypatch.setattr(PaymentService, "_award_purchase_points", _noop_award_purchase_points)
    monkeypatch.setattr(PaymentNotificationService, "handle_payment_succeeded", _fake_payment_succeeded)

    checkout_session = {
        "metadata": {
            "order_id": str(order.id),
            "buyer_user_id": str(buyer_user_id),
            "admission_type": AdmissionType.screening_ticket.value,
            "screening_id": str(uuid4()),
            "description": "Kinora screening ticket",
            "quantity": "1",
        },
        "customer_details": {"email": "stripe-buyer@example.com"},
        "payment_intent": "pi_screening_customer_email",
        "amount_total": 900,
        "currency": "eur",
    }

    await PaymentService().handle_checkout_completed(FakeSession(), checkout_session)

    assert notifications[0]["email_notification"] == "stripe-buyer@example.com"
    assert notifications[0]["admission_id"] == str(admission_id)


@pytest.mark.asyncio
async def test_campaign_checkout_completed_adds_signed_refund_link(monkeypatch) -> None:
    buyer_user_id = uuid4()
    admission_id = uuid4()
    order = Order(
        id=uuid4(),
        buyer_user_id=buyer_user_id,
        status=OrderStatus.pending,
        currency="EUR",
        subtotal_cents=1800,
        fees_cents=0,
        total_cents=1800,
        metadata_json={},
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    payment_by_intent = {"value": None}
    notifications = []

    class FakeSession:
        def add(self, item):
            if isinstance(item, Payment):
                payment_by_intent["value"] = item

    async def _fake_get_order(self, session, order_id):
        return order

    async def _fake_get_payment_by_intent(self, session, payment_intent_id):
        return payment_by_intent["value"]

    async def _fake_get_admission_by_order(self, session, order_id):
        return None

    async def _fake_build_admission(self, session, order, buyer_user_id, admission_type, quantity, metadata, now):
        return SimpleNamespace(
            id=admission_id,
            order_id=order.id,
            type=AdmissionType.campaign_earlybird,
            quantity=quantity,
        )

    async def _fake_payment_succeeded(self, session, **kwargs):
        notifications.append(kwargs)

    monkeypatch.setattr(PaymentService, "_get_order", _fake_get_order)
    monkeypatch.setattr(PaymentService, "_get_payment_by_intent", _fake_get_payment_by_intent)
    monkeypatch.setattr(PaymentService, "_get_admission_by_order", _fake_get_admission_by_order)
    monkeypatch.setattr(PaymentService, "_build_admission_from_metadata", _fake_build_admission)
    monkeypatch.setattr(PaymentService, "_retrieve_payment_intent", lambda self, payment_intent_id: None)
    monkeypatch.setattr(PaymentService, "_award_purchase_points", _noop_award_purchase_points)
    monkeypatch.setattr(PaymentNotificationService, "handle_payment_succeeded", _fake_payment_succeeded)

    checkout_session = {
        "metadata": {
            "order_id": str(order.id),
            "buyer_user_id": str(buyer_user_id),
            "admission_type": AdmissionType.campaign_earlybird.value,
            "campaign_movie_id": str(uuid4()),
            "email_notification": "receipt@example.com",
            "description": "Kinora early-bird ticket: Arrival",
            "quantity": "2",
        },
        "payment_intent": "pi_campaign",
        "amount_total": 1800,
        "currency": "eur",
    }

    await PaymentService().handle_checkout_completed(FakeSession(), checkout_session)

    assert notifications[0]["admission_id"] == str(admission_id)
    assert notifications[0]["quantity"] == 2
    assert f"/admissions/{admission_id}/refund-link?token=" in notifications[0]["refund_url"]


@pytest.mark.asyncio
async def test_checkout_success_redirect_processes_paid_session(monkeypatch) -> None:
    checkout_session = {
        "id": "cs_test_success",
        "status": "complete",
        "payment_status": "paid",
        "metadata": {
            "order_id": str(uuid4()),
            "buyer_user_id": str(uuid4()),
            "admission_type": AdmissionType.screening_ticket.value,
            "screening_id": str(uuid4()),
            "email_notification": "receipt@example.com",
            "description": "Kinora screening ticket",
            "quantity": "1",
        },
        "payment_intent": "pi_success",
        "amount_total": 900,
        "currency": "eur",
    }
    handled = []

    def _fake_retrieve(self, checkout_session_id):
        assert checkout_session_id == "cs_test_success"
        return checkout_session

    async def _fake_handle_completed(self, session, checkout_session_arg):
        handled.append(checkout_session_arg)

    monkeypatch.setattr(PaymentService, "_retrieve_checkout_session", _fake_retrieve)
    monkeypatch.setattr(PaymentService, "handle_checkout_completed", _fake_handle_completed)

    result = await PaymentService().handle_checkout_success_redirect(None, "cs_test_success")

    assert result["status"] == "processed"
    assert result["order_id"] == checkout_session["metadata"]["order_id"]
    assert handled == [checkout_session]


def test_refund_endpoint_rejects_ineligible_admission(monkeypatch) -> None:
    user_id = uuid4()
    admission_id = uuid4()

    async def _fake_get_profile(self, session, profile_user_id):
        return SimpleNamespace(role="audience")

    async def _fake_refund(self, session, admission_id, buyer_user_id):
        from fastapi import HTTPException

        raise HTTPException(status_code=409, detail="Admission is not refundable")

    monkeypatch.setattr(ProfileService, "get_by_user_id", _fake_get_profile)
    monkeypatch.setattr(PaymentService, "request_user_refund", _fake_refund)
    _set_overrides({"id": str(user_id), "app_metadata": {"role": "audience"}, "user_metadata": {}})

    response = client.post(f"/api/v1/admissions/{admission_id}/refund")
    _clear_overrides()

    assert response.status_code == 409
    assert response.json()["detail"] == "Admission is not refundable"


def test_email_refund_link_shows_confirmation() -> None:
    admission_id = uuid4()
    refund_url = EmailLinkService().build_admission_refund_url(str(admission_id))

    response = client.get(refund_url.replace("http://localhost:8000", ""))

    assert response.status_code == 200
    assert "Request refund" in response.text
    assert "data:image/svg+xml;base64," in response.text
    assert "margin:0 auto 18px" in response.text
    assert f"/api/v1/admissions/{admission_id}/refund-link?token=" in response.text


def test_email_refund_link_posts_refund_request(monkeypatch) -> None:
    admission_id = uuid4()
    refund_id = uuid4()
    refund_url = EmailLinkService().build_admission_refund_url(str(admission_id))
    seen = []

    async def _fake_refund_from_link(self, session, admission_id_arg):
        seen.append(admission_id_arg)
        return SimpleNamespace(id=refund_id, amount_cents=1800)

    monkeypatch.setattr(PaymentService, "request_user_refund_from_email_link", _fake_refund_from_link)
    _set_overrides({"id": str(uuid4()), "app_metadata": {"role": "audience"}, "user_metadata": {}})

    response = client.post(refund_url.replace("http://localhost:8000", ""))
    _clear_overrides()

    assert response.status_code == 200
    assert seen == [str(admission_id)]
    assert str(refund_id) in response.text


def test_losing_earlybird_admission_is_refund_eligible() -> None:
    admission = SimpleNamespace(
        type=AdmissionType.campaign_earlybird,
        status=AdmissionStatus.lost_refund_pending,
        loss_decision=LossDecision.refund,
        created_at=datetime.now(UTC),
    )

    assert PaymentService().is_user_refund_eligible(admission)


def test_active_admission_is_not_refund_eligible() -> None:
    admission = SimpleNamespace(
        type=AdmissionType.screening_ticket,
        status=AdmissionStatus.active,
        loss_decision=LossDecision.pending,
        created_at=datetime.now(UTC),
    )

    assert not PaymentService().is_user_refund_eligible(admission)


def test_mark_campaign_outcome_links_earlybird_admissions_to_winning_screening() -> None:
    winning_candidate_id = uuid4()
    losing_candidate_id = uuid4()
    winning_movie_id = uuid4()
    screening_id = uuid4()

    winning_admission = SimpleNamespace(
        campaign_movie_id=winning_candidate_id,
        screening_id=None,
        status=AdmissionStatus.pending_outcome,
        loss_decision=LossDecision.pending,
        loss_decided_at=None,
    )
    losing_admission = SimpleNamespace(
        campaign_movie_id=losing_candidate_id,
        screening_id=None,
        status=AdmissionStatus.pending_outcome,
        loss_decision=LossDecision.pending,
        loss_decided_at=None,
    )
    added = []

    class FakeScalarResult:
        def __init__(self, values):
            self._values = values

        def all(self):
            return self._values

    class FakeResult:
        def __init__(self, values):
            self._values = values

        def scalars(self):
            return FakeScalarResult(self._values)

    class FakeSession:
        def __init__(self):
            self._results = [
                FakeResult(
                    [
                        SimpleNamespace(id=winning_candidate_id, movie_id=winning_movie_id),
                        SimpleNamespace(id=losing_candidate_id, movie_id=uuid4()),
                    ]
                ),
                FakeResult([winning_admission, losing_admission]),
            ]

        async def execute(self, statement):
            return self._results.pop(0)

        def add(self, item):
            added.append(item)

    campaign = SimpleNamespace(id=uuid4(), winning_movie_id=winning_movie_id)

    asyncio.run(PaymentService().mark_campaign_outcome(FakeSession(), campaign, screening_id))

    assert winning_admission.screening_id == screening_id
    assert winning_admission.status == AdmissionStatus.active
    assert winning_admission.loss_decision == LossDecision.no_refund
    assert winning_admission.loss_decided_at is not None

    assert losing_admission.screening_id == screening_id
    assert losing_admission.status == AdmissionStatus.active
    assert losing_admission.loss_decision == LossDecision.refund
    assert losing_admission.loss_decided_at is not None

    assert added == [winning_admission, losing_admission]
