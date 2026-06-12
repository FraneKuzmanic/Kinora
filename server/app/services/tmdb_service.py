import uuid
from datetime import UTC, datetime

import httpx
from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.models.movie import Movie

_BASE = "https://api.themoviedb.org/3"
_POSTER_BASE = "https://image.tmdb.org/t/p/w500"
_BACKDROP_BASE = "https://image.tmdb.org/t/p/w1280"


def _headers() -> dict[str, str]:
    if not settings.tmdb_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="TMDB_API_KEY is not configured",
        )
    return {"Authorization": f"Bearer {settings.tmdb_api_key}"}


async def search_movies(query: str) -> list[dict]:
    """Search TMDB for movies matching the query string."""
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{_BASE}/search/movie",
            headers=_headers(),
            params={"query": query, "language": "en-US", "page": 1},
        )
        r.raise_for_status()
        results = r.json().get("results", [])

    return [
        {
            "tmdb_id": m["id"],
            "title": m.get("title", ""),
            "original_title": m.get("original_title"),
            "release_year": _year(m.get("release_date")),
            "overview": m.get("overview"),
            "poster_url": (_POSTER_BASE + m["poster_path"]) if m.get("poster_path") else None,
            "language_code": m.get("original_language"),
        }
        for m in results
    ]


async def get_movie_detail(tmdb_id: int) -> dict:
    """Fetch full movie detail from TMDB."""
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{_BASE}/movie/{tmdb_id}",
            headers=_headers(),
            params={"language": "en-US"},
        )
        if r.status_code == 404:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found on TMDB")
        r.raise_for_status()
        m = r.json()

    return {
        "tmdb_id": m["id"],
        "title": m.get("title", ""),
        "original_title": m.get("original_title"),
        "release_year": _year(m.get("release_date")),
        "runtime_minutes": m.get("runtime"),
        "overview": m.get("overview"),
        "poster_url": (_POSTER_BASE + m["poster_path"]) if m.get("poster_path") else None,
        "backdrop_url": (_BACKDROP_BASE + m["backdrop_path"]) if m.get("backdrop_path") else None,
        "language_code": m.get("original_language"),
        "popularity": m.get("popularity"),
        "genre_ids": [g["id"] for g in m.get("genres", [])],
    }


async def get_popular_movies(max_release_year: int | None = None) -> list[dict]:
    """Fetch up to 20 popular TMDB movies, excluding current theatrical releases by default."""
    if max_release_year is None:
        max_release_year = datetime.now(UTC).year - 1

    movies: list[dict] = []
    async with httpx.AsyncClient(timeout=10) as client:
        for page in range(1, 4):
            r = await client.get(
                f"{_BASE}/movie/popular",
                headers=_headers(),
                params={"language": "en-US", "page": page},
            )
            r.raise_for_status()
            results = r.json().get("results", [])

            for m in results:
                release_year = _year(m.get("release_date"))
                if release_year is None or release_year > max_release_year:
                    continue
                movies.append(
                    {
                        "tmdb_id": m["id"],
                        "title": m.get("title", ""),
                        "release_year": release_year,
                        "popularity": m.get("popularity", 0.0),
                        "poster_url": (_POSTER_BASE + m["poster_path"]) if m.get("poster_path") else None,
                        "genre_ids": m.get("genre_ids", []),
                    }
                )
                if len(movies) >= 20:
                    return movies

    return movies


async def get_genre_map() -> dict[int, str]:
    """Return a mapping of TMDB genre id → genre name."""
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{_BASE}/genre/movie/list",
            headers=_headers(),
            params={"language": "en-US"},
        )
        r.raise_for_status()
        genres = r.json().get("genres", [])

    return {g["id"]: g["name"] for g in genres}


async def sync_movie(session: AsyncSession, tmdb_id: int) -> Movie:
    """
    Import or update a movie from TMDB into the internal catalog.

    Idempotent: if a movie with this tmdb_id already exists it is updated in-place.
    A new UUID is generated only on first insert.
    """
    detail = await get_movie_detail(tmdb_id)

    existing = await session.execute(select(Movie).where(Movie.tmdb_id == tmdb_id))
    movie = existing.scalar_one_or_none()

    now = datetime.now(UTC)
    if movie:
        movie.title = detail["title"]
        movie.original_title = detail.get("original_title")
        movie.release_year = detail.get("release_year")
        movie.runtime_minutes = detail.get("runtime_minutes")
        movie.overview = detail.get("overview")
        movie.poster_url = detail.get("poster_url")
        movie.backdrop_url = detail.get("backdrop_url")
        movie.language_code = detail.get("language_code")
        movie.updated_at = now
    else:
        movie = Movie(
            id=uuid.uuid4(),
            tmdb_id=tmdb_id,
            title=detail["title"],
            original_title=detail.get("original_title"),
            release_year=detail.get("release_year"),
            runtime_minutes=detail.get("runtime_minutes"),
            overview=detail.get("overview"),
            poster_url=detail.get("poster_url"),
            backdrop_url=detail.get("backdrop_url"),
            language_code=detail.get("language_code"),
            created_at=now,
            updated_at=now,
        )
        session.add(movie)

    await session.flush()

    genre_ids = detail.get("genre_ids") or []
    if genre_ids:
        await _upsert_movie_genres(session, movie.id, genre_ids)

    await session.commit()
    await session.refresh(movie)
    return movie


async def _upsert_movie_genres(
    session: AsyncSession, movie_id: uuid.UUID, tmdb_genre_ids: list[int]
) -> None:
    """Sync movie_genres rows for a movie using TMDB genre ids."""
    genre_map = await get_genre_map()
    genre_names = [genre_map[gid] for gid in tmdb_genre_ids if gid in genre_map]
    if not genre_names:
        return

    genre_rows = await session.execute(
        text("SELECT id, lower(name) AS lname FROM public.genres")
    )
    name_to_id = {row.lname: row.id for row in genre_rows}

    matched_genre_ids = [
        name_to_id[n.lower()] for n in genre_names if n.lower() in name_to_id
    ]
    if not matched_genre_ids:
        return

    for genre_id in matched_genre_ids:
        await session.execute(
            text(
                "INSERT INTO public.movie_genres (movie_id, genre_id) VALUES (:mid, :gid) "
                "ON CONFLICT DO NOTHING"
            ),
            {"mid": movie_id, "gid": genre_id},
        )


def _year(date_str: str | None) -> int | None:
    if date_str and len(date_str) >= 4:
        try:
            return int(date_str[:4])
        except ValueError:
            pass
    return None
