import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PrivateBookingStatus(str, PyEnum):
	submitted = "submitted"
	in_review = "in_review"
	offered = "offered"
	rejected = "rejected"
	accepted = "accepted"
	paid = "paid"
	cancelled = "cancelled"


class PrivateBookingRequest(Base):
	"""Private booking request workflow entity."""

	__tablename__ = "private_booking_requests"
	__table_args__ = {"schema": "public"}

	id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
	requester_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.profiles.user_id"))
	cinema_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.cinemas.id"))
	preferred_location_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
	preferred_start_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
	preferred_end_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
	group_size: Mapped[int] = mapped_column(Integer, nullable=False)
	event_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
	notes: Mapped[str | None] = mapped_column(Text)
	status: Mapped[PrivateBookingStatus] = mapped_column(
		Enum(PrivateBookingStatus, name="private_booking_status", schema="public"),
		nullable=False,
	)
	offered_location_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
	offered_hall_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
	offered_start_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
	offered_end_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
	quoted_price_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
	currency: Mapped[str] = mapped_column(String, nullable=False)
	cinema_response_message: Mapped[str | None] = mapped_column(Text)
	responded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
	responded_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
	accepted_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
	order_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
	cancelled_at: Mapped[datetime | None] = mapped_column(
		TIMESTAMP(timezone=True),
		nullable=True,
		insert_default=None,
	)
	cancelled_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("public.profiles.user_id"),
		nullable=True,
		insert_default=None,
	)
	cancellation_reason: Mapped[str | None] = mapped_column(Text, insert_default=None)
	created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
	updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)

