from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.deps.db import get_db
from app.core.config import settings
from app.main import app
from app.services.campaign_service import CampaignService
from app.services.screening_service import ScreeningService


client = TestClient(app)


async def _override_db():
    yield None


def _set_overrides() -> None:
    app.dependency_overrides[get_db] = _override_db


def _clear_overrides() -> None:
    app.dependency_overrides.clear()


def test_campaign_share_preview_includes_open_graph_tags(monkeypatch) -> None:
    campaign_id = uuid4()

    async def _fake_get_campaign(self, session, requested_campaign_id):
        assert requested_campaign_id == str(campaign_id)
        return SimpleNamespace(id=campaign_id)

    async def _fake_enrich_campaign(self, session, campaign):
        return {
            "title": "Late Night Vote",
            "description": "Pick the next cult classic.",
            "cinema_name": "Kino Kinoteka",
            "city_name": "Zagreb",
        }

    async def _fake_movie_stats(self, session, requested_campaign_id, include_ticket_counts=False):
        return [
            {
                "movie_title": "Paris, Texas",
                "movie_poster_url": "https://image.tmdb.org/t/p/w780/poster.jpg",
                "vote_count": 12,
                "sort_order": 0,
                "is_winner": False,
            }
        ]

    monkeypatch.setattr(settings, "api_public_url", "https://api.kinora.test")
    monkeypatch.setattr(settings, "client_url", "https://kinora.test")
    monkeypatch.setattr(settings, "share_public_url", "https://kinora.test")
    monkeypatch.setattr(CampaignService, "get_campaign", _fake_get_campaign)
    monkeypatch.setattr(CampaignService, "enrich_campaign", _fake_enrich_campaign)
    monkeypatch.setattr(CampaignService, "get_campaign_movie_stats", _fake_movie_stats)

    _set_overrides()
    response = client.get(f"/share/campaigns/{campaign_id}")
    _clear_overrides()

    assert response.status_code == 200
    assert 'property="og:title" content="Late Night Vote on Kinora"' in response.text
    assert 'property="og:image" content="https://image.tmdb.org/t/p/w780/poster.jpg"' in response.text
    assert f'property="og:url" content="https://kinora.test/share/campaigns/{campaign_id}"' in response.text
    assert f"window.location.replace(\"https://kinora.test/campaigns/{campaign_id}\")" in response.text


def test_screening_share_preview_includes_open_graph_tags(monkeypatch) -> None:
    screening_id = uuid4()

    async def _fake_get_screening(self, session, requested_screening_id):
        assert requested_screening_id == str(screening_id)
        return {
            "movie_title": "Aftersun",
            "movie_overview": "A memory-soaked screening night.",
            "movie_poster_url": "https://image.tmdb.org/t/p/w780/aftersun.jpg",
            "cinema_name": "Kino Europa",
            "city_name": "Zagreb",
        }

    monkeypatch.setattr(settings, "api_public_url", "https://api.kinora.test")
    monkeypatch.setattr(settings, "client_url", "https://kinora.test")
    monkeypatch.setattr(settings, "share_public_url", "https://kinora.test")
    monkeypatch.setattr(ScreeningService, "get_screening", _fake_get_screening)

    _set_overrides()
    response = client.get(f"/share/screenings/{screening_id}")
    _clear_overrides()

    assert response.status_code == 200
    assert 'property="og:title" content="Aftersun on Kinora"' in response.text
    assert 'property="og:image" content="https://image.tmdb.org/t/p/w780/aftersun.jpg"' in response.text
    assert f'property="og:url" content="https://kinora.test/share/screenings/{screening_id}"' in response.text
    assert f"window.location.replace(\"https://kinora.test/screenings/{screening_id}\")" in response.text
