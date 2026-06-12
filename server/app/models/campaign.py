import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CampaignStatus(str, PyEnum):
	draft = "draft"
	voting = "voting"
	resolved = "resolved"
	cancelled = "cancelled"


class Campaign(Base):
	"""Voting campaign published by a cinema."""

	__tablename__ = "campaigns"
	__table_args__ = {"schema": "public"}

	id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
	cinema_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.cinemas.id"))
	hall_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.cinema_halls.id"))
	title: Mapped[str] = mapped_column(String, nullable=False)
	description: Mapped[str | None] = mapped_column(Text)
	status: Mapped[CampaignStatus] = mapped_column(
		Enum(CampaignStatus, name="campaign_status", schema="public"),
		nullable=False,
	)
	voting_starts_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
	voting_ends_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
	voting_duration_days: Mapped[int] = mapped_column(Integer, nullable=False, default=7)
	slot_starts_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
	slot_ends_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
	decision_days_before_screening: Mapped[int] = mapped_column(Integer, nullable=False, default=7)
	min_tickets_to_confirm: Mapped[int] = mapped_column(Integer, nullable=False)
	max_tickets: Mapped[int | None] = mapped_column(Integer, nullable=True)
	ticket_price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
	winning_movie_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
	resolved_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
	created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
	created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
	updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)


class CampaignMovie(Base):
	"""Movie option attached to a campaign."""

	__tablename__ = "campaign_movies"
	__table_args__ = {"schema": "public"}

	id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
	campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.campaigns.id"))
	movie_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.movies.id"))
	sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
	is_winner: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
	created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)


class CampaignVote(Base):
	"""Single vote by one user in one campaign."""

	__tablename__ = "campaign_votes"
	__table_args__ = {"schema": "public"}

	id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
	campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.campaigns.id"))
	campaign_movie_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.campaign_movies.id"))
	user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.profiles.user_id"))
	created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)

