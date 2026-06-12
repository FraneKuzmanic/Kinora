from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class MovieRead(BaseModel):
	"""Movie catalog payload returned to API clients."""

	model_config = ConfigDict(from_attributes=True)

	id: UUID
	title: str
	original_title: str | None = None
	release_year: int | None = None
	runtime_minutes: int | None = None
	overview: str | None = None
	poster_url: str | None = None
	trailer_url: str | None = None
	language_code: str | None = None
	country_code: str | None = None
	tmdb_id: int | None = None
	created_at: datetime

