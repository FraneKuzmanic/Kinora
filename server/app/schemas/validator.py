from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class RedemptionRequest(BaseModel):
    """Validator redemption payload with optional context metadata."""

    location_id: UUID | None = None
    hall_id: UUID | None = None
    device_info: dict = Field(default_factory=dict)


class RedemptionResponse(BaseModel):
    """Result returned after successful ticket redemption."""

    redemption_id: UUID
    admission_id: UUID
    redeemed_at: datetime
    status: str


class TicketValidationRequest(BaseModel):
    """Validator QR scan payload with optional scanner context."""

    location_id: UUID | None = None
    hall_id: UUID | None = None
    device_info: dict = Field(default_factory=dict)


class TicketValidationResponse(BaseModel):
    """Ticket state returned before optional redemption."""

    valid: bool
    redeemable: bool
    reason: str | None = None
    admission_id: UUID | None = None
    admission_status: str | None = None
    admission_type: str | None = None
    quantity: int | None = None
    screening_id: UUID | None = None
    campaign_movie_id: UUID | None = None
    movie_title: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    redeemed_at: datetime | None = None
    redemption_id: UUID | None = None


