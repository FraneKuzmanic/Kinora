from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.movie import Movie


class MovieService:
    """Read operations for the internal movie catalog."""

    async def list_movies(self, session: AsyncSession) -> list[Movie]:
        result = await session.execute(select(Movie).order_by(Movie.title.asc()))
        return list(result.scalars().all())

    async def get_movie(self, session: AsyncSession, movie_id: str) -> Movie | None:
        result = await session.execute(select(Movie).where(Movie.id == movie_id))
        return result.scalar_one_or_none()

