from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.models.campaign import CampaignStatus
from app.services.campaign_service import CampaignService


class FakeScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class RecordingSession:
    def __init__(self, movie_id):
        self.movie_id = movie_id
        self.added = []
        self.commits = 0

    async def execute(self, statement):
        return FakeScalarResult(self.movie_id)

    def add(self, row):
        self.added.append(row)

    async def commit(self):
        self.commits += 1

    async def rollback(self):
        raise AssertionError("rollback should not be called")

    async def refresh(self, row):
        return None


@pytest.mark.asyncio
async def test_add_campaign_movie_accepts_any_catalog_movie() -> None:
    movie_id = uuid4()
    campaign = SimpleNamespace(
        id=uuid4(),
        cinema_id=uuid4(),
        status=CampaignStatus.draft,
    )
    session = RecordingSession(movie_id)

    entry = await CampaignService().add_campaign_movie(
        session,
        campaign=campaign,
        movie_id=movie_id,
        sort_order=1,
    )

    assert entry.movie_id == movie_id
    assert entry.campaign_id == campaign.id
    assert session.added == [entry]
    assert session.commits == 1
