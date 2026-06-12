from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.deps.auth import get_current_user
from app.api.deps.db import get_db
from app.main import app
from app.services.campaign_service import CampaignService
from app.services.profile_service import ProfileService
from app.services.screening_service import ScreeningService


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


def _campaign_row(**overrides):
    now = datetime.now(UTC)
    data = {
        "id": uuid4(),
        "cinema_id": uuid4(),
        "hall_id": uuid4(),
        "cinema_name": "Kinora Cinema",
        "hall_name": "Main Hall",
        "hall_capacity": 120,
        "city_id": uuid4(),
        "city_name": "Zagreb",
        "location_name": "Downtown",
        "title": "Sci-Fi Week",
        "description": "Future classics",
        "status": "draft",
        "voting_starts_at": None,
        "voting_ends_at": None,
        "voting_duration_days": 7,
        "slot_starts_at": now + timedelta(days=14),
        "slot_ends_at": now + timedelta(days=14, hours=2),
        "decision_days_before_screening": 7,
        "min_tickets_to_confirm": 30,
        "max_tickets": 120,
        "ticket_price_cents": 900,
        "winning_movie_id": None,
        "resolved_at": None,
    }
    data.update(overrides)
    return data


def _campaign_payload(hall_id):
    now = datetime.now(UTC)
    return {
        "hall_id": str(hall_id),
        "title": "Sci-Fi Week",
        "description": "Future classics",
        "slot_starts_at": (now + timedelta(days=14)).isoformat(),
        "slot_ends_at": (now + timedelta(days=14, hours=2)).isoformat(),
        "voting_duration_days": 7,
        "decision_days_before_screening": 7,
        "min_tickets_to_confirm": 30,
        "max_tickets": 120,
        "ticket_price_cents": 900,
    }


def _screening_row(**overrides):
    now = datetime.now(UTC)
    data = {
        "id": uuid4(),
        "cinema_id": uuid4(),
        "hall_id": uuid4(),
        "movie_id": uuid4(),
        "campaign_id": uuid4(),
        "status": "selling",
        "starts_at": now + timedelta(days=10),
        "ends_at": now + timedelta(days=10, hours=2),
        "decision_days_before_start": 7,
        "min_tickets_to_confirm": 40,
        "max_tickets": 120,
        "tickets_sold": 12,
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
        "cinema_name": "Kinora Cinema",
        "hall_name": "Main Hall",
        "hall_capacity": 120,
        "location_id": uuid4(),
        "location_name": "Downtown",
        "location_address": "Ilica 1",
        "city_id": uuid4(),
        "city_name": "Zagreb",
    }
    data.update(overrides)
    return data


def _patch_admin_auth(monkeypatch, cinema_id):
    async def _fake_get_profile(self, session, user_id):
        return SimpleNamespace(role="cinema_admin")

    async def _fake_get_admin_cinema_id(self, session, user_id):
        return cinema_id

    monkeypatch.setattr(ProfileService, "get_by_user_id", _fake_get_profile)
    monkeypatch.setattr(CampaignService, "get_admin_cinema_id", _fake_get_admin_cinema_id)
    _set_overrides({"id": str(uuid4()), "app_metadata": {}, "user_metadata": {}})


def test_campaign_create_update_publish_resolve_cancel_buttons_call_services(monkeypatch) -> None:
    cinema_id = uuid4()
    campaign_id = uuid4()
    hall_id = uuid4()
    calls: list[str] = []

    _patch_admin_auth(monkeypatch, cinema_id)

    async def _fake_create(self, session, payload, user_id, cinema_id):
        calls.append("create")
        return SimpleNamespace(id=campaign_id)

    async def _fake_get_campaign(self, session, requested_campaign_id):
        calls.append("get")
        return SimpleNamespace(id=campaign_id, cinema_id=cinema_id)

    def _fake_assert_ownership(self, campaign, requested_cinema_id):
        calls.append("own")

    async def _fake_update(self, session, campaign, payload):
        calls.append("update")
        return campaign

    async def _fake_publish(self, session, campaign):
        calls.append("publish")
        return campaign

    async def _fake_resolve(self, session, campaign):
        calls.append("resolve")
        return campaign

    async def _fake_cancel(self, session, campaign):
        calls.append("cancel")
        return campaign

    async def _fake_enrich(self, session, campaign):
        return _campaign_row(id=campaign_id, cinema_id=cinema_id, hall_id=hall_id)

    monkeypatch.setattr(CampaignService, "create_campaign", _fake_create)
    monkeypatch.setattr(CampaignService, "get_campaign", _fake_get_campaign)
    monkeypatch.setattr(CampaignService, "assert_ownership", _fake_assert_ownership)
    monkeypatch.setattr(CampaignService, "update_campaign", _fake_update)
    monkeypatch.setattr(CampaignService, "publish_campaign", _fake_publish)
    monkeypatch.setattr(CampaignService, "resolve_campaign", _fake_resolve)
    monkeypatch.setattr(CampaignService, "cancel_campaign", _fake_cancel)
    monkeypatch.setattr(CampaignService, "enrich_campaign", _fake_enrich)

    create_response = client.post("/api/v1/campaigns", json=_campaign_payload(hall_id))
    update_response = client.patch(f"/api/v1/campaigns/{campaign_id}", json={"title": "Updated"})
    publish_response = client.post(f"/api/v1/campaigns/{campaign_id}/publish")
    resolve_response = client.post(f"/api/v1/campaigns/{campaign_id}/resolve")
    cancel_response = client.post(f"/api/v1/campaigns/{campaign_id}/cancel")
    _clear_overrides()

    assert create_response.status_code == 201
    assert update_response.status_code == 200
    assert publish_response.status_code == 200
    assert resolve_response.status_code == 200
    assert cancel_response.status_code == 200
    assert "create" in calls
    assert "update" in calls
    assert "publish" in calls
    assert "resolve" in calls
    assert "cancel" in calls


def test_campaign_movie_add_remove_buttons_call_services(monkeypatch) -> None:
    cinema_id = uuid4()
    campaign_id = uuid4()
    campaign_movie_id = uuid4()
    movie_id = uuid4()
    calls: list[str] = []

    _patch_admin_auth(monkeypatch, cinema_id)

    async def _fake_get_campaign(self, session, requested_campaign_id):
        return SimpleNamespace(id=campaign_id, cinema_id=cinema_id)

    def _fake_assert_ownership(self, campaign, requested_cinema_id):
        calls.append("own")

    async def _fake_add(self, session, campaign, movie_id, sort_order):
        calls.append("add")
        return SimpleNamespace(
            id=campaign_movie_id,
            campaign_id=campaign_id,
            movie_id=movie_id,
            sort_order=sort_order,
            is_winner=False,
        )

    async def _fake_remove(self, session, campaign, campaign_movie_id):
        calls.append("remove")

    monkeypatch.setattr(CampaignService, "get_campaign", _fake_get_campaign)
    monkeypatch.setattr(CampaignService, "assert_ownership", _fake_assert_ownership)
    monkeypatch.setattr(CampaignService, "add_campaign_movie", _fake_add)
    monkeypatch.setattr(CampaignService, "remove_campaign_movie", _fake_remove)

    add_response = client.post(
        f"/api/v1/campaigns/{campaign_id}/movies",
        json={"movie_id": str(movie_id), "sort_order": 1},
    )
    remove_response = client.delete(f"/api/v1/campaigns/{campaign_id}/movies/{campaign_movie_id}")
    _clear_overrides()

    assert add_response.status_code == 201
    assert remove_response.status_code == 204
    assert calls.count("add") == 1
    assert calls.count("remove") == 1


def test_screening_open_confirm_cancel_buttons_call_services(monkeypatch) -> None:
    cinema_id = uuid4()
    screening_id = uuid4()
    calls: list[str] = []

    _patch_admin_auth(monkeypatch, cinema_id)

    async def _fake_get_screening_orm(self, session, requested_screening_id):
        return SimpleNamespace(id=screening_id, cinema_id=cinema_id)

    def _fake_assert_ownership(self, screening, requested_cinema_id):
        calls.append("own")

    async def _fake_open(self, session, screening):
        calls.append("open")
        return _screening_row(id=screening_id, cinema_id=cinema_id, status="selling")

    async def _fake_confirm(self, session, screening):
        calls.append("confirm")
        return _screening_row(id=screening_id, cinema_id=cinema_id, status="confirmed")

    async def _fake_cancel(self, session, screening, reason):
        calls.append(f"cancel:{reason}")
        return _screening_row(
            id=screening_id,
            cinema_id=cinema_id,
            status="cancelled",
            cancel_reason=reason,
        )

    monkeypatch.setattr(ScreeningService, "get_screening_orm", _fake_get_screening_orm)
    monkeypatch.setattr(ScreeningService, "assert_ownership", _fake_assert_ownership)
    monkeypatch.setattr(ScreeningService, "open_sales", _fake_open)
    monkeypatch.setattr(ScreeningService, "confirm_screening", _fake_confirm)
    monkeypatch.setattr(ScreeningService, "cancel_screening", _fake_cancel)

    open_response = client.post(f"/api/v1/screenings/{screening_id}/open-sales")
    confirm_response = client.post(f"/api/v1/screenings/{screening_id}/confirm")
    cancel_response = client.post(
        f"/api/v1/screenings/{screening_id}/cancel",
        json={"reason": "cancelled_by_cinema"},
    )
    _clear_overrides()

    assert open_response.status_code == 200
    assert confirm_response.status_code == 200
    assert cancel_response.status_code == 200
    assert "open" in calls
    assert "confirm" in calls
    assert "cancel:cancelled_by_cinema" in calls
