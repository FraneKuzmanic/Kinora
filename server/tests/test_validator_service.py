from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.models.admission import AdmissionStatus, AdmissionType
from app.schemas.validator import RedemptionRequest, TicketValidationRequest
from app.services.cinema_service import CinemaService
from app.services.loyalty_service import LoyaltyService
from app.services.validator_service import ValidatorService


class FakeResult:
    def __init__(self, scalar=None, row=None) -> None:
        self._scalar = scalar
        self._row = row

    def scalar_one_or_none(self):
        return self._scalar

    def one_or_none(self):
        return self._row


class FakeSession:
    def __init__(self, results) -> None:
        self.results = list(results)
        self.added = []
        self.commit_count = 0
        self.refresh_count = 0

    async def execute(self, query):
        if not self.results:
            raise AssertionError("unexpected query")
        return self.results.pop(0)

    def add(self, item):
        self.added.append(item)

    async def commit(self):
        self.commit_count += 1

    async def refresh(self, item):
        self.refresh_count += 1


def _admission(**overrides):
    values = {
        "id": uuid4(),
        "status": AdmissionStatus.active,
        "type": AdmissionType.screening_ticket,
        "quantity": 1,
        "buyer_user_id": uuid4(),
        "screening_id": uuid4(),
        "campaign_movie_id": None,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


@pytest.mark.asyncio
async def test_validate_returns_not_found_state() -> None:
    session = FakeSession([FakeResult(scalar=None)])

    result = await ValidatorService().validate_admission(
        session,
        "missing-token",
        str(uuid4()),
        TicketValidationRequest(device_info={"device": "camera"}),
    )

    assert result.valid is False
    assert result.redeemable is False
    assert result.reason == "Admission not found"


@pytest.mark.asyncio
async def test_validate_returns_redeemable_ticket_context() -> None:
    admission = _admission()
    starts_at = datetime.now(UTC)
    ends_at = datetime.now(UTC)
    async def _fake_has_permission(self, session, *, cinema_id, validator_user_id):
        return True

    async def _fake_award_points(self, session, **kwargs):
        return None

    async def _fake_evaluate_badges(self, session, user_id):
        return None

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(CinemaService, "has_active_validator_permission", _fake_has_permission)
    monkeypatch.setattr(LoyaltyService, "award_points", _fake_award_points)
    monkeypatch.setattr(LoyaltyService, "evaluate_badges", _fake_evaluate_badges)
    session = FakeSession(
        [
            FakeResult(scalar=admission),
            FakeResult(scalar=uuid4()),
            FakeResult(scalar=None),
            FakeResult(row=SimpleNamespace(title="Arrival", starts_at=starts_at, ends_at=ends_at)),
        ]
    )
    try:
        result = await ValidatorService().validate_admission(
            session,
            "ticket-token",
            str(uuid4()),
            TicketValidationRequest(),
        )
    finally:
        monkeypatch.undo()

    assert result.valid is True
    assert result.redeemable is True
    assert result.reason is None
    assert result.admission_id == admission.id
    assert result.admission_status == "active"
    assert result.admission_type == "screening_ticket"
    assert result.movie_title == "Arrival"
    assert result.starts_at == starts_at
    assert result.ends_at == ends_at


@pytest.mark.asyncio
async def test_validate_returns_already_redeemed_state() -> None:
    admission = _admission()
    redemption = SimpleNamespace(id=uuid4(), redeemed_at=datetime.now(UTC))
    async def _fake_has_permission(self, session, *, cinema_id, validator_user_id):
        return True

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(CinemaService, "has_active_validator_permission", _fake_has_permission)
    session = FakeSession([
        FakeResult(scalar=admission),
        FakeResult(scalar=uuid4()),
        FakeResult(scalar=redemption),
        FakeResult(row=None),
    ])

    try:
        result = await ValidatorService().validate_admission(
            session,
            "ticket-token",
            str(uuid4()),
            TicketValidationRequest(),
        )
    finally:
        monkeypatch.undo()

    assert result.valid is True
    assert result.redeemable is False
    assert result.reason == "Admission already redeemed"
    assert result.redemption_id == redemption.id
    assert result.redeemed_at == redemption.redeemed_at


@pytest.mark.asyncio
async def test_redeem_rejects_pending_ticket() -> None:
    admission = _admission(status=AdmissionStatus.pending_outcome)
    async def _fake_has_permission(self, session, *, cinema_id, validator_user_id):
        return True

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(CinemaService, "has_active_validator_permission", _fake_has_permission)
    session = FakeSession([FakeResult(scalar=admission), FakeResult(scalar=uuid4())])

    try:
        with pytest.raises(HTTPException) as exc_info:
            await ValidatorService().redeem_admission(
                session,
                "ticket-token",
                str(uuid4()),
                RedemptionRequest(),
            )
    finally:
        monkeypatch.undo()

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Admission is not redeemable (status: pending_outcome)"


@pytest.mark.asyncio
async def test_redeem_records_redemption() -> None:
    admission = _admission()
    async def _fake_has_permission(self, session, *, cinema_id, validator_user_id):
        return True

    async def _fake_award_points(self, session, **kwargs):
        return None

    async def _fake_evaluate_badges(self, session, user_id):
        return None

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(CinemaService, "has_active_validator_permission", _fake_has_permission)
    monkeypatch.setattr(LoyaltyService, "award_points", _fake_award_points)
    monkeypatch.setattr(LoyaltyService, "evaluate_badges", _fake_evaluate_badges)
    session = FakeSession([FakeResult(scalar=admission), FakeResult(scalar=uuid4()), FakeResult(scalar=None)])
    validator_user_id = uuid4()
    location_id = uuid4()
    hall_id = uuid4()

    try:
        redemption = await ValidatorService().redeem_admission(
            session,
            "ticket-token",
            str(validator_user_id),
            RedemptionRequest(
                location_id=location_id,
                hall_id=hall_id,
                device_info={"device": "camera"},
            ),
        )
    finally:
        monkeypatch.undo()

    assert redemption in session.added
    assert redemption.admission_id == admission.id
    assert redemption.validator_user_id == validator_user_id
    assert redemption.location_id == location_id
    assert redemption.hall_id == hall_id
    assert redemption.device_info == {"device": "camera"}
    assert session.commit_count == 2
    assert session.refresh_count == 1


@pytest.mark.asyncio
async def test_validate_returns_not_redeemable_without_permission(monkeypatch) -> None:
    admission = _admission()

    async def _fake_has_permission(self, session, *, cinema_id, validator_user_id):
        return False

    monkeypatch.setattr(CinemaService, "has_active_validator_permission", _fake_has_permission)
    starts_at = datetime.now(UTC)
    ends_at = datetime.now(UTC)
    session = FakeSession(
        [
            FakeResult(scalar=admission),
            FakeResult(scalar=uuid4()),
            FakeResult(scalar=None),
            FakeResult(row=SimpleNamespace(title="Arrival", starts_at=starts_at, ends_at=ends_at)),
        ]
    )

    result = await ValidatorService().validate_admission(
        session,
        "ticket-token",
        str(uuid4()),
        TicketValidationRequest(),
    )

    assert result.valid is True
    assert result.redeemable is False
    assert result.reason == "Validator is not assigned to this ticket's cinema"
    assert result.admission_id == admission.id
    assert result.movie_title == "Arrival"
