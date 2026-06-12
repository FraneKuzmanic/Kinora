from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CheckoutSessionCreate(BaseModel):
    """Request body for ticket checkout session creation."""

    quantity: int = Field(1, ge=1, le=20)
    coupon_id: UUID | None = None


class CheckoutSessionRead(BaseModel):
    """Stripe Checkout handoff payload."""

    order_id: UUID
    session_id: str
    checkout_url: str


class AdmissionRead(BaseModel):
    """Current user's admission/ticket with refund affordance."""

    id: UUID
    order_id: UUID
    type: str
    screening_id: UUID | None = None
    campaign_movie_id: UUID | None = None
    campaign_id: UUID | None = None
    quantity: int
    unit_price_cents: int
    total_price_cents: int
    status: str
    screening_status: str | None = None
    loss_decision: str
    qr_token: str
    created_at: datetime
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    redeemed_at: datetime | None = None
    cinema_name: str | None = None
    hall_name: str | None = None
    location_name: str | None = None
    location_address: str | None = None
    city_name: str | None = None
    movie_title: str
    movie_poster_url: str | None = None
    movie_release_year: int | None = None
    selected_movie_title: str | None = None
    selected_movie_poster_url: str | None = None
    selected_movie_release_year: int | None = None
    resolved_movie_title: str | None = None
    resolved_movie_poster_url: str | None = None
    resolved_movie_release_year: int | None = None
    campaign_title: str | None = None
    campaign_voting_ends_at: datetime | None = None
    campaign_slot_starts_at: datetime | None = None
    campaign_slot_ends_at: datetime | None = None
    refund_eligible: bool


class RefundRead(BaseModel):
    """Refund request result."""

    id: UUID
    admission_id: UUID
    status: str
    amount_cents: int
