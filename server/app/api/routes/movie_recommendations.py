from fastapi import Depends, HTTPException, status
from fastapi.routing import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.api.deps.authorization import require_any_role, resolve_role
from app.api.deps.db import get_db
from app.schemas.movie_recommendation import (
    MovieRecommendationCreate,
    MovieRecommendationRead,
)
from app.services.movie_recommendation_service import MovieRecommendationService
from app.services.profile_service import ProfileService

router = APIRouter()


@router.post("", response_model=MovieRecommendationRead, status_code=status.HTTP_201_CREATED)
async def create_movie_recommendation(
    payload: MovieRecommendationCreate,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> MovieRecommendationRead:
    """Create a movie recommendation for the authenticated user."""
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user payload")

    profile = await ProfileService().get_by_user_id(session, user_id)
    role = resolve_role(current_user, profile.role if profile else None)
    require_any_role(role, {"audience", "cinema_admin"})

    row = await MovieRecommendationService().create_recommendation(
        session,
        user_id=user_id,
        payload=payload,
    )
    return MovieRecommendationRead.model_validate(row)


