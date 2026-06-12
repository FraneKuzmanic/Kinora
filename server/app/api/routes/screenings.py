"""
Screening routes - /api/v1/screenings

Public:
  GET  /screenings              List screenings
  POST /screenings/search       Filter screenings
  GET  /screenings/{id}         Single screening detail

Audience / authenticated ticket buyers:
  POST /screenings/{id}/checkout-session

Cinema admin:
  POST /screenings
  POST /screenings/{id}/open-sales
  POST /screenings/{id}/confirm
  POST /screenings/{id}/cancel
"""

import uuid

from fastapi import Depends, HTTPException, Query, status
from fastapi.routing import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.api.deps.authorization import require_any_role, resolve_role
from app.api.deps.db import get_db
from app.models.screening import Screening
from app.schemas.payment import CheckoutSessionCreate, CheckoutSessionRead
from app.schemas.screening import (
    ScreeningCancelRequest,
    ScreeningCreate,
    ScreeningFilter,
    ScreeningRead,
)
from app.services.campaign_service import CampaignService
from app.services.payment_service import PaymentService
from app.services.profile_service import ProfileService
from app.services.screening_service import ScreeningService

router = APIRouter()


async def _require_cinema_admin(current_user: dict, session: AsyncSession) -> uuid.UUID:
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


async def _require_ticket_user(current_user: dict, session: AsyncSession) -> str:
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user payload")

    profile = await ProfileService().get_by_user_id(session, user_id)
    role = resolve_role(current_user, profile.role if profile else None)
    require_any_role(role, {"audience", "cinema_admin"})
    return user_id


async def _load_owned_screening(
    screening_id: str,
    current_user: dict,
    session: AsyncSession,
) -> tuple[Screening, uuid.UUID]:
    cinema_id = await _require_cinema_admin(current_user, session)
    svc = ScreeningService()
    screening = await svc.get_screening_orm(session, screening_id)
    if not screening:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Screening not found")
    svc.assert_ownership(screening, cinema_id)
    return screening, cinema_id


@router.get("", response_model=list[ScreeningRead])
async def list_screenings(
    active_only: bool = Query(default=False),
    limit: int | None = Query(default=None, ge=1, le=100),
    session: AsyncSession = Depends(get_db),
) -> list[ScreeningRead]:
    """List screenings ordered by start time, enriched with movie and cinema data."""
    rows = await ScreeningService().list_screenings(
        session,
        active_only=active_only,
        limit=limit,
    )
    return [ScreeningRead(**row) for row in rows]


@router.post("/search", response_model=list[ScreeningRead])
async def search_screenings(
    filters: ScreeningFilter,
    session: AsyncSession = Depends(get_db),
) -> list[ScreeningRead]:
    """Filter screenings by city, cinema, status, and/or date range."""
    rows = await ScreeningService().list_screenings(
        session,
        city_id=filters.city_id,
        cinema_id=filters.cinema_id,
        status=filters.status,
        date_from=filters.date_from,
        date_to=filters.date_to,
    )
    return [ScreeningRead(**row) for row in rows]


@router.get("/{screening_id}", response_model=ScreeningRead)
async def get_screening(screening_id: str, session: AsyncSession = Depends(get_db)) -> ScreeningRead:
    """Return one screening by id."""
    row = await ScreeningService().get_screening(session, screening_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Screening not found")
    return ScreeningRead(**row)


@router.post("/{screening_id}/checkout-session", response_model=CheckoutSessionRead)
async def create_screening_checkout_session(
    screening_id: str,
    payload: CheckoutSessionCreate,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> CheckoutSessionRead:
    """Create a Stripe Checkout Session for screening tickets."""
    user_id = await _require_ticket_user(current_user, session)
    receipt_email = current_user.get("email")
    checkout = await PaymentService().create_screening_checkout_session(
        session=session,
        screening_id=screening_id,
        buyer_user_id=user_id,
        quantity=payload.quantity,
        coupon_id=str(payload.coupon_id) if payload.coupon_id else None,
        email_notification=str(receipt_email) if receipt_email else None,
    )
    return CheckoutSessionRead(**checkout)


@router.post("", response_model=ScreeningRead, status_code=status.HTTP_201_CREATED)
async def create_screening(
    payload: ScreeningCreate,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ScreeningRead:
    """Create a standalone screening for the current cinema admin's cinema."""
    cinema_id = await _require_cinema_admin(current_user, session)
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user payload")
    row = await ScreeningService().create_screening(session, payload, cinema_id, user_id)
    return ScreeningRead(**row)


@router.post("/{screening_id}/open-sales", response_model=ScreeningRead)
async def open_sales(
    screening_id: str,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ScreeningRead:
    """Transition a screening from `scheduled` to `selling`."""
    screening, _ = await _load_owned_screening(screening_id, current_user, session)
    row = await ScreeningService().open_sales(session, screening)
    return ScreeningRead(**row)


@router.post("/{screening_id}/confirm", response_model=ScreeningRead)
async def confirm_screening(
    screening_id: str,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ScreeningRead:
    """Transition a screening from `selling` or `pending` to `confirmed`."""
    screening, _ = await _load_owned_screening(screening_id, current_user, session)
    row = await ScreeningService().confirm_screening(session, screening)
    return ScreeningRead(**row)


@router.post("/{screening_id}/cancel", response_model=ScreeningRead)
async def cancel_screening(
    screening_id: str,
    payload: ScreeningCancelRequest | None = None,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ScreeningRead:
    """Transition a screening to `cancelled` and refund eligible paid admissions."""
    screening, _ = await _load_owned_screening(screening_id, current_user, session)
    reason = payload.reason if payload else None
    row = await ScreeningService().cancel_screening(session, screening, reason)
    return ScreeningRead(**row)
