from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.deps.auth import get_current_user, get_optional_user
from app.api.deps.db import get_db
from app.main import app
from app.services.campaign_service import CampaignService
from app.services.movie_service import MovieService
from app.services.profile_service import ProfileService
from app.services.screening_service import ScreeningService
from app.schemas.validator import TicketValidationResponse
from app.services.validator_service import ValidatorService


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


def test_list_movies_success(monkeypatch) -> None:
    movie = SimpleNamespace(
        id=uuid4(),
        title="Demo",
        original_title=None,
        release_year=2020,
        runtime_minutes=100,
        overview=None,
        poster_url=None,
        trailer_url=None,
        language_code="en",
        country_code="US",
        created_at=datetime.now(UTC),
    )

    async def _fake_list_movies(self, session):
        return [movie]

    monkeypatch.setattr(MovieService, "list_movies", _fake_list_movies)
    _set_overrides({"id": str(uuid4()), "app_metadata": {"role": "audience"}, "user_metadata": {}})

    response = client.get("/api/v1/movies")
    _clear_overrides()

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["title"] == "Demo"


def test_campaign_vote_forbidden_for_unknown_role(monkeypatch) -> None:
    async def _fake_get_profile(self, session, user_id):
        return SimpleNamespace(role="guest")

    async def _fake_create_vote(self, session, campaign_id, campaign_movie_id, user_id):
        raise AssertionError("create_vote should not be called for forbidden role")

    monkeypatch.setattr(ProfileService, "get_by_user_id", _fake_get_profile)
    monkeypatch.setattr(CampaignService, "create_vote", _fake_create_vote)

    _set_overrides({"id": str(uuid4()), "app_metadata": {}, "user_metadata": {}})
    response = client.post(
        f"/api/v1/campaigns/{uuid4()}/votes",
        json={"campaign_movie_id": str(uuid4())},
    )
    _clear_overrides()

    assert response.status_code == 403


def _discover_card_payload(
    campaign_id,
    campaign_movie_id,
    current_user_vote_campaign_movie_id=None,
) -> dict:
    return {
        "id": campaign_id,
        "created_at": datetime.now(UTC),
        "cinema_name": "Kinora Cinema",
        "location_name": "Center",
        "city_name": "Zagreb",
        "slot_starts_at": datetime.now(UTC),
        "voting_ends_at": datetime.now(UTC),
        "leading_movie_title": "Arrival",
        "leading_movie_vote_count": 4,
        "total_voters": 4,
        "current_user_vote_campaign_movie_id": current_user_vote_campaign_movie_id,
        "movies": [
            {
                "id": campaign_movie_id,
                "movie_id": uuid4(),
                "sort_order": 1,
                "vote_count": 4,
                "movie_title": "Arrival",
                "movie_poster_url": None,
                "is_leading": True,
            }
        ],
    }


def test_discover_cards_public_includes_null_current_user_vote(monkeypatch) -> None:
    campaign_id = uuid4()
    campaign_movie_id = uuid4()

    async def _fake_list_discover_cards(self, session, **kwargs):
        assert kwargs["user_id"] is None
        return [_discover_card_payload(campaign_id, campaign_movie_id)]

    monkeypatch.setattr(
        CampaignService,
        "list_discover_campaign_cards",
        _fake_list_discover_cards,
    )
    app.dependency_overrides[get_db] = _override_db

    response = client.get("/api/v1/campaigns/discover-cards")
    _clear_overrides()

    assert response.status_code == 200
    body = response.json()
    assert body[0]["current_user_vote_campaign_movie_id"] is None


def test_discover_cards_authenticated_includes_current_user_vote(monkeypatch) -> None:
    user_id = uuid4()
    campaign_id = uuid4()
    campaign_movie_id = uuid4()

    async def _override_optional_user():
        return {"id": str(user_id), "app_metadata": {"role": "audience"}, "user_metadata": {}}

    async def _fake_list_discover_cards(self, session, **kwargs):
        assert kwargs["user_id"] == str(user_id)
        return [
            _discover_card_payload(
                campaign_id,
                campaign_movie_id,
                current_user_vote_campaign_movie_id=campaign_movie_id,
            )
        ]

    monkeypatch.setattr(
        CampaignService,
        "list_discover_campaign_cards",
        _fake_list_discover_cards,
    )
    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_optional_user] = _override_optional_user

    response = client.get("/api/v1/campaigns/discover-cards")
    _clear_overrides()

    assert response.status_code == 200
    body = response.json()
    assert body[0]["current_user_vote_campaign_movie_id"] == str(campaign_movie_id)


def _screening_payload() -> dict:
    now = datetime.now(UTC)
    return {
        "id": uuid4(),
        "cinema_id": uuid4(),
        "hall_id": uuid4(),
        "movie_id": uuid4(),
        "campaign_id": None,
        "status": "selling",
        "starts_at": now,
        "ends_at": now,
        "decision_days_before_start": 7,
        "min_tickets_to_confirm": 10,
        "max_tickets": 80,
        "tickets_sold": 3,
        "ticket_price_cents": 900,
        "pending_at": None,
        "pending_expires_at": None,
        "confirmed_at": None,
        "cancelled_at": None,
        "cancel_reason": None,
        "created_at": now,
        "movie_title": "Arrival",
        "movie_release_year": 2016,
        "movie_poster_url": None,
        "movie_overview": None,
        "cinema_name": "Kinora Cinema",
        "hall_name": "Hall 1",
        "hall_capacity": 80,
        "location_id": uuid4(),
        "location_name": "Center",
        "location_address": None,
        "city_id": uuid4(),
        "city_name": "Zagreb",
    }


def test_list_screenings_accepts_active_only_and_limit(monkeypatch) -> None:
    async def _fake_list_screenings(self, session, **kwargs):
        assert kwargs["active_only"] is True
        assert kwargs["limit"] == 10
        return [_screening_payload()]

    monkeypatch.setattr(ScreeningService, "list_screenings", _fake_list_screenings)
    app.dependency_overrides[get_db] = _override_db

    response = client.get("/api/v1/screenings?active_only=true&limit=10")
    _clear_overrides()

    assert response.status_code == 200
    assert response.json()[0]["status"] == "selling"


def test_list_screenings_keeps_legacy_defaults(monkeypatch) -> None:
    async def _fake_list_screenings(self, session, **kwargs):
        assert kwargs["active_only"] is False
        assert kwargs["limit"] is None
        return []

    monkeypatch.setattr(ScreeningService, "list_screenings", _fake_list_screenings)
    app.dependency_overrides[get_db] = _override_db

    response = client.get("/api/v1/screenings")
    _clear_overrides()

    assert response.status_code == 200
    assert response.json() == []


def test_validator_redeem_forbidden_for_audience(monkeypatch) -> None:
    async def _fake_get_profile(self, session, user_id):
        return SimpleNamespace(role="audience")

    async def _fake_redeem(self, session, qr_token, validator_user_id, payload):
        raise AssertionError("redeem_admission should not be called for non-validator role")

    monkeypatch.setattr(ProfileService, "get_by_user_id", _fake_get_profile)
    monkeypatch.setattr(ValidatorService, "redeem_admission", _fake_redeem)

    _set_overrides({"id": str(uuid4()), "app_metadata": {}, "user_metadata": {}})
    response = client.post(
        "/api/v1/validator/admissions/demo-token/redeem",
        json={"device_info": {"device": "test"}},
    )
    _clear_overrides()

    assert response.status_code == 403


def test_validator_validate_forbidden_for_audience(monkeypatch) -> None:
    async def _fake_get_profile(self, session, user_id):
        return SimpleNamespace(role="audience")

    async def _fake_validate(self, session, qr_token, validator_user_id, payload):
        raise AssertionError("validate_admission should not be called for non-validator role")

    monkeypatch.setattr(ProfileService, "get_by_user_id", _fake_get_profile)
    monkeypatch.setattr(ValidatorService, "validate_admission", _fake_validate)

    _set_overrides({"id": str(uuid4()), "app_metadata": {}, "user_metadata": {}})
    response = client.post(
        "/api/v1/validator/admissions/demo-token/validate",
        json={"device_info": {"device": "test"}},
    )
    _clear_overrides()

    assert response.status_code == 403


def test_validator_validate_returns_ticket_state(monkeypatch) -> None:
    user_id = uuid4()
    admission_id = uuid4()
    screening_id = uuid4()

    async def _fake_get_profile(self, session, profile_user_id):
        return SimpleNamespace(role="validator")

    async def _fake_validate(self, session, qr_token, validator_user_id, payload):
        assert qr_token == "demo-token"
        assert validator_user_id == str(user_id)
        assert payload.device_info == {"device": "camera"}
        return TicketValidationResponse(
            valid=True,
            redeemable=True,
            admission_id=admission_id,
            admission_status="active",
            admission_type="screening_ticket",
            quantity=2,
            screening_id=screening_id,
            movie_title="Arrival",
            starts_at=datetime.now(UTC),
            ends_at=datetime.now(UTC),
        )

    monkeypatch.setattr(ProfileService, "get_by_user_id", _fake_get_profile)
    monkeypatch.setattr(ValidatorService, "validate_admission", _fake_validate)

    _set_overrides({"id": str(user_id), "app_metadata": {}, "user_metadata": {}})
    response = client.post(
        "/api/v1/validator/admissions/demo-token/validate",
        json={"device_info": {"device": "camera"}},
    )
    _clear_overrides()

    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is True
    assert body["redeemable"] is True
    assert body["admission_id"] == str(admission_id)
    assert body["screening_id"] == str(screening_id)
    assert body["movie_title"] == "Arrival"

