"""API route module exports."""

from app.api.routes.admin import router as admin_router
from app.api.routes.admissions import router as admissions_router
from app.api.routes.auth import router as auth_router
from app.api.routes.campaigns import router as campaigns_router
from app.api.routes.cinemas import router as cinemas_router
from app.api.routes.health import router as health_router
from app.api.routes.movies import router as movies_router
from app.api.routes.movie_recommendations import router as movie_recommendations_router
from app.api.routes.private_bookings import router as private_bookings_router
from app.api.routes.screenings import router as screenings_router
from app.api.routes.stripe import router as stripe_router
from app.api.routes.validator import router as validator_router

__all__ = [
	"admin_router",
	"admissions_router",
	"auth_router",
	"campaigns_router",
	"cinemas_router",
	"health_router",
	"movies_router",
	"movie_recommendations_router",
	"private_bookings_router",
	"screenings_router",
	"stripe_router",
	"validator_router",
]
