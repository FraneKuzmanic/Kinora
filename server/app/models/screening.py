import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Enum, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ScreeningStatus(str, PyEnum):
	scheduled = "scheduled"
	selling = "selling"
	pending = "pending"
	confirmed = "confirmed"
	cancelled = "cancelled"


class Screening(Base):
	"""Screening slot, optionally created from a campaign."""

	__tablename__ = "screenings"
	__table_args__ = {"schema": "public"}

	id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
	cinema_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.cinemas.id"))
	hall_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.cinema_halls.id"))
	movie_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.movies.id"))
	campaign_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
	status: Mapped[ScreeningStatus] = mapped_column(
		Enum(ScreeningStatus, name="screening_status", schema="public"),
		nullable=False,
	)
	starts_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
	ends_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
	decision_days_before_start: Mapped[int] = mapped_column(Integer, nullable=False, default=7)
	min_tickets_to_confirm: Mapped[int] = mapped_column(Integer, nullable=False)
	max_tickets: Mapped[int | None] = mapped_column(Integer, nullable=True)
	pending_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
	pending_expires_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
	ticket_price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
	confirmed_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
	cancelled_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
	cancel_reason: Mapped[str | None] = mapped_column(Text)
	created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
	created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
	updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)

