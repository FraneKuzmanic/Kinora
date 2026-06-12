from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.deps.auth import get_current_user
from app.api.deps.db import get_db
from app.main import app
from app.services.movie_recommendation_service import MovieRecommendationService
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


def test_create_movie_recommendation_success(monkeypatch) -> None:
    async def _fake_get_profile(self, session, user_id):
        return SimpleNamespace(role="audience")

    recommendation = SimpleNamespace(
        id=uuid4(),
        user_id=uuid4(),
        cinema_id=uuid4(),
        city_id=None,
        movie_id=None,
        title="Interstellar",
        message="Please add it",
        status="new",
        created_at=datetime.now(UTC),
    )

    async def _fake_create(self, session, *, user_id, payload):
        assert user_id
        assert payload.title == "Interstellar"
        return recommendation

    monkeypatch.setattr(ProfileService, "get_by_user_id", _fake_get_profile)
    monkeypatch.setattr(MovieRecommendationService, "create_recommendation", _fake_create)

    _set_overrides({"id": str(uuid4()), "app_metadata": {"role": "audience"}, "user_metadata": {}})
    response = client.post(
        "/api/v1/movie-recommendations",
        json={
            "cinema_id": str(uuid4()),
            "title": "Interstellar",
            "message": "Please add it",
        },
    )
    _clear_overrides()

    assert response.status_code == 201
    assert response.json()["title"] == "Interstellar"
