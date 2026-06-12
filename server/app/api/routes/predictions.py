import uuid

from fastapi import Depends, HTTPException, status
from fastapi.routing import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.api.deps.authorization import require_any_role, resolve_role
from app.api.deps.db import get_db
from app.schemas.ml import (
    AttendancePredictionRequest,
    AttendancePredictionResponse,
    ScreeningPredictionRead,
)
from app.services.campaign_service import CampaignService
from app.services.predictions_service import predict_attendance, predict_screening_success
from app.services.profile_service import ProfileService

router = APIRouter()


async def _require_cinema_admin(current_user: dict, session: AsyncSession) -> tuple[str, uuid.UUID]:
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user payload")

    profile = await ProfileService().get_by_user_id(session, user_id)
    role = resolve_role(current_user, profile.role if profile else None)
    require_any_role(role, {"cinema_admin"})
    cinema_id = await CampaignService().get_admin_cinema_id(session, user_id)
    if not cinema_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No cinema membership found for this user",
        )
    return user_id, cinema_id


@router.get("/screening/{screening_id}", response_model=ScreeningPredictionRead)
async def get_screening_prediction(
    screening_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
) -> ScreeningPredictionRead:
    """
    Public endpoint — predict confirmation likelihood for a selling/pending screening.
    Returns 422 if the screening is not in a predictable status.
    """
    return await predict_screening_success(session, screening_id)


@router.post("/attendance", response_model=AttendancePredictionResponse)
async def predict_attendance_what_if(
    body: AttendancePredictionRequest,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> AttendancePredictionResponse:
    """
    Cinema admin What-If predictor: given a hall, film, and date/time slot,
    return a heuristic attendance prediction.
    """
    _, cinema_id = await _require_cinema_admin(current_user, session)

    popularity: float = 50.0
    movie_id_for_history = body.movie_id
    if body.tmdb_id is not None:
        from app.services.tmdb_service import get_movie_detail
        try:
            detail = await get_movie_detail(body.tmdb_id)
            popularity = float(detail.get("popularity") or 50.0)
        except Exception:
            popularity = 50.0
        from sqlalchemy.future import select
        from app.models.movie import Movie
        result = await session.execute(select(Movie.id).where(Movie.tmdb_id == body.tmdb_id))
        movie_id_for_history = result.scalar_one_or_none()
    elif body.movie_id is not None:
        from sqlalchemy.future import select
        from app.models.movie import Movie
        result = await session.execute(select(Movie).where(Movie.id == body.movie_id))
        movie = result.scalar_one_or_none()
        if movie and movie.tmdb_id:
            from app.services.tmdb_service import get_movie_detail
            try:
                detail = await get_movie_detail(movie.tmdb_id)
                popularity = float(detail.get("popularity") or 50.0)
            except Exception:
                popularity = 50.0

    return await predict_attendance(
        session,
        body.hall_id,
        popularity,
        body.starts_at,
        cinema_id,
        movie_id=movie_id_for_history,
    )
