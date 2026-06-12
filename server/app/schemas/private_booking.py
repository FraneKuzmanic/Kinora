from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PrivateBookingCreate(BaseModel):
    """Audience request payload for private booking flow."""

    cinema_id: UUID
    preferred_location_id: UUID | None = None
    preferred_start_at: datetime | None = None
    preferred_end_at: datetime | None = None
    group_size: int = Field(..., ge=1)
    event_type: str = Field(..., min_length=1, max_length=100)
    notes: str | None = None


class PrivateBookingReview(BaseModel):
    """Cinema admin response payload for submitted booking requests."""

    status: Literal["in_review", "offered", "rejected"]
    offered_location_id: UUID | None = None
    offered_hall_id: UUID | None = None
    offered_start_at: datetime | None = None
    offered_end_at: datetime | None = None
    quoted_price_cents: int | None = Field(default=None, ge=0)
    cinema_response_message: str | None = None


class PrivateBookingCancel(BaseModel):
    """Cancellation payload for requester and cinema-admin booking cancellation."""

    reason: str | None = None


class PrivateBookingRequestedDateStats(BaseModel):
    """Most requested private-booking calendar date."""

    date: str
    request_count: int


class PrivateBookingRequestedTimeRangeStats(BaseModel):
    """Most requested private-booking hour bucket."""

    hour: str
    request_count: int


class PrivateBookingAnalyticsRead(BaseModel):
    """Private-booking analytics for a cinema admin's cinema."""

    request_count: int
    approved_count: int
    rejected_count: int
    approval_rate: float
    average_group_size: float | None = None
    most_requested_dates: list[PrivateBookingRequestedDateStats]
    most_requested_time_ranges: list[PrivateBookingRequestedTimeRangeStats]


class PrivateBookingRead(BaseModel):
    """Private booking payload for audience and cinema dashboards."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    requester_user_id: UUID
    cinema_id: UUID
    preferred_location_id: UUID | None = None
    preferred_start_at: datetime | None = None
    preferred_end_at: datetime | None = None
    group_size: int
    event_type: str | None = None
    status: str
    notes: str | None = None
    offered_location_id: UUID | None = None
    offered_hall_id: UUID | None = None
    offered_start_at: datetime | None = None
    offered_end_at: datetime | None = None
    quoted_price_cents: int | None = None
    currency: str
    cinema_response_message: str | None = None
    responded_by_user_id: UUID | None = None
    responded_at: datetime | None = None
    accepted_at: datetime | None = None
    order_id: UUID | None = None
    cancelled_at: datetime | None = None
    cancelled_by_user_id: UUID | None = None
    cancellation_reason: str | None = None
    created_at: datetime
    updated_at: datetime

