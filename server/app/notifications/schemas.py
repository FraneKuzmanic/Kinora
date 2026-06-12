from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class PrivateBookingSubmittedPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    booking_id: UUID
    cinema_id: UUID
    group_size: int
    preferred_start_at: datetime | None = None
    preferred_end_at: datetime | None = None
    notes: str | None = None
    cancel_url: str


class PrivateBookingReviewedPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    booking_id: UUID
    status: str
    quoted_price_cents: int | None = None
    currency: str
    offered_start_at: datetime | None = None
    offered_end_at: datetime | None = None
    cinema_response_message: str | None = None
    booking_url: str
    cancel_url: str


class PaymentOutcomePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    order_id: UUID
    payment_id: UUID
    admission_id: UUID | None = None
    amount_cents: int
    currency: str
    description: str | None = None
    quantity: int | None = None
    refund_url: str | None = None
    reason: str | None = None


class RefundOutcomePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    refund_id: UUID
    payment_id: UUID
    amount_cents: int
    currency: str
    reason: str | None = None


class ScreeningOutcomePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    campaign_id: UUID
    cinema_id: UUID
    title: str
    slot_starts_at: datetime
    slot_ends_at: datetime
    movie_title: str | None = None
    reason: str | None = None


class MovieRequestArrivedPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    recommendation_id: UUID
    requested_movie_title: str
    requested_by_name: str
    campaign_id: UUID
    campaign_title: str
    campaign_url: str
