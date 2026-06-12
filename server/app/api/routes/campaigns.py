"""
Campaign routes — /api/v1/campaigns

Public (no auth required):
  GET  /campaigns                      List all campaigns (enriched with cinema/hall names)
  GET  /campaigns/{campaign_id}        Get campaign detail (movies include title, poster)
  GET  /campaigns/{campaign_id}/movies List candidate movies for a campaign

Audience / any authenticated user:
  POST /campaigns/{campaign_id}/votes  Cast or switch a vote (one active vote per user per campaign)

Cinema admin (cinema_admin role + cinema membership required):
  POST   /campaigns                                   Create campaign (→ draft)
  PATCH  /campaigns/{campaign_id}                     Edit campaign (draft only)
  POST   /campaigns/{campaign_id}/publish             draft → voting
  POST   /campaigns/{campaign_id}/resolve             voting → resolved (also auto-creates screening)
  POST   /campaigns/{campaign_id}/cancel              draft|voting → cancelled
  POST   /campaigns/{campaign_id}/movies              Add candidate movie (draft only)
  DELETE /campaigns/{campaign_id}/movies/{cm_id}      Remove candidate movie (draft only)

State machine:
  draft ──publish──► voting ──resolve──► resolved  (terminal)
    │                   │                    └──► screening created automatically
    └──cancel───────────┴──cancel──► cancelled     (terminal)

Note: voting campaigns are also resolved automatically by the background scheduler
when voting_ends_at passes.

Ownership:
  A cinema_admin can only act on campaigns that belong to their cinema.
  The cinema is resolved from cinema_memberships; a cinema_admin with no
  membership row receives 403 on all mutating requests.
"""

import logging
import uuid
from datetime import UTC, datetime

from fastapi import Depends, HTTPException, Query, Response, status
from fastapi.routing import APIRouter
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user, get_optional_user
from app.api.deps.authorization import require_any_role, resolve_role
from app.api.deps.db import get_db
from app.models.campaign import Campaign
from app.schemas.payment import CheckoutSessionCreate, CheckoutSessionRead
from app.schemas.campaign import (
    CampaignCreate,
    CampaignDiscoverCardRead,
    CampaignDetailRead,
    CampaignFilter,
    CampaignMovieCreate,
    CampaignMovieRead,
    CampaignMovieStats,
    CampaignRead,
    CampaignUpdate,
    CampaignVoteCreate,
    CampaignVoteRead,
)
from app.services.campaign_service import CampaignService
from app.services.payment_service import PaymentService
from app.services.profile_service import ProfileService

log = logging.getLogger(__name__)

router = APIRouter()


async def _require_cinema_admin(
    current_user: dict,
    session: AsyncSession,
) -> uuid.UUID:
    """
    Verify the caller is a cinema_admin and return their cinema_id.

    Raises 401 if the user payload is invalid, 403 if not cinema_admin or
    if the user has no cinema_memberships row.
    """
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
    return cinema_id


async def _load_owned_campaign(
    campaign_id: str,
    current_user: dict,
    session: AsyncSession,
) -> tuple[Campaign, uuid.UUID]:
    """
    Load a campaign and verify the caller owns it.

    Returns (campaign, cinema_id). Raises 404 if missing, 403 if not owned.
    """
    cinema_id = await _require_cinema_admin(current_user, session)
    svc = CampaignService()
    campaign = await svc.get_campaign(session, campaign_id)
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    svc.assert_ownership(campaign, cinema_id)
    return campaign, cinema_id


# ---------------------------------------------------------------------------
# Public read endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[CampaignRead])
async def list_campaigns(session: AsyncSession = Depends(get_db)) -> list[CampaignRead]:
    """Return all campaigns ordered by voting deadline ascending."""
    rows = await CampaignService().list_campaigns(session)
    return [CampaignRead(**row) for row in rows]


@router.post("/search", response_model=list[CampaignRead])
async def search_campaigns(
    filters: CampaignFilter,
    session: AsyncSession = Depends(get_db),
) -> list[CampaignRead]:
    """
    Filter campaigns by city, cinema, and/or status.

    All body fields are optional — omit any to skip that filter.
    Returns the same enriched payload as GET /campaigns.
    """
    rows = await CampaignService().list_campaigns(
        session,
        city_id=filters.city_id,
        cinema_id=filters.cinema_id,
        status=filters.status,
    )
    return [CampaignRead(**row) for row in rows]


@router.get("/discover-cards", response_model=list[CampaignDiscoverCardRead])
async def list_discover_campaign_cards(
    city_id: uuid.UUID | None = Query(default=None),
    cinema_id: uuid.UUID | None = Query(default=None),
    limit: int = Query(default=8, ge=1, le=50),
    current_user: dict | None = Depends(get_optional_user),
    session: AsyncSession = Depends(get_db),
) -> list[CampaignDiscoverCardRead]:
    """Return enriched active-voting campaign cards for the Discover rail."""
    rows = await CampaignService().list_discover_campaign_cards(
        session,
        city_id=city_id,
        cinema_id=cinema_id,
        limit=limit,
        user_id=current_user.get("id") if current_user else None,
    )
    return [CampaignDiscoverCardRead(**row) for row in rows]


@router.get("/{campaign_id}", response_model=CampaignDetailRead)
async def get_campaign(
    campaign_id: str,
    current_user: dict | None = Depends(get_optional_user),
    session: AsyncSession = Depends(get_db),
) -> CampaignDetailRead:
    """
    Return a single campaign with per-movie vote counts, ticket counts, and movie metadata.

    vote_count is always visible. ticket_count is only populated when the
    caller is the cinema_admin who owns the campaign; it is null otherwise.
    """
    svc = CampaignService()
    campaign = await svc.get_campaign(session, campaign_id)
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    include_tickets = False
    current_user_vote_campaign_movie_id = None
    if current_user:
        user_id = current_user.get("id")
        profile = await ProfileService().get_by_user_id(session, user_id)
        role = resolve_role(current_user, profile.role if profile else None)
        if role == "cinema_admin":
            admin_cinema_id = await svc.get_admin_cinema_id(session, user_id)
            include_tickets = (admin_cinema_id == campaign.cinema_id)
        if user_id:
            current_user_vote = await svc.get_user_campaign_vote(session, campaign_id, user_id)
            current_user_vote_campaign_movie_id = (
                current_user_vote.campaign_movie_id if current_user_vote else None
            )

    enriched = await svc.enrich_campaign(session, campaign)
    movie_stats = await svc.get_campaign_movie_stats(session, campaign_id, include_tickets)
    total_early_bird_tickets = await svc.get_campaign_early_bird_total(session, campaign_id)

    return CampaignDetailRead(
        **enriched,
        current_user_vote_campaign_movie_id=current_user_vote_campaign_movie_id,
        total_early_bird_tickets=total_early_bird_tickets,
        movies=[CampaignMovieStats(**s) for s in movie_stats],
    )


@router.get("/{campaign_id}/movies", response_model=list[CampaignMovieRead])
async def list_campaign_movies(
    campaign_id: str, session: AsyncSession = Depends(get_db)
) -> list[CampaignMovieRead]:
    """Return candidate movies for a campaign, ordered by sort_order."""
    rows = await CampaignService().list_campaign_movies(session, campaign_id)
    return [CampaignMovieRead.model_validate(row) for row in rows]


# ---------------------------------------------------------------------------
# Audience vote
# ---------------------------------------------------------------------------

@router.post("/{campaign_id}/votes", response_model=CampaignVoteRead)
async def vote_campaign(
    campaign_id: str,
    payload: CampaignVoteCreate,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> CampaignVoteRead:
    """
    Submit or switch a vote for a candidate movie.

    Requires the campaign to be in `voting` status and the current time to be
    within the voting window. A user can only have one active vote in a campaign;
    submitting another vote switches their existing vote to the new movie.
    """
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user payload")

    profile = await ProfileService().get_by_user_id(session, user_id)
    role = resolve_role(current_user, profile.role if profile else None)
    require_any_role(role, {"audience", "cinema_admin", "validator"})

    vote = await CampaignService().create_vote(
        session=session,
        campaign_id=campaign_id,
        campaign_movie_id=str(payload.campaign_movie_id),
        user_id=user_id,
    )
    return CampaignVoteRead(
        id=vote.id,
        campaign_id=vote.campaign_id,
        campaign_movie_id=vote.campaign_movie_id,
        user_id=vote.user_id,
        created_at=vote.created_at,
    )


@router.post(
    "/{campaign_id}/movies/{campaign_movie_id}/checkout-session",
    response_model=CheckoutSessionRead,
)
async def create_campaign_movie_checkout_session(
    campaign_id: str,
    campaign_movie_id: str,
    payload: CheckoutSessionCreate,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> CheckoutSessionRead:
    """Create a Stripe Checkout Session for early-bird campaign tickets."""
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user payload")

    profile = await ProfileService().get_by_user_id(session, user_id)
    role = resolve_role(current_user, profile.role if profile else None)
    require_any_role(role, {"audience", "cinema_admin"})

    receipt_email = current_user.get("email")
    checkout = await PaymentService().create_campaign_checkout_session(
        session=session,
        campaign_id=campaign_id,
        campaign_movie_id=campaign_movie_id,
        buyer_user_id=user_id,
        quantity=payload.quantity,
        coupon_id=str(payload.coupon_id) if payload.coupon_id else None,
        email_notification=str(receipt_email) if receipt_email else None,
    )
    return CheckoutSessionRead(**checkout)


# ---------------------------------------------------------------------------
# Cinema admin — campaign lifecycle
# ---------------------------------------------------------------------------

@router.post("", response_model=CampaignRead, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    payload: CampaignCreate,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> CampaignRead:
    """
    Create a new campaign in `draft` status.

    The cinema is resolved from the caller's cinema_memberships row.
    The hall must belong to that cinema. Slot ordering is validated
    server-side before the DB insert. Voting starts when the campaign
    is published, using voting_duration_days.
    """
    cinema_id = await _require_cinema_admin(current_user, session)
    svc = CampaignService()
    campaign = await svc.create_campaign(
        session=session,
        payload=payload,
        user_id=current_user["id"],
        cinema_id=cinema_id,
    )
    enriched = await svc.enrich_campaign(session, campaign)
    return CampaignRead(**enriched)


@router.patch("/{campaign_id}", response_model=CampaignRead)
async def update_campaign(
    campaign_id: str,
    payload: CampaignUpdate,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> CampaignRead:
    """
    Partially update a campaign. Only allowed while status is `draft`.

    All fields are optional; only provided fields are updated. Time ordering
    is re-validated against the merged values.
    """
    campaign, _ = await _load_owned_campaign(campaign_id, current_user, session)
    svc = CampaignService()
    updated = await svc.update_campaign(session, campaign, payload)
    enriched = await svc.enrich_campaign(session, updated)
    return CampaignRead(**enriched)


@router.post("/{campaign_id}/publish", response_model=CampaignRead)
async def publish_campaign(
    campaign_id: str,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> CampaignRead:
    """
    Transition a campaign from `draft` → `voting`.

    Requires at least one candidate movie to be attached. Once published,
    the campaign becomes visible to voters and voting starts immediately.
    voting_ends_at is computed from voting_duration_days.
    """
    campaign, _ = await _load_owned_campaign(campaign_id, current_user, session)
    svc = CampaignService()
    updated = await svc.publish_campaign(session, campaign)
    enriched = await svc.enrich_campaign(session, updated)
    return CampaignRead(**enriched)


@router.post("/{campaign_id}/resolve", response_model=CampaignRead)
async def resolve_campaign(
    campaign_id: str,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> CampaignRead:
    """
    Transition a campaign from `voting` → `resolved`, selecting a winner and
    auto-creating the linked screening.

    This endpoint allows early manual resolution before voting_ends_at.
    The background scheduler resolves campaigns automatically when their
    voting window expires.

    Winner selection:
    1. If any candidate has early-bird ticket qty >= min_tickets_to_confirm,
       that movie auto-wins (highest tickets → most votes → lowest sort_order).
    2. Otherwise the movie with the most votes wins
       (tie-break: most early-bird tickets → lowest sort_order).
    """
    campaign, _ = await _load_owned_campaign(campaign_id, current_user, session)
    svc = CampaignService()
    updated = await svc.resolve_campaign(
        session,
        campaign,
    )
    enriched = await svc.enrich_campaign(session, updated)
    return CampaignRead(**enriched)


@router.post("/{campaign_id}/cancel", response_model=CampaignRead)
async def cancel_campaign(
    campaign_id: str,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> CampaignRead:
    """
    Transition a campaign from `draft` or `voting` → `cancelled`.

    Cancelling during `voting` does not automatically refund early-bird
    admissions; refunds are processed by a separate job when Stripe is wired.
    """
    campaign, _ = await _load_owned_campaign(campaign_id, current_user, session)
    svc = CampaignService()
    updated = await svc.cancel_campaign(
        session,
        campaign,
    )
    enriched = await svc.enrich_campaign(session, updated)
    return CampaignRead(**enriched)


# ---------------------------------------------------------------------------
# Cinema admin — candidate movie management
# ---------------------------------------------------------------------------

@router.post(
    "/{campaign_id}/movies",
    response_model=CampaignMovieRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_campaign_movie(
    campaign_id: str,
    payload: CampaignMovieCreate,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> CampaignMovieRead:
    """
    Attach a candidate movie to a campaign (draft status only).

    movie_id must reference an existing movie in the catalog.
    Duplicate entries for the same movie are rejected with 409.
    sort_order controls the display order shown to voters.
    """
    campaign, _ = await _load_owned_campaign(campaign_id, current_user, session)
    entry = await CampaignService().add_campaign_movie(
        session=session,
        campaign=campaign,
        movie_id=payload.movie_id,
        sort_order=payload.sort_order,
    )
    return CampaignMovieRead.model_validate(entry)


@router.delete(
    "/{campaign_id}/movies/{campaign_movie_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_campaign_movie(
    campaign_id: str,
    campaign_movie_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    """
    Remove a candidate movie from a campaign (draft status only).

    campaign_movie_id is the campaign_movies table PK (from CampaignMovieRead.id),
    not the movies catalog id.
    """
    campaign, _ = await _load_owned_campaign(campaign_id, current_user, session)
    await CampaignService().remove_campaign_movie(session, campaign, campaign_movie_id)


# ---------------------------------------------------------------------------
# View tracking (no auth required — fire-and-forget)
# ---------------------------------------------------------------------------

@router.post("/{campaign_id}/view", status_code=204)
async def record_campaign_view(
    campaign_id: uuid.UUID,
    current_user: dict | None = Depends(get_optional_user),
    session: AsyncSession = Depends(get_db),
) -> Response:
    """Record a campaign page view. Never returns an error to the client."""
    try:
        user_id = (current_user or {}).get("id")
        await session.execute(
            text(
                "INSERT INTO public.campaign_views (campaign_id, user_id, viewed_at) "
                "VALUES (:cid, :uid, :ts)"
            ),
            {"cid": campaign_id, "uid": user_id, "ts": datetime.now(UTC)},
        )
        await session.commit()
    except Exception:
        log.debug("campaign view log failed for %s", campaign_id)
    return Response(status_code=204)
