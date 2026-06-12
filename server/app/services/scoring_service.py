import uuid
from datetime import UTC, datetime
from math import exp, log1p
from typing import Literal

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign, CampaignMovie, CampaignVote
from app.models.movie import Movie
from app.models.movie_recommendation import MovieRecommendation
from app.schemas.ml import FilmScoreRead, FilmSignals


_W_LOCAL_DEMAND = 0.45
_W_CINEMA_FIT = 0.25
_W_MARKET = 0.20
_W_NOVELTY = 0.10


async def score_films_for_cinema(
    session: AsyncSession,
    cinema_id: uuid.UUID,
    tmdb_films: list[dict],
    genre_map: dict[int, str] | None = None,
) -> list[FilmScoreRead]:
    """Score generated candidates for a cinema and return sorted recommendations."""
    candidates = await _candidate_films(session, cinema_id, tmdb_films)
    genre_fit_map = await _genre_fit_map_by_name(session, cinema_id)
    demand = await _platform_demand_map(session, cinema_id)
    last_screened = await _last_screened_map(session, cinema_id)

    scored: list[FilmScoreRead] = []
    for film in candidates:
        tmdb_id = int(film["tmdb_id"])
        movie_id = film.get("movie_id")
        popularity = float(film.get("popularity") or 0.0)

        demand_data = _lookup_demand(demand, movie_id, tmdb_id)
        local_demand_score = _demand_signal(demand_data["weighted_demand"])
        market_score = _normalized_popularity(popularity)
        genre_fit_score = _genre_fit_score(film, genre_map, genre_fit_map)
        novelty_score = _novelty_score(_lookup_last_screened(last_screened, movie_id, tmdb_id))

        raw_score = (
            _W_LOCAL_DEMAND * local_demand_score
            + _W_CINEMA_FIT * genre_fit_score
            + _W_MARKET * market_score
            + _W_NOVELTY * novelty_score
        )
        score = round(raw_score * 100, 1)
        total_interactions = demand_data["votes"] + demand_data["recommendations"] + demand_data["earlybirds"]
        confidence = _confidence(total_interactions, demand_data["views"], bool(genre_fit_map))
        reason = _build_reason(
            local_demand_score=local_demand_score,
            market_score=market_score,
            genre_fit_score=genre_fit_score,
            novelty_score=novelty_score,
            confidence=confidence,
            demand_data=demand_data,
        )

        scored.append(
            FilmScoreRead(
                movie_id=movie_id,
                tmdb_id=tmdb_id,
                title=film["title"],
                poster_url=film.get("poster_url"),
                score=score,
                confidence=confidence,
                signals=FilmSignals(
                    tmdb_popularity_score=round(market_score, 3),
                    platform_demand_score=round(local_demand_score, 3),
                    genre_fit_score=round(genre_fit_score, 3),
                    novelty_score=round(novelty_score, 3),
                ),
                reason=reason,
            )
        )

    scored.sort(key=lambda f: (f.score, f.confidence == "high", f.title), reverse=True)
    return scored


async def _candidate_films(
    session: AsyncSession,
    cinema_id: uuid.UUID,
    tmdb_films: list[dict],
) -> list[dict]:
    candidates: dict[int, dict] = {}
    for film in tmdb_films:
        tmdb_id = film.get("tmdb_id")
        if tmdb_id is None:
            continue
        candidates[int(tmdb_id)] = dict(film)

    local_rows = await session.execute(
        text(
            "SELECT m.id AS movie_id, m.tmdb_id, m.title, m.poster_url, "
            "       COALESCE("
            "         ARRAY_AGG(DISTINCT lower(g.name)) FILTER (WHERE g.name IS NOT NULL), "
            "         ARRAY[]::text[]"
            "       ) AS genre_names "
            "FROM public.movies m "
            "LEFT JOIN public.movie_genres mg ON mg.movie_id = m.id "
            "LEFT JOIN public.genres g ON g.id = mg.genre_id "
            "WHERE m.tmdb_id IS NOT NULL AND ("
            "  EXISTS ("
            "    SELECT 1 FROM public.campaign_movies cm "
            "    JOIN public.campaigns c ON c.id = cm.campaign_id "
            "    WHERE cm.movie_id = m.id AND c.cinema_id = :cinema_id"
            "  ) OR EXISTS ("
            "    SELECT 1 FROM public.movie_recommendations mr "
            "    WHERE mr.movie_id = m.id "
            "      AND (mr.cinema_id = :cinema_id OR mr.cinema_id IS NULL)"
            "  ) OR EXISTS ("
            "    SELECT 1 FROM public.screenings s "
            "    WHERE s.movie_id = m.id AND s.cinema_id = :cinema_id"
            "  )"
            ") "
            "GROUP BY m.id, m.tmdb_id, m.title, m.poster_url "
            "LIMIT 80"
        ),
        {"cinema_id": cinema_id},
    )
    for row in local_rows:
        tmdb_id = int(row.tmdb_id)
        existing = candidates.get(tmdb_id, {})
        existing.update(
            {
                "movie_id": row.movie_id,
                "tmdb_id": tmdb_id,
                "title": row.title,
                "poster_url": row.poster_url or existing.get("poster_url"),
                "genre_names": list(row.genre_names or []),
                "popularity": existing.get("popularity", 0.0),
                "genre_ids": existing.get("genre_ids", []),
            }
        )
        candidates[tmdb_id] = existing

    return list(candidates.values())


async def _platform_demand_map(
    session: AsyncSession,
    cinema_id: uuid.UUID,
) -> dict[str, dict]:
    """Return demand signals keyed by movie id and TMDB id."""
    demand: dict[str, dict] = {}

    vote_rows = await session.execute(
        select(Movie.id, Movie.tmdb_id, func.count(CampaignVote.id).label("votes"))
        .join(CampaignMovie, CampaignMovie.movie_id == Movie.id)
        .join(Campaign, Campaign.id == CampaignMovie.campaign_id)
        .join(CampaignVote, CampaignVote.campaign_movie_id == CampaignMovie.id)
        .where(Campaign.cinema_id == cinema_id, Movie.tmdb_id.is_not(None))
        .group_by(Movie.id, Movie.tmdb_id)
    )
    for row in vote_rows:
        _add_demand(demand, row.id, row.tmdb_id, "votes", int(row.votes or 0))

    rec_rows = await session.execute(
        select(Movie.id, Movie.tmdb_id, func.count(MovieRecommendation.id).label("recs"))
        .join(MovieRecommendation, MovieRecommendation.movie_id == Movie.id)
        .where(Movie.tmdb_id.is_not(None))
        .where((MovieRecommendation.cinema_id == cinema_id) | (MovieRecommendation.cinema_id.is_(None)))
        .group_by(Movie.id, Movie.tmdb_id)
    )
    for row in rec_rows:
        _add_demand(demand, row.id, row.tmdb_id, "recommendations", int(row.recs or 0))

    earlybird_rows = await session.execute(
        text(
            "SELECT m.id AS movie_id, m.tmdb_id, COALESCE(SUM(a.quantity), 0)::int AS earlybirds "
            "FROM public.movies m "
            "JOIN public.campaign_movies cm ON cm.movie_id = m.id "
            "JOIN public.campaigns c ON c.id = cm.campaign_id "
            "JOIN public.admissions a ON a.campaign_movie_id = cm.id "
            "WHERE c.cinema_id = :cinema_id "
            "  AND m.tmdb_id IS NOT NULL "
            "  AND a.status::text IN ('pending_outcome', 'active', 'used') "
            "GROUP BY m.id, m.tmdb_id"
        ),
        {"cinema_id": cinema_id},
    )
    for row in earlybird_rows:
        _add_demand(demand, row.movie_id, row.tmdb_id, "earlybirds", int(row.earlybirds or 0))

    view_rows = await session.execute(
        text(
            "SELECT m.id AS movie_id, m.tmdb_id, COUNT(cv.id)::int AS views "
            "FROM public.movies m "
            "JOIN public.campaign_movies cm ON cm.movie_id = m.id "
            "JOIN public.campaigns c ON c.id = cm.campaign_id "
            "LEFT JOIN public.campaign_views cv ON cv.campaign_id = c.id "
            "WHERE c.cinema_id = :cinema_id AND m.tmdb_id IS NOT NULL "
            "GROUP BY m.id, m.tmdb_id"
        ),
        {"cinema_id": cinema_id},
    )
    for row in view_rows:
        _add_demand(demand, row.movie_id, row.tmdb_id, "views", int(row.views or 0))

    for item in demand.values():
        item["weighted_demand"] = (
            item["votes"] * 3.0
            + item["recommendations"] * 5.0
            + item["earlybirds"] * 8.0
            + item["views"] * 0.15
        )

    return demand


async def _genre_fit_map_by_name(
    session: AsyncSession,
    cinema_id: uuid.UUID,
) -> dict[str, float]:
    """Return {lower(genre_name): smoothed avg fill rate} from screening history."""
    rows = await session.execute(
        text(
            "WITH ticket_counts AS ("
            "  SELECT s.id, h.capacity, "
            "         COALESCE(SUM(CASE WHEN a.status::text IN ('pending_outcome', 'active', 'used', 'refunded', 'lost_refund_pending', 'lost_no_refund') "
            "             THEN a.quantity ELSE 0 END), 0)::float AS tickets "
            "  FROM public.screenings s "
            "  JOIN public.cinema_halls h ON h.id = s.hall_id "
            "  LEFT JOIN public.admissions a ON a.screening_id = s.id "
            "  WHERE s.cinema_id = :cid AND s.status IN ('confirmed', 'cancelled') "
            "  GROUP BY s.id, h.capacity"
            ") "
            "SELECT lower(gen.name) AS genre_name, "
            "       COUNT(DISTINCT tc.id) AS sample_count, "
            "       AVG(tc.tickets / NULLIF(tc.capacity, 0)) AS avg_fill "
            "FROM ticket_counts tc "
            "JOIN public.screenings s ON s.id = tc.id "
            "JOIN public.movie_genres mg ON mg.movie_id = s.movie_id "
            "JOIN public.genres gen ON gen.id = mg.genre_id "
            "GROUP BY lower(gen.name)"
        ),
        {"cid": cinema_id},
    )
    fit: dict[str, float] = {}
    for row in rows:
        count = int(row.sample_count or 0)
        avg_fill = float(row.avg_fill or 0.35)
        fit[row.genre_name] = ((avg_fill * count) + (0.35 * 4)) / (count + 4)
    return fit


async def _last_screened_map(session: AsyncSession, cinema_id: uuid.UUID) -> dict[str, datetime]:
    rows = await session.execute(
        text(
            "SELECT m.id AS movie_id, m.tmdb_id, MAX(s.starts_at) AS last_screened_at "
            "FROM public.screenings s "
            "JOIN public.movies m ON m.id = s.movie_id "
            "WHERE s.cinema_id = :cinema_id "
            "  AND s.status IN ('scheduled', 'selling', 'pending', 'confirmed') "
            "  AND m.tmdb_id IS NOT NULL "
            "GROUP BY m.id, m.tmdb_id"
        ),
        {"cinema_id": cinema_id},
    )
    seen: dict[str, datetime] = {}
    for row in rows:
        if row.last_screened_at:
            seen[_movie_key(row.movie_id)] = row.last_screened_at
            seen[_tmdb_key(row.tmdb_id)] = row.last_screened_at
    return seen


def _add_demand(
    demand: dict[str, dict],
    movie_id: uuid.UUID | None,
    tmdb_id: int | None,
    field: str,
    value: int,
) -> None:
    for key in [_movie_key(movie_id) if movie_id else None, _tmdb_key(tmdb_id) if tmdb_id else None]:
        if not key:
            continue
        item = demand.setdefault(
            key,
            {"votes": 0, "recommendations": 0, "earlybirds": 0, "views": 0, "weighted_demand": 0.0},
        )
        item[field] += value


def _lookup_demand(demand: dict[str, dict], movie_id: uuid.UUID | None, tmdb_id: int) -> dict:
    if movie_id and _movie_key(movie_id) in demand:
        return demand[_movie_key(movie_id)]
    return demand.get(
        _tmdb_key(tmdb_id),
        {"votes": 0, "recommendations": 0, "earlybirds": 0, "views": 0, "weighted_demand": 0.0},
    )


def _lookup_last_screened(
    last_screened: dict[str, datetime],
    movie_id: uuid.UUID | None,
    tmdb_id: int,
) -> datetime | None:
    if movie_id and _movie_key(movie_id) in last_screened:
        return last_screened[_movie_key(movie_id)]
    return last_screened.get(_tmdb_key(tmdb_id))


def _movie_key(movie_id: uuid.UUID) -> str:
    return f"movie:{movie_id}"


def _tmdb_key(tmdb_id: int) -> str:
    return f"tmdb:{tmdb_id}"


def _demand_signal(weighted_demand: float) -> float:
    return 1 - exp(-max(weighted_demand, 0.0) / 18.0)


def _normalized_popularity(popularity: float) -> float:
    return _clamp(log1p(max(popularity, 0.0)) / log1p(300.0), 0.0, 1.0)


def _genre_fit_score(
    film: dict,
    genre_map: dict[int, str] | None,
    genre_fit_map: dict[str, float],
) -> float:
    genre_names: list[str] = []
    if film.get("genre_names"):
        genre_names.extend(str(name).lower() for name in film["genre_names"])
    if genre_map and film.get("genre_ids"):
        genre_names.extend(
            genre_map[gid].lower()
            for gid in film.get("genre_ids", [])
            if gid in genre_map
        )
    fits = [genre_fit_map[name] for name in set(genre_names) if name in genre_fit_map]
    if not fits:
        return 0.5
    return _clamp(sum(fits) / len(fits), 0.05, 0.95)


def _novelty_score(last_screened_at: datetime | None) -> float:
    if not last_screened_at:
        return 1.0
    now = datetime.now(UTC)
    if last_screened_at.tzinfo is None:
        last_screened_at = last_screened_at.replace(tzinfo=UTC)
    days = max((now - last_screened_at.astimezone(UTC)).days, 0)
    if days < 30:
        return 0.15
    if days < 90:
        return 0.45
    if days < 180:
        return 0.7
    return 0.9


def _confidence(
    interactions: int,
    views: int,
    has_genre_history: bool,
) -> Literal["low", "medium", "high"]:
    evidence = interactions + min(views / 20, 5) + (4 if has_genre_history else 0)
    if evidence >= 12:
        return "high"
    if evidence >= 4:
        return "medium"
    return "low"


def _build_reason(
    local_demand_score: float,
    market_score: float,
    genre_fit_score: float,
    novelty_score: float,
    confidence: str,
    demand_data: dict,
) -> str:
    parts = []
    if demand_data["earlybirds"]:
        parts.append(f"{demand_data['earlybirds']} early-bird tickets")
    if demand_data["votes"]:
        parts.append(f"{demand_data['votes']} campaign votes")
    if demand_data["recommendations"]:
        parts.append(f"{demand_data['recommendations']} audience requests")
    if not parts and local_demand_score > 0:
        parts.append("some local browsing demand")
    if market_score >= 0.65:
        parts.append("strong market signal")
    elif market_score >= 0.45:
        parts.append("moderate market signal")
    if genre_fit_score >= 0.65:
        parts.append("genre performs well here")
    elif genre_fit_score <= 0.30:
        parts.append("genre has been weaker here")
    if novelty_score <= 0.2:
        parts.append("recently screened")
    elif novelty_score >= 0.9:
        parts.append("fresh for this cinema")
    if not parts and confidence == "low":
        parts.append("limited local evidence")
    return ", ".join(parts) if parts else "balanced recommendation"


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(value, maximum))
