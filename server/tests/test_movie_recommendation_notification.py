from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.notifications.service import NotificationService
from app.notifications.types import NotificationEvent, NotificationTemplate
from app.services.movie_recommendation_service import MovieRecommendationService


class RecordingRepository:
    def __init__(self) -> None:
        self.rows: list[dict] = []

    async def enqueue(self, session, **kwargs):
        self.rows.append(kwargs)
        return SimpleNamespace(**kwargs)


@pytest.mark.asyncio
async def test_enqueue_movie_request_arrived_notification(monkeypatch) -> None:
    repository = RecordingRepository()
    service = NotificationService(repository=repository)

    async def _fake_audience_email(self, session, user_id: str) -> str:
        assert user_id
        return "fan@example.com"

    monkeypatch.setattr(NotificationService, "_get_audience_email", _fake_audience_email)

    recommendation = SimpleNamespace(
        id=uuid4(),
        user_id=uuid4(),
        title="Interstellar",
    )
    campaign = SimpleNamespace(
        id=uuid4(),
        title="Space Classics Week",
    )

    recipient = await service.enqueue_movie_request_arrived_in_campaign(
        None,
        recommendation_id=recommendation.id,
        audience_user_id=recommendation.user_id,
        requested_movie_title=recommendation.title,
        requester_name="Karlo",
        campaign=campaign,
    )

    assert recipient == "fan@example.com"
    assert len(repository.rows) == 1
    row = repository.rows[0]
    assert row["event_type"] == NotificationEvent.movie_request_arrived_in_campaign.value
    assert row["template_key"] == NotificationTemplate.movie_request_arrived_in_campaign.value
    assert row["payload"]["requested_movie_title"] == "Interstellar"
    assert row["payload"]["requested_by_name"] == "Karlo"


@pytest.mark.asyncio
async def test_enqueue_movie_request_arrived_notification_uses_override(monkeypatch) -> None:
    repository = RecordingRepository()
    service = NotificationService(repository=repository)

    async def _unexpected_lookup(*args, **kwargs) -> str:
        raise AssertionError("audience lookup should be bypassed when email_notification is supplied")

    monkeypatch.setattr(NotificationService, "_get_audience_email", _unexpected_lookup)

    recommendation = SimpleNamespace(
        id=uuid4(),
        user_id=uuid4(),
        title="Interstellar",
    )
    campaign = SimpleNamespace(
        id=uuid4(),
        title="Space Classics Week",
    )

    recipient = await service.enqueue_movie_request_arrived_in_campaign(
        None,
        recommendation_id=recommendation.id,
        audience_user_id=recommendation.user_id,
        requested_movie_title=recommendation.title,
        requester_name="Karlo",
        campaign=campaign,
        email_notification="override@example.com",
    )

    assert recipient == "override@example.com"
    assert repository.rows[0]["to_email"] == "override@example.com"


@pytest.mark.asyncio
async def test_movie_recommendation_service_enqueues_arrivals_for_distinct_users(monkeypatch) -> None:
    notification_service = NotificationService(repository=RecordingRepository())
    service = MovieRecommendationService(notification_service=notification_service)
    user_id = uuid4()
    second_user_id = uuid4()
    campaign = SimpleNamespace(
        id=uuid4(),
        cinema_id=uuid4(),
        title="Sci-Fi Nights",
    )

    async def _fake_enqueue(
        self,
        session,
        *,
        recommendation_id,
        audience_user_id,
        requested_movie_title,
        requester_name,
        campaign,
        email_notification=None,
    ):
        assert recommendation_id
        assert audience_user_id in {user_id, second_user_id}
        assert requested_movie_title in {"Blade Runner", "Dune"}
        assert requester_name in {"Neo", "Trinity"}
        assert campaign.title == "Sci-Fi Nights"
        assert email_notification is None
        return f"{audience_user_id}@example.com"

    monkeypatch.setattr(
        NotificationService,
        "enqueue_movie_request_arrived_in_campaign",
        _fake_enqueue,
    )

    async def _fake_fetch(self, session, *, cinema_id, campaign_id):
        assert cinema_id == campaign.cinema_id
        assert campaign_id == campaign.id
        return [
            SimpleNamespace(
                id=uuid4(),
                user_id=user_id,
                title="Blade Runner",
                created_at=1,
                movie_title="Blade Runner",
                requester_display_name="Neo",
                campaign_movie_movie_id=uuid4(),
            ),
            SimpleNamespace(
                id=uuid4(),
                user_id=user_id,
                title="Blade Runner",
                created_at=2,
                movie_title="Blade Runner",
                requester_display_name="Neo",
                campaign_movie_movie_id=uuid4(),
            ),
            SimpleNamespace(
                id=uuid4(),
                user_id=second_user_id,
                title="Dune",
                created_at=3,
                movie_title="Dune",
                requester_display_name="Trinity",
                campaign_movie_movie_id=uuid4(),
            ),
        ]

    monkeypatch.setattr(
        MovieRecommendationService,
        "_fetch_visible_recommendations_for_campaign",
        _fake_fetch,
    )

    result = await service.enqueue_campaign_arrival_notifications(
        None,
        campaign=campaign,
    )

    assert result == 2
