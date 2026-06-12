from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CampaignRead(BaseModel):
    """Full campaign payload returned by all campaign endpoints."""

    id: UUID
    cinema_id: UUID
    hall_id: UUID
    cinema_name: str
    hall_name: str
    hall_capacity: int
    city_id: UUID
    city_name: str
    location_name: str | None = None
    title: str
    description: str | None = None
    status: str
    voting_starts_at: datetime | None = None
    voting_ends_at: datetime | None = None
    voting_duration_days: int
    slot_starts_at: datetime
    slot_ends_at: datetime
    decision_days_before_screening: int
    min_tickets_to_confirm: int
    max_tickets: int | None = None
    ticket_price_cents: int
    winning_movie_id: UUID | None = None
    resolved_at: datetime | None = None


class CampaignCreate(BaseModel):
    """
    Payload for creating a new campaign (cinema_admin only).

    The campaign is created in `draft` status. The admin's cinema is resolved
    from their cinema_memberships row — no cinema_id in the request body.

    Voting starts when the campaign is published.
    Publish computes voting window as now() + voting_duration_days.
    """

    hall_id: UUID
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    slot_starts_at: datetime
    slot_ends_at: datetime
    voting_duration_days: int = Field(7, ge=1, le=90)
    decision_days_before_screening: int = Field(7, ge=0, le=60)
    min_tickets_to_confirm: int = Field(..., gt=0)
    max_tickets: int | None = None   # passed through to the auto-created screening
    ticket_price_cents: int = Field(..., gt=0)


class CampaignUpdate(BaseModel):
    """
    Partial update payload for a campaign in `draft` status (cinema_admin only).

    Only fields provided are updated. Slot ordering constraints are validated
    against the merged (existing + new) values.
    """

    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    slot_starts_at: datetime | None = None
    slot_ends_at: datetime | None = None
    voting_duration_days: int | None = Field(None, ge=1, le=90)
    decision_days_before_screening: int | None = Field(None, ge=0, le=60)
    min_tickets_to_confirm: int | None = Field(None, gt=0)
    max_tickets: int | None = Field(None, gt=0)
    ticket_price_cents: int | None = Field(None, gt=0)


class CampaignMovieRead(BaseModel):
    """Candidate movie slot attached to a campaign."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    campaign_id: UUID
    movie_id: UUID
    sort_order: int
    is_winner: bool


class CampaignMovieStats(BaseModel):
    """
    Candidate movie with engagement counters and metadata for the campaign detail view.

    vote_count: total votes cast for this movie (always visible).
    ticket_count: early-bird admissions sold; only populated for cinema_admin who owns
                  the campaign, None otherwise.
    """

    id: UUID
    campaign_id: UUID
    movie_id: UUID
    sort_order: int
    is_winner: bool
    vote_count: int = 0
    ticket_count: int | None = None
    movie_title: str
    movie_release_year: int | None = None
    movie_poster_url: str | None = None
    movie_overview: str | None = None
    movie_runtime_minutes: int | None = None


class CampaignDetailRead(CampaignRead):
    """
    Full campaign detail including per-movie engagement stats.

    Returned by GET /campaigns/{id}. ticket_count on each movie is only
    populated when the caller is the cinema_admin who owns the campaign.
    """

    current_user_vote_campaign_movie_id: UUID | None = None
    total_early_bird_tickets: int = 0
    movies: list[CampaignMovieStats] = []


class CampaignDiscoverMovieRead(BaseModel):
    """Compact candidate-movie payload for Discover campaign cards."""

    id: UUID
    movie_id: UUID
    sort_order: int
    vote_count: int = 0
    movie_title: str
    movie_poster_url: str | None = None
    is_leading: bool = False


class CampaignDiscoverCardRead(BaseModel):
    """Single enriched campaign card payload for the Discover rail."""

    id: UUID
    created_at: datetime
    cinema_name: str
    location_name: str | None = None
    city_name: str
    slot_starts_at: datetime
    voting_ends_at: datetime | None = None
    leading_movie_title: str
    leading_movie_vote_count: int = 0
    total_voters: int = 0
    current_user_vote_campaign_movie_id: UUID | None = None
    movies: list[CampaignDiscoverMovieRead] = []


class CampaignMovieCreate(BaseModel):
    """
    Payload for adding a candidate movie to a campaign (draft status only).

    sort_order controls display order in the UI; lower values appear first.
    Duplicate movie_id within the same campaign is rejected (DB unique constraint).
    """

    movie_id: UUID
    sort_order: int = 0


class CampaignFilter(BaseModel):
    """Body for POST /campaigns/search — all fields optional."""

    city_id: UUID | None = None
    cinema_id: UUID | None = None
    status: str | None = None        # draft | voting | resolved | cancelled


class CampaignVoteCreate(BaseModel):
    """Vote request payload; one user can vote once per campaign."""

    campaign_movie_id: UUID


class CampaignVoteRead(BaseModel):
    """Vote response payload."""

    id: UUID
    campaign_id: UUID
    campaign_movie_id: UUID
    user_id: UUID
    created_at: datetime
