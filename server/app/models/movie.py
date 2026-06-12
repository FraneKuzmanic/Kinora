import uuid
from datetime import datetime

from sqlalchemy import Integer, String, Text
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Movie(Base):
	"""Movie catalog entity owned by Kinora."""

	__tablename__ = "movies"
	__table_args__ = {"schema": "public"}

	id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
	title: Mapped[str] = mapped_column(String, nullable=False)
	original_title: Mapped[str | None] = mapped_column(String)
	release_year: Mapped[int | None] = mapped_column(Integer)
	runtime_minutes: Mapped[int | None] = mapped_column(Integer)
	overview: Mapped[str | None] = mapped_column(Text)
	poster_url: Mapped[str | None] = mapped_column(String)
	backdrop_url: Mapped[str | None] = mapped_column(String)
	trailer_url: Mapped[str | None] = mapped_column(String)
	language_code: Mapped[str | None] = mapped_column(String)
	country_code: Mapped[str | None] = mapped_column(String)
	tmdb_id: Mapped[int | None] = mapped_column(Integer, unique=True, nullable=True)
	created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
	updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)

