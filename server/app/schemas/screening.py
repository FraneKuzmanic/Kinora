from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ScreeningRead(BaseModel):
    """
    Full screening payload for discovery and dashboard views.

    All display fields are included; the frontend never needs to make
    secondary requests to resolve names or counts.
    """

    id: UUID
    cinema_id: UUID
    hall_id: UUID
    movie_id: UUID
    campaign_id: UUID | None = None
    status: str
    starts_at: datetime
    ends_at: datetime
    decision_days_before_start: int
    min_tickets_to_confirm: int
    max_tickets: int           # effective cap (max_tickets column or hall_capacity)
    tickets_sold: int          # committed tickets: regular + early-bird combined
    ticket_price_cents: int
    pending_at: datetime | None = None
    pending_expires_at: datetime | None = None
    confirmed_at: datetime | None = None
    cancelled_at: datetime | None = None
    cancel_reason: str | None = None
    created_at: datetime
    # movie
    movie_title: str
    movie_release_year: int | None = None
    movie_poster_url: str | None = None
    movie_overview: str | None = None
    # cinema / hall
    cinema_name: str
    hall_name: str
    hall_capacity: int
    # location / city
    location_id: UUID
    location_name: str | None = None
    location_address: str | None = None
    city_id: UUID
    city_name: str


class ScreeningCreate(BaseModel):
    """Payload for creating a standalone screening (cinema_admin only)."""

    hall_id: UUID
    movie_id: UUID
    starts_at: datetime
    ends_at: datetime
    decision_days_before_start: int = Field(7, ge=0, le=60)
    min_tickets_to_confirm: int = Field(..., gt=0)
    max_tickets: int | None = None   # None -> hall capacity is the effective cap
    ticket_price_cents: int = Field(..., gt=0)


class ScreeningFilter(BaseModel):
    """Body for POST /screenings/search; all fields optional."""

    city_id: UUID | None = None
    cinema_id: UUID | None = None
    status: str | None = None        # scheduled | selling | pending | confirmed | cancelled
    date_from: datetime | None = None
    date_to: datetime | None = None


class ScreeningCancelRequest(BaseModel):
    """Optional reason when cancelling a screening."""

    reason: str | None = Field(None, min_length=1, max_length=500)


class ScreeningCancel(ScreeningCancelRequest):
    """Backward-compatible payment-branch cancel schema export."""
