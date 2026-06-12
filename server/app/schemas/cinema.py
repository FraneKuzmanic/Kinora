from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CinemaRead(BaseModel):
	"""Public cinema payload for list/detail endpoints."""

	model_config = ConfigDict(from_attributes=True)

	id: UUID
	name: str
	description: str | None = None
	website: str | None = None
	email: str | None = None
	phone: str | None = None
	logo_url: str | None = None
	is_active: bool
	created_at: datetime
	updated_at: datetime


class CinemaUpdate(BaseModel):
	"""Editable cinema fields for cinema admins."""

	name: str | None = Field(default=None, min_length=1, max_length=255)
	description: str | None = Field(default=None, max_length=4000)
	website: str | None = Field(default=None, max_length=1000)
	email: str | None = Field(default=None, max_length=320)
	phone: str | None = Field(default=None, max_length=64)
	is_active: bool | None = None


class CinemaLocationRead(BaseModel):
	"""Location payload for cinema-management endpoints."""

	model_config = ConfigDict(from_attributes=True)

	id: UUID
	cinema_id: UUID
	city_id: UUID | None = None
	city_name: str | None = None
	location_name: str | None = None
	address_line1: str | None = None
	address_line2: str | None = None
	postal_code: str | None = None
	lat: float | None = None
	lon: float | None = None
	timezone: str
	is_active: bool
	created_at: datetime
	updated_at: datetime


class CinemaLocationCreate(BaseModel):
	"""Create payload for a cinema location."""

	city_id: UUID | None = None
	city_name: str | None = Field(default=None, max_length=255)
	location_name: str | None = Field(default=None, max_length=255)
	address_line1: str | None = Field(default=None, max_length=255)
	address_line2: str | None = Field(default=None, max_length=255)
	postal_code: str | None = Field(default=None, max_length=32)
	lat: float | None = Field(default=None, ge=-90, le=90)
	lon: float | None = Field(default=None, ge=-180, le=180)
	timezone: str = Field(..., min_length=1, max_length=100)
	is_active: bool = True


class CinemaLocationUpdate(BaseModel):
	"""Update payload for a cinema location."""

	city_id: UUID | None = None
	city_name: str | None = Field(default=None, max_length=255)
	location_name: str | None = Field(default=None, max_length=255)
	address_line1: str | None = Field(default=None, max_length=255)
	address_line2: str | None = Field(default=None, max_length=255)
	postal_code: str | None = Field(default=None, max_length=32)
	lat: float | None = Field(default=None, ge=-90, le=90)
	lon: float | None = Field(default=None, ge=-180, le=180)
	timezone: str | None = Field(default=None, min_length=1, max_length=100)
	is_active: bool | None = None


class CinemaHallRead(BaseModel):
	"""Hall payload nested under cinema location context."""

	model_config = ConfigDict(from_attributes=True)

	id: UUID
	location_id: UUID
	name: str
	capacity: int
	allow_private_booking: bool
	created_at: datetime
	updated_at: datetime


class CinemaHallCreate(BaseModel):
	"""Create payload for a cinema hall."""

	name: str = Field(..., min_length=1, max_length=255)
	capacity: int = Field(..., gt=0)
	allow_private_booking: bool = True


class CinemaHallUpdate(BaseModel):
	"""Update payload for a cinema hall."""

	name: str | None = Field(default=None, min_length=1, max_length=255)
	capacity: int | None = Field(default=None, gt=0)
	allow_private_booking: bool | None = None


class CinemaValidatorCreate(BaseModel):
	"""Create a validator account and assign it to the cinema."""

	email: str = Field(..., min_length=3, max_length=320)
	password: str = Field(..., min_length=8, max_length=128)
	display_name: str | None = Field(default=None, max_length=255)
	home_city_id: UUID | None = None


class CinemaValidatorRead(BaseModel):
	"""Validator assignment payload for cinema-admin management endpoints."""

	validator_user_id: UUID
	display_name: str | None = None
	email: str | None = None
	granted_at: datetime
	revoked_at: datetime | None = None
	is_active: bool
