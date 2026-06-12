from fastapi.routing import APIRouter

from app.api.routes.admin import router as admin_router
from app.api.routes.admissions import router as admissions_router
from app.api.routes.analytics import router as analytics_router
from app.api.routes.auth import router as auth_router
from app.api.routes.campaigns import router as campaigns_router
from app.api.routes.cinemas import router as cinemas_router
from app.api.routes.health import router as health_router
from app.api.routes.loyalty import router as loyalty_router
from app.api.routes.movies import router as movies_router
from app.api.routes.movie_recommendations import router as movie_recommendations_router
from app.api.routes.predictions import router as predictions_router
from app.api.routes.private_bookings import router as private_bookings_router
from app.api.routes.screenings import router as screenings_router
from app.api.routes.stripe import router as stripe_router
from app.api.routes.validator import router as validator_router

api_router = APIRouter()
api_router.include_router(admissions_router, prefix="/admissions", tags=["admissions"])
api_router.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(health_router, prefix="/health", tags=["health"])
api_router.include_router(loyalty_router, prefix="/loyalty", tags=["loyalty"])
api_router.include_router(cinemas_router, prefix="/cinemas", tags=["cinemas"])
api_router.include_router(movies_router, prefix="/movies", tags=["movies"])
api_router.include_router(
    movie_recommendations_router,
    prefix="/movie-recommendations",
    tags=["movie-recommendations"],
)
api_router.include_router(campaigns_router, prefix="/campaigns", tags=["campaigns"])
api_router.include_router(predictions_router, prefix="/predictions", tags=["predictions"])
api_router.include_router(screenings_router, prefix="/screenings", tags=["screenings"])
api_router.include_router(private_bookings_router, prefix="/private-bookings", tags=["private-bookings"])
api_router.include_router(validator_router, prefix="/validator", tags=["validator"])
api_router.include_router(admin_router, prefix="/admin", tags=["admin"])
api_router.include_router(stripe_router, prefix="/stripe", tags=["stripe"])

