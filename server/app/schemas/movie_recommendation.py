from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class MovieRecommendationCreate(BaseModel):
    cinema_id: UUID | None = None
    city_id: UUID | None = None
    movie_id: UUID | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    message: str | None = Field(default=None, max_length=2000)


class MovieRecommendationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID | None = None
    cinema_id: UUID | None = None
    city_id: UUID | None = None
    movie_id: UUID | None = None
    title: str | None = None
    message: str | None = None
    status: str
    created_at: datetime


class MovieRecommendationAdminRead(MovieRecommendationRead):
    movie_title: str | None = None
    cinema_name: str | None = None
    city_name: str | None = None
    requester_display_name: str | None = None


class MovieRecommendationModerationUpdate(BaseModel):
    status: str = Field(..., pattern="^(reviewed|accepted|rejected)$")
    movie_id: UUID | None = None
