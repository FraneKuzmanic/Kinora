import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class OrderStatus(str, PyEnum):
    pending = "pending"
    requires_capture = "requires_capture"
    paid = "paid"
    cancelled = "cancelled"
    refunded = "refunded"
    failed = "failed"


class PaymentStatus(str, PyEnum):
    requires_payment_method = "requires_payment_method"
    requires_confirmation = "requires_confirmation"
    requires_capture = "requires_capture"
    processing = "processing"
    succeeded = "succeeded"
    cancelled = "cancelled"
    refunded = "refunded"
    partially_refunded = "partially_refunded"
    failed = "failed"


class RefundStatus(str, PyEnum):
    requested = "requested"
    processing = "processing"
    succeeded = "succeeded"
    failed = "failed"
    cancelled = "cancelled"


class Order(Base):
    """Checkout order created before Stripe payment completes."""

    __tablename__ = "orders"
    __table_args__ = {"schema": "public"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    buyer_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.profiles.user_id"))
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="order_status", schema="public"),
        nullable=False,
    )
    currency: Mapped[str] = mapped_column(String, nullable=False)
    subtotal_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    fees_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)


class Payment(Base):
    """Payment provider record for an order."""

    __tablename__ = "payments"
    __table_args__ = {"schema": "public"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.orders.id"))
    provider: Mapped[str] = mapped_column(String, nullable=False, default="stripe")
    provider_payment_intent_id: Mapped[str] = mapped_column(String, nullable=False)
    provider_charge_id: Mapped[str | None] = mapped_column(String)
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status", schema="public"),
        nullable=False,
    )
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String, nullable=False)
    authorized_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    captured_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    failure_code: Mapped[str | None] = mapped_column(String)
    failure_message: Mapped[str | None] = mapped_column(Text)
    raw: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)


class Refund(Base):
    """Refund request/result for one payment."""

    __tablename__ = "refunds"
    __table_args__ = {"schema": "public"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    payment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.payments.id"))
    provider_refund_id: Mapped[str | None] = mapped_column(String)
    status: Mapped[RefundStatus] = mapped_column(
        Enum(RefundStatus, name="refund_status", schema="public"),
        nullable=False,
    )
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    requested_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("public.profiles.user_id"))
    requested_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    processed_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    raw: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class RefundLine(Base):
    """Admission-level allocation for a refund."""

    __tablename__ = "refund_lines"
    __table_args__ = {"schema": "public"}

    refund_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.refunds.id"),
        primary_key=True,
    )
    admission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.admissions.id"),
        primary_key=True,
    )
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)


class StripeWebhookEvent(Base):
    """Processed Stripe event id for webhook idempotency."""

    __tablename__ = "stripe_webhook_events"
    __table_args__ = {"schema": "public"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    processed_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    raw: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
