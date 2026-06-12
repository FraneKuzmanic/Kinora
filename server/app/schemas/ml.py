import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class FilmSignals(BaseModel):
    tmdb_popularity_score: float
    platform_demand_score: float
    genre_fit_score: float
    novelty_score: float = 0.0


class FilmScoreRead(BaseModel):
    movie_id: uuid.UUID | None = None
    tmdb_id: int
    title: str
    poster_url: str | None
    score: float
    confidence: Literal["low", "medium", "high"]
    signals: FilmSignals
    reason: str


class AttendancePredictionRequest(BaseModel):
    hall_id: uuid.UUID
    tmdb_id: int | None = None
    movie_id: uuid.UUID | None = None
    starts_at: datetime


class AttendancePredictionResponse(BaseModel):
    predicted_attendance: int
    predicted_fill_rate: float
    suggested_threshold: int
    risk_band: Literal["green", "yellow", "red"]
    best_slot_hint: str


class ScreeningPredictionRead(BaseModel):
    probability_of_confirmation: float
    risk_band: Literal["green", "yellow", "red"]
    projected_tickets_at_decision: int
    tickets_sold: int
    tickets_remaining: int
    current_progress: float
    projected_progress: float
    confidence: Literal["low", "medium", "high"]
    label: str
