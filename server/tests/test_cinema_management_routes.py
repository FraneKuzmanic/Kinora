from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api.deps.auth import get_current_user
from app.api.deps.db import get_db
from app.main import app
from app.models.cinema import CinemaLocation
from app.models.geography import City, Country
from app.schemas.cinema import CinemaLocationCreate
from app.services.campaign_service import CampaignService
from app.services.cinema_service import CinemaService
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


def _cinema_row(**overrides):
    now = datetime.now(UTC)
    data = {
        "id": uuid4(),
        "name": "Kinora Cinema",
        "description": "Test cinema",
        "website": "https://cinema.example.com",
        "email": "cinema@example.com",
        "phone": "+385123456",
        "logo_url": "http://localhost:8000/api/v1/cinemas/demo/logo",
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    data.update(overrides)
    return data


def _location_row(**overrides):
    now = datetime.now(UTC)
    data = {
        "id": uuid4(),
        "cinema_id": uuid4(),
        "city_id": uuid4(),
        "city_name": "Zagreb",
        "location_name": "Downtown",
        "address_line1": "Ilica 1",
        "address_line2": None,
        "postal_code": "10000",
        "lat": 45.81,
        "lon": 15.98,
        "timezone": "Europe/Zagreb",
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    data.update(overrides)
    return data


def _hall_row(**overrides):
    now = datetime.now(UTC)
    data = {
        "id": uuid4(),
        "location_id": uuid4(),
        "name": "Main Hall",
        "capacity": 120,
        "allow_private_booking": True,
        "created_at": now,
        "updated_at": now,
    }
    data.update(overrides)
    return data


def _validator_row(**overrides):
    now = datetime.now(UTC)
    data = {
        "validator_user_id": uuid4(),
        "display_name": "Gate Staff",
        "email": "validator@example.com",
        "granted_at": now,
        "revoked_at": None,
        "is_active": True,
    }
    data.update(overrides)
    return data


class _ScalarResult:
    def __init__(self, value=None):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class _CityResolutionSession:
    def __init__(self, execute_values):
        self.execute_values = list(execute_values)
        self.known = list(execute_values)
        self.added = []
        self.flushed = 0
        self.committed = False

    async def execute(self, statement):
        return _ScalarResult(self.execute_values.pop(0))

    def add(self, item):
        self.added.append(item)

    async def flush(self):
        self.flushed += 1

    async def commit(self):
        self.committed = True

    async def get(self, model, item_id):
        for item in self.added:
            if isinstance(item, model) and item.id == item_id:
                return item
        for value in self.known:
            if isinstance(value, model) and value.id == item_id:
                return value
        return None


def test_get_my_cinema_returns_owned_cinema(monkeypatch) -> None:
    cinema_id = uuid4()
    row = _cinema_row(id=cinema_id)

    async def _fake_get_profile(self, session, user_id):
        return SimpleNamespace(role="cinema_admin")

    async def _fake_get_admin_cinema_id(self, session, user_id):
        return cinema_id

    async def _fake_get_cinema(self, session, requested_cinema_id):
        assert requested_cinema_id == cinema_id
        return row

    monkeypatch.setattr(ProfileService, "get_by_user_id", _fake_get_profile)
    monkeypatch.setattr(CampaignService, "get_admin_cinema_id", _fake_get_admin_cinema_id)
    monkeypatch.setattr(CinemaService, "get_cinema", _fake_get_cinema)

    _set_overrides({"id": str(uuid4()), "app_metadata": {}, "user_metadata": {}})
    response = client.get("/api/v1/cinemas/me")
    _clear_overrides()

    assert response.status_code == 200
    assert response.json()["id"] == str(cinema_id)


def test_update_cinema_forbidden_when_not_owned(monkeypatch) -> None:
    requested_cinema_id = uuid4()
    owned_cinema_id = uuid4()

    async def _fake_get_profile(self, session, user_id):
        return SimpleNamespace(role="cinema_admin")

    async def _fake_get_admin_cinema_id(self, session, user_id):
        return owned_cinema_id

    async def _fake_get_cinema_orm(self, session, cinema_id):
        raise AssertionError("get_cinema_orm should not be called when ownership fails")

    monkeypatch.setattr(ProfileService, "get_by_user_id", _fake_get_profile)
    monkeypatch.setattr(CampaignService, "get_admin_cinema_id", _fake_get_admin_cinema_id)
    monkeypatch.setattr(CinemaService, "get_cinema_orm", _fake_get_cinema_orm)

    _set_overrides({"id": str(uuid4()), "app_metadata": {}, "user_metadata": {}})
    response = client.patch(f"/api/v1/cinemas/{requested_cinema_id}", json={"name": "Updated"})
    _clear_overrides()

    assert response.status_code == 403


def test_update_cinema_success(monkeypatch) -> None:
    cinema_id = uuid4()
    row = _cinema_row(id=cinema_id, name="Updated Cinema")

    async def _fake_get_profile(self, session, user_id):
        return SimpleNamespace(role="cinema_admin")

    async def _fake_get_admin_cinema_id(self, session, user_id):
        return cinema_id

    async def _fake_get_cinema_orm(self, session, requested_cinema_id):
        return SimpleNamespace(id=requested_cinema_id)

    async def _fake_update_cinema(self, session, cinema, payload):
        assert payload.name == "Updated Cinema"
        return row

    monkeypatch.setattr(ProfileService, "get_by_user_id", _fake_get_profile)
    monkeypatch.setattr(CampaignService, "get_admin_cinema_id", _fake_get_admin_cinema_id)
    monkeypatch.setattr(CinemaService, "get_cinema_orm", _fake_get_cinema_orm)
    monkeypatch.setattr(CinemaService, "update_cinema", _fake_update_cinema)

    _set_overrides({"id": str(uuid4()), "app_metadata": {}, "user_metadata": {}})
    response = client.patch(f"/api/v1/cinemas/{cinema_id}", json={"name": "Updated Cinema"})
    _clear_overrides()

    assert response.status_code == 200
    assert response.json()["name"] == "Updated Cinema"


def test_upload_logo_accepts_image(monkeypatch) -> None:
    cinema_id = uuid4()
    row = _cinema_row(id=cinema_id)

    async def _fake_get_profile(self, session, user_id):
        return SimpleNamespace(role="cinema_admin")

    async def _fake_get_admin_cinema_id(self, session, user_id):
        return cinema_id

    async def _fake_get_cinema_orm(self, session, requested_cinema_id):
        return SimpleNamespace(id=requested_cinema_id, logo_path=None)

    async def _fake_store_logo(self, session, *, cinema, upload_file):
        assert cinema.id == cinema_id
        assert upload_file.content_type == "image/png"
        assert await upload_file.read() == b"fake-image"
        return row

    monkeypatch.setattr(ProfileService, "get_by_user_id", _fake_get_profile)
    monkeypatch.setattr(CampaignService, "get_admin_cinema_id", _fake_get_admin_cinema_id)
    monkeypatch.setattr(CinemaService, "get_cinema_orm", _fake_get_cinema_orm)
    monkeypatch.setattr(CinemaService, "store_logo", _fake_store_logo)

    _set_overrides({"id": str(uuid4()), "app_metadata": {}, "user_metadata": {}})
    response = client.post(
        f"/api/v1/cinemas/{cinema_id}/logo",
        files={"logo": ("logo.png", b"fake-image", "image/png")},
    )
    _clear_overrides()

    assert response.status_code == 200
    assert response.json()["logo_url"] == row["logo_url"]


def test_get_logo_serves_file(monkeypatch, tmp_path: Path) -> None:
    logo_path = tmp_path / "logo.png"
    logo_path.write_bytes(b"png-data")

    async def _fake_get_logo_file(self, session, cinema_id):
        return logo_path, "image/png"

    monkeypatch.setattr(CinemaService, "get_logo_file", _fake_get_logo_file)
    app.dependency_overrides[get_db] = _override_db

    response = client.get(f"/api/v1/cinemas/{uuid4()}/logo")
    _clear_overrides()

    assert response.status_code == 200
    assert response.content == b"png-data"
    assert response.headers["content-type"] == "image/png"


def test_create_update_delete_location(monkeypatch) -> None:
    cinema_id = uuid4()
    location_id = uuid4()
    created_row = _location_row(id=location_id, cinema_id=cinema_id, location_name="Downtown")
    updated_row = _location_row(id=location_id, cinema_id=cinema_id, location_name="Updated Downtown")
    deleted = {"called": False}

    async def _fake_get_profile(self, session, user_id):
        return SimpleNamespace(role="cinema_admin")

    async def _fake_get_admin_cinema_id(self, session, user_id):
        return cinema_id

    async def _fake_create_location(self, session, *, cinema_id, payload):
        assert payload.location_name == "Downtown"
        assert payload.city_name == "Zagreb"
        return created_row

    async def _fake_update_location(self, session, *, cinema_id, location_id, payload):
        assert payload.location_name == "Updated Downtown"
        assert payload.city_name == "Velika Gorica"
        return updated_row

    async def _fake_delete_location(self, session, *, cinema_id, location_id):
        deleted["called"] = True

    monkeypatch.setattr(ProfileService, "get_by_user_id", _fake_get_profile)
    monkeypatch.setattr(CampaignService, "get_admin_cinema_id", _fake_get_admin_cinema_id)
    monkeypatch.setattr(CinemaService, "create_location", _fake_create_location)
    monkeypatch.setattr(CinemaService, "update_location", _fake_update_location)
    monkeypatch.setattr(CinemaService, "delete_location", _fake_delete_location)

    _set_overrides({"id": str(uuid4()), "app_metadata": {}, "user_metadata": {}})
    create_response = client.post(
        f"/api/v1/cinemas/{cinema_id}/locations",
        json={
            "city_name": "Zagreb",
            "location_name": "Downtown",
            "address_line1": "Ilica 1",
            "postal_code": "10000",
            "lat": 45.81,
            "lon": 15.98,
            "timezone": "Europe/Zagreb",
            "is_active": True,
        },
    )
    update_response = client.patch(
        f"/api/v1/cinemas/{cinema_id}/locations/{location_id}",
        json={"city_name": "Velika Gorica", "location_name": "Updated Downtown"},
    )
    delete_response = client.delete(f"/api/v1/cinemas/{cinema_id}/locations/{location_id}")
    _clear_overrides()

    assert create_response.status_code == 201
    assert create_response.json()["location_name"] == "Downtown"
    assert update_response.status_code == 200
    assert update_response.json()["location_name"] == "Updated Downtown"
    assert delete_response.status_code == 204
    assert deleted["called"] is True


@pytest.mark.asyncio
async def test_create_location_resolves_existing_city_name_case_insensitively() -> None:
    country = Country(
        id=uuid4(),
        iso_code="HR",
        name="Croatia",
        created_at=datetime.now(UTC),
    )
    city = City(
        id=uuid4(),
        country_id=country.id,
        name="Zagreb",
        created_at=datetime.now(UTC),
    )
    session = _CityResolutionSession([country, city])
    cinema_id = uuid4()

    row = await CinemaService().create_location(
        session,
        cinema_id=cinema_id,
        payload=CinemaLocationCreate(
            city_name="  zagreb  ",
            location_name="Downtown",
            timezone="Europe/Zagreb",
        ),
    )

    assert row["city_id"] == city.id
    assert row["city_name"] == "Zagreb"
    assert not any(isinstance(item, City) for item in session.added)
    assert any(isinstance(item, CinemaLocation) and item.city_id == city.id for item in session.added)
    assert session.committed is True


@pytest.mark.asyncio
async def test_create_location_auto_creates_missing_city_under_croatia() -> None:
    session = _CityResolutionSession([None, None])
    cinema_id = uuid4()

    row = await CinemaService().create_location(
        session,
        cinema_id=cinema_id,
        payload=CinemaLocationCreate(
            city_name="Split",
            location_name="Seaside",
            timezone="Europe/Zagreb",
        ),
    )

    country = next(item for item in session.added if isinstance(item, Country))
    city = next(item for item in session.added if isinstance(item, City))
    location = next(item for item in session.added if isinstance(item, CinemaLocation))

    assert country.iso_code == "HR"
    assert country.name == "Croatia"
    assert city.name == "Split"
    assert city.country_id == country.id
    assert location.city_id == city.id
    assert row["city_name"] == "Split"
    assert session.flushed == 2
    assert session.committed is True


def test_delete_location_conflict_returns_409(monkeypatch) -> None:
    cinema_id = uuid4()
    location_id = uuid4()

    async def _fake_get_profile(self, session, user_id):
        return SimpleNamespace(role="cinema_admin")

    async def _fake_get_admin_cinema_id(self, session, user_id):
        return cinema_id

    async def _fake_delete_location(self, session, *, cinema_id, location_id):
        raise HTTPException(status_code=409, detail="Cinema location cannot be deleted because it is still in use")

    monkeypatch.setattr(ProfileService, "get_by_user_id", _fake_get_profile)
    monkeypatch.setattr(CampaignService, "get_admin_cinema_id", _fake_get_admin_cinema_id)
    monkeypatch.setattr(CinemaService, "delete_location", _fake_delete_location)

    _set_overrides({"id": str(uuid4()), "app_metadata": {}, "user_metadata": {}})
    response = client.delete(f"/api/v1/cinemas/{cinema_id}/locations/{location_id}")
    _clear_overrides()

    assert response.status_code == 409


def test_create_update_delete_hall(monkeypatch) -> None:
    cinema_id = uuid4()
    location_id = uuid4()
    hall_id = uuid4()
    created_row = _hall_row(id=hall_id, location_id=location_id, name="Main Hall")
    updated_row = _hall_row(id=hall_id, location_id=location_id, name="VIP Hall")
    deleted = {"called": False}

    async def _fake_get_profile(self, session, user_id):
        return SimpleNamespace(role="cinema_admin")

    async def _fake_get_admin_cinema_id(self, session, user_id):
        return cinema_id

    async def _fake_create_hall(self, session, *, cinema_id, location_id, payload):
        assert payload.name == "Main Hall"
        return created_row

    async def _fake_update_hall(self, session, *, cinema_id, location_id, hall_id, payload):
        assert payload.name == "VIP Hall"
        return updated_row

    async def _fake_delete_hall(self, session, *, cinema_id, location_id, hall_id):
        deleted["called"] = True

    monkeypatch.setattr(ProfileService, "get_by_user_id", _fake_get_profile)
    monkeypatch.setattr(CampaignService, "get_admin_cinema_id", _fake_get_admin_cinema_id)
    monkeypatch.setattr(CinemaService, "create_hall", _fake_create_hall)
    monkeypatch.setattr(CinemaService, "update_hall", _fake_update_hall)
    monkeypatch.setattr(CinemaService, "delete_hall", _fake_delete_hall)

    _set_overrides({"id": str(uuid4()), "app_metadata": {}, "user_metadata": {}})
    create_response = client.post(
        f"/api/v1/cinemas/{cinema_id}/locations/{location_id}/halls",
        json={"name": "Main Hall", "capacity": 120, "allow_private_booking": True},
    )
    update_response = client.patch(
        f"/api/v1/cinemas/{cinema_id}/locations/{location_id}/halls/{hall_id}",
        json={"name": "VIP Hall"},
    )
    delete_response = client.delete(f"/api/v1/cinemas/{cinema_id}/locations/{location_id}/halls/{hall_id}")
    _clear_overrides()

    assert create_response.status_code == 201
    assert create_response.json()["name"] == "Main Hall"
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "VIP Hall"
    assert delete_response.status_code == 204
    assert deleted["called"] is True


def test_delete_hall_conflict_returns_409(monkeypatch) -> None:
    cinema_id = uuid4()
    location_id = uuid4()
    hall_id = uuid4()

    async def _fake_get_profile(self, session, user_id):
        return SimpleNamespace(role="cinema_admin")

    async def _fake_get_admin_cinema_id(self, session, user_id):
        return cinema_id

    async def _fake_delete_hall(self, session, *, cinema_id, location_id, hall_id):
        raise HTTPException(status_code=409, detail="Cinema hall cannot be deleted because it is still in use")

    monkeypatch.setattr(ProfileService, "get_by_user_id", _fake_get_profile)
    monkeypatch.setattr(CampaignService, "get_admin_cinema_id", _fake_get_admin_cinema_id)
    monkeypatch.setattr(CinemaService, "delete_hall", _fake_delete_hall)

    _set_overrides({"id": str(uuid4()), "app_metadata": {}, "user_metadata": {}})
    response = client.delete(f"/api/v1/cinemas/{cinema_id}/locations/{location_id}/halls/{hall_id}")
    _clear_overrides()

    assert response.status_code == 409


def test_list_cinema_validators(monkeypatch) -> None:
    cinema_id = uuid4()
    rows = [_validator_row(), _validator_row(email="second@example.com")]

    async def _fake_get_profile(self, session, user_id):
        return SimpleNamespace(role="cinema_admin")

    async def _fake_get_admin_cinema_id(self, session, user_id):
        return cinema_id

    async def _fake_list_validators(self, session, *, cinema_id):
        return rows

    monkeypatch.setattr(ProfileService, "get_by_user_id", _fake_get_profile)
    monkeypatch.setattr(CampaignService, "get_admin_cinema_id", _fake_get_admin_cinema_id)
    monkeypatch.setattr(CinemaService, "list_validators", _fake_list_validators)

    _set_overrides({"id": str(uuid4()), "app_metadata": {}, "user_metadata": {}})
    response = client.get(f"/api/v1/cinemas/{cinema_id}/validators")
    _clear_overrides()

    assert response.status_code == 200
    assert len(response.json()) == 2
    assert response.json()[0]["email"] == "validator@example.com"


def test_create_cinema_validator_account(monkeypatch) -> None:
    cinema_id = uuid4()
    row = _validator_row(display_name="Created Validator", email="new-validator@example.com")

    async def _fake_get_profile(self, session, user_id):
        return SimpleNamespace(role="cinema_admin")

    async def _fake_get_admin_cinema_id(self, session, user_id):
        return cinema_id

    async def _fake_create_validator_account(self, session, *, cinema_id, granted_by_user_id, payload):
        assert payload.email == "new-validator@example.com"
        assert payload.password == "TempPass123"
        assert payload.display_name == "Created Validator"
        return row

    monkeypatch.setattr(ProfileService, "get_by_user_id", _fake_get_profile)
    monkeypatch.setattr(CampaignService, "get_admin_cinema_id", _fake_get_admin_cinema_id)
    monkeypatch.setattr(CinemaService, "create_validator_account", _fake_create_validator_account)

    _set_overrides({"id": str(uuid4()), "app_metadata": {}, "user_metadata": {}})
    response = client.post(
        f"/api/v1/cinemas/{cinema_id}/validators/create",
        json={
            "email": "new-validator@example.com",
            "password": "TempPass123",
            "display_name": "Created Validator",
        },
    )
    _clear_overrides()

    assert response.status_code == 201
    assert response.json()["email"] == "new-validator@example.com"
    assert response.json()["display_name"] == "Created Validator"


def test_revoke_cinema_validator(monkeypatch) -> None:
    cinema_id = uuid4()
    validator_user_id = uuid4()
    row = _validator_row(validator_user_id=validator_user_id, revoked_at=datetime.now(UTC), is_active=False)

    async def _fake_get_profile(self, session, user_id):
        return SimpleNamespace(role="cinema_admin")

    async def _fake_get_admin_cinema_id(self, session, user_id):
        return cinema_id

    async def _fake_revoke_validator(self, session, *, cinema_id, validator_user_id):
        return row

    monkeypatch.setattr(ProfileService, "get_by_user_id", _fake_get_profile)
    monkeypatch.setattr(CampaignService, "get_admin_cinema_id", _fake_get_admin_cinema_id)
    monkeypatch.setattr(CinemaService, "revoke_validator", _fake_revoke_validator)

    _set_overrides({"id": str(uuid4()), "app_metadata": {}, "user_metadata": {}})
    response = client.delete(f"/api/v1/cinemas/{cinema_id}/validators/{validator_user_id}")
    _clear_overrides()

    assert response.status_code == 200
    assert response.json()["is_active"] is False
