from fastapi import Depends, HTTPException, status
from fastapi.routing import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.db import get_db
from app.schemas.movie import MovieRead
from app.services.movie_service import MovieService

router = APIRouter()


@router.get("", response_model=list[MovieRead])
async def list_movies(session: AsyncSession = Depends(get_db)) -> list[MovieRead]:
    """List internal movie catalog entries."""
    rows = await MovieService().list_movies(session)
    return [MovieRead.model_validate(row) for row in rows]


@router.get("/{movie_id}", response_model=MovieRead)
async def get_movie(movie_id: str, session: AsyncSession = Depends(get_db)) -> MovieRead:
    """Return one movie by id."""
    row = await MovieService().get_movie(session, movie_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found")
    return MovieRead.model_validate(row)

