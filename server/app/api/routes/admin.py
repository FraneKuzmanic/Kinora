"""
Admin routes — /api/v1/admin

Endpoints for privileged operations accessible to cinema_admin role.

TMDB movie sync:
  GET  /admin/movies/search?q=     Search TMDB catalog (returns candidate list)
  POST /admin/movies/sync/{tmdb_id} Import or update a movie from TMDB into internal catalog
"""

from fastapi import Depends, Query
from fastapi.routing import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.api.deps.authorization import require_any_role, resolve_role
from app.api.deps.db import get_db
from app.services import tmdb_service
from app.services.profile_service import ProfileService

router = APIRouter()


async def _require_cinema_admin(current_user: dict, session: AsyncSession) -> None:
    from fastapi import HTTPException, status
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user payload")
    profile = await ProfileService().get_by_user_id(session, user_id)
    role = resolve_role(current_user, profile.role if profile else None)
    require_any_role(role, {"cinema_admin"})


@router.get("/movies/search", response_model=list[dict])
async def search_tmdb_movies(
    q: str = Query(..., min_length=2, description="Search query"),
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    """
    Search the TMDB catalog for movies matching the query.

    Returns a list of candidates with tmdb_id, title, poster_url, and release_year.
    Use POST /admin/movies/sync/{tmdb_id} to import a chosen movie.
    """
    await _require_cinema_admin(current_user, session)
    return await tmdb_service.search_movies(q)


@router.post("/movies/sync/{tmdb_id}", response_model=dict)
async def sync_tmdb_movie(
    tmdb_id: int,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """
    Import or update a movie from TMDB into the internal catalog.

    Idempotent: running the same tmdb_id twice updates the existing record
    without creating duplicates. Returns the internal movie record.
    """
    await _require_cinema_admin(current_user, session)
    movie = await tmdb_service.sync_movie(session, tmdb_id)
    return {
        "id": str(movie.id),
        "tmdb_id": movie.tmdb_id,
        "title": movie.title,
        "original_title": movie.original_title,
        "release_year": movie.release_year,
        "runtime_minutes": movie.runtime_minutes,
        "overview": movie.overview,
        "poster_url": movie.poster_url,
        "backdrop_url": movie.backdrop_url,
        "language_code": movie.language_code,
        "created_at": movie.created_at.isoformat(),
        "updated_at": movie.updated_at.isoformat(),
    }
