import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AdmissionType(str, PyEnum):
	screening_ticket = "screening_ticket"
	campaign_earlybird = "campaign_earlybird"


class AdmissionStatus(str, PyEnum):
	pending_outcome = "pending_outcome"
	active = "active"
	lost_refund_pending = "lost_refund_pending"
	lost_no_refund = "lost_no_refund"
	refunded = "refunded"
	void = "void"
	used = "used"


class LossDecision(str, PyEnum):
	pending = "pending"
	refund = "refund"
	no_refund = "no_refund"


class Admission(Base):
	"""Purchased admission bundle represented by one QR token."""

	__tablename__ = "admissions"
	__table_args__ = {"schema": "public"}

	id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
	order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
	buyer_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
	type: Mapped[AdmissionType] = mapped_column(
		Enum(AdmissionType, name="admission_type", schema="public"),
		nullable=False,
	)
	screening_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
	campaign_movie_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
	quantity: Mapped[int] = mapped_column(Integer, nullable=False)
	unit_price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
	total_price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
	status: Mapped[AdmissionStatus] = mapped_column(
		Enum(AdmissionStatus, name="admission_status", schema="public"),
		nullable=False,
	)
	loss_decision: Mapped[LossDecision] = mapped_column(
		Enum(LossDecision, name="loss_decision", schema="public"),
		nullable=False,
	)
	loss_decided_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
	qr_token: Mapped[str] = mapped_column(String, nullable=False)
	qr_generated_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
	pdf_path: Mapped[str | None] = mapped_column(String)
	created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)


class AdmissionRedemption(Base):
	"""Single redemption event per admission."""

	__tablename__ = "admission_redemptions"
	__table_args__ = {"schema": "public"}

	id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
	admission_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.admissions.id"))
	redeemed_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
	validator_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.profiles.user_id"))
	location_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
	hall_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
	device_info: Mapped[dict] = mapped_column(JSONB, nullable=False)

