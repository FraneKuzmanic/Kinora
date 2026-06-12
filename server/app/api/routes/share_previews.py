from html import escape
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from fastapi.routing import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.db import get_db
from app.core.config import settings
from app.services.campaign_service import CampaignService
from app.services.screening_service import ScreeningService

router = APIRouter()


def _join_url(base: str, path: str) -> str:
    return f"{base.rstrip('/')}/{path.lstrip('/')}"


def _share_base_url() -> str:
    return (settings.share_public_url or settings.client_url).rstrip("/")


def _preview_html(
    *,
    title: str,
    description: str,
    canonical_url: str,
    redirect_url: str,
    image_url: str | None = None,
) -> HTMLResponse:
    safe_title = escape(title)
    safe_description = escape(description)
    safe_canonical_url = escape(canonical_url, quote=True)
    safe_redirect_url = escape(redirect_url, quote=True)
    image_tags = ""

    if image_url:
        safe_image_url = escape(image_url, quote=True)
        image_tags = f"""
    <meta property="og:image" content="{safe_image_url}" />
    <meta name="twitter:image" content="{safe_image_url}" />"""

    html = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{safe_title}</title>
    <meta name="description" content="{safe_description}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Kinora" />
    <meta property="og:title" content="{safe_title}" />
    <meta property="og:description" content="{safe_description}" />
    <meta property="og:url" content="{safe_canonical_url}" />{image_tags}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{safe_title}" />
    <meta name="twitter:description" content="{safe_description}" />
    <link rel="canonical" href="{safe_canonical_url}" />
    <meta http-equiv="refresh" content="0;url={safe_redirect_url}" />
  </head>
  <body>
    <p>Opening <a href="{safe_redirect_url}">Kinora</a>...</p>
    <script>window.location.replace("{safe_redirect_url}");</script>
  </body>
</html>"""
    return HTMLResponse(html)


@router.get("/campaigns/{campaign_id}", response_class=HTMLResponse)
async def campaign_share_preview(
    campaign_id: UUID,
    session: AsyncSession = Depends(get_db),
) -> HTMLResponse:
    svc = CampaignService()
    campaign = await svc.get_campaign(session, str(campaign_id))
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    enriched = await svc.enrich_campaign(session, campaign)
    movies = await svc.get_campaign_movie_stats(session, str(campaign_id))
    featured_movie = next((movie for movie in movies if movie["is_winner"]), None) or (
        max(movies, key=lambda movie: (movie["vote_count"], -movie["sort_order"]))
        if movies
        else None
    )

    cinema_name = enriched["cinema_name"]
    title = f"{enriched['title']} on Kinora"
    description = (
        f"Vote for what plays next at {cinema_name}."
        if not featured_movie
        else f"Help {featured_movie['movie_title']} reach the screen at {cinema_name}."
    )

    return _preview_html(
        title=title,
        description=description,
        canonical_url=_join_url(_share_base_url(), f"/share/campaigns/{campaign_id}"),
        redirect_url=_join_url(settings.client_url, f"/campaigns/{campaign_id}"),
        image_url=featured_movie["movie_poster_url"] if featured_movie else None,
    )


@router.get("/screenings/{screening_id}", response_class=HTMLResponse)
async def screening_share_preview(
    screening_id: UUID,
    session: AsyncSession = Depends(get_db),
) -> HTMLResponse:
    screening = await ScreeningService().get_screening(session, str(screening_id))
    if not screening:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Screening not found")

    title = f"{screening['movie_title']} on Kinora"
    description = (
        f"Help {screening['movie_title']} reach the screen at {screening['cinema_name']}."
    )

    return _preview_html(
        title=title,
        description=description,
        canonical_url=_join_url(_share_base_url(), f"/share/screenings/{screening_id}"),
        redirect_url=_join_url(settings.client_url, f"/screenings/{screening_id}"),
        image_url=screening["movie_poster_url"],
    )
