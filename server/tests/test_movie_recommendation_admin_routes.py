from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_recommendations_are_not_listed_for_cinema_admins() -> None:
    response = client.get("/api/v1/movie-recommendations")

    assert response.status_code == 405


def test_recommendations_are_not_moderated_by_cinema_admins() -> None:
    response = client.patch(
        f"/api/v1/movie-recommendations/{uuid4()}",
        json={"status": "accepted"},
    )

    assert response.status_code == 404
