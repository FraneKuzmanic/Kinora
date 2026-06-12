import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CinemaMembership(Base):
    """Links a cinema_admin user to a cinema they manage."""

    __tablename__ = "cinema_memberships"
    __table_args__ = {"schema": "public"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    cinema_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.cinemas.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.profiles.user_id"))
    membership_role: Mapped[str] = mapped_column(String, nullable=False, server_default="admin")
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)


class CinemaValidatorPermission(Base):
    """Links a validator user to a cinema they are allowed to validate for."""

    __tablename__ = "cinema_validator_permissions"
    __table_args__ = {"schema": "public"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    cinema_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.cinemas.id"))
    validator_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.profiles.user_id"),
    )
    granted_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.profiles.user_id"),
        nullable=True,
    )
    granted_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)


class Cinema(Base):
	"""Cinema brand/partner root entity."""

	__tablename__ = "cinemas"
	__table_args__ = {"schema": "public"}

	id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
	name: Mapped[str] = mapped_column(String, nullable=False)
	description: Mapped[str | None] = mapped_column(Text)
	website: Mapped[str | None] = mapped_column(String)
	email: Mapped[str | None] = mapped_column(String)
	phone: Mapped[str | None] = mapped_column(String)
	logo_path: Mapped[str | None] = mapped_column(Text)
	is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
	created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
	updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)


class CinemaLocation(Base):
	"""Physical location for a cinema brand."""

	__tablename__ = "cinema_locations"
	__table_args__ = {"schema": "public"}

	id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
	cinema_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.cinemas.id"))
	city_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
	location_name: Mapped[str | None] = mapped_column(String)
	address_line1: Mapped[str | None] = mapped_column(String)
	address_line2: Mapped[str | None] = mapped_column(String)
	postal_code: Mapped[str | None] = mapped_column(String)
	lat: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
	lon: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
	timezone: Mapped[str] = mapped_column(String, nullable=False)
	is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
	created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
	updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)


class CinemaHall(Base):
	"""Hall under a specific cinema location."""

	__tablename__ = "cinema_halls"
	__table_args__ = {"schema": "public"}

	id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
	location_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.cinema_locations.id"))
	name: Mapped[str] = mapped_column(String, nullable=False)
	capacity: Mapped[int] = mapped_column(Integer, nullable=False)
	allow_private_booking: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
	created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
	updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)

