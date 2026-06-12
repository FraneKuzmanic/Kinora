import uuid

from fastapi import Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from fastapi.routing import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.api.deps.authorization import require_any_role, resolve_role
from app.api.deps.db import get_db
from app.schemas.payment import CheckoutSessionRead
from app.schemas.private_booking import (
    PrivateBookingAnalyticsRead,
    PrivateBookingCancel,
    PrivateBookingCreate,
    PrivateBookingRead,
    PrivateBookingReview,
)
from app.notifications.service import NotificationService
from app.services.campaign_service import CampaignService
from app.services.payment_service import PaymentService
from app.services.private_booking_service import PrivateBookingService
from app.services.profile_service import ProfileService

router = APIRouter()


async def _resolve_actor(current_user: dict, session: AsyncSession) -> tuple[str, str]:
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user payload")
    profile = await ProfileService().get_by_user_id(session, user_id)
    role = resolve_role(current_user, profile.role if profile else None)
    return user_id, role


async def _require_admin_cinema(current_user: dict, session: AsyncSession) -> tuple[str, uuid.UUID]:
    user_id, role = await _resolve_actor(current_user, session)
    require_any_role(role, {"cinema_admin"})
    cinema_id = await CampaignService().get_admin_cinema_id(session, user_id)
    if not cinema_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No cinema membership found for this user",
        )
    return user_id, cinema_id


@router.get("", response_model=list[PrivateBookingRead])
async def list_private_bookings(
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[PrivateBookingRead]:
    """List requester-owned bookings or cinema-owned requests for admins."""
    user_id, role = await _resolve_actor(current_user, session)
    require_any_role(role, {"audience", "cinema_admin"})

    if role == "cinema_admin":
        cinema_id = await CampaignService().get_admin_cinema_id(session, user_id)
        if not cinema_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No cinema membership found for this user",
            )
        rows = await PrivateBookingService().list_requests(session, cinema_id=cinema_id)
    else:
        rows = await PrivateBookingService().list_requests(session, requester_user_id=user_id)
    return [PrivateBookingRead.model_validate(row) for row in rows]


@router.post("", response_model=PrivateBookingRead, status_code=status.HTTP_201_CREATED)
async def create_private_booking(
    payload: PrivateBookingCreate,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> PrivateBookingRead:
    """Submit a new private booking request as an authenticated user."""
    user_id, role = await _resolve_actor(current_user, session)
    require_any_role(role, {"audience", "cinema_admin"})

    row = await PrivateBookingService().create_request(
        session,
        requester_user_id=user_id,
        payload=payload,
        email_notification=current_user.get("email"),
    )
    return PrivateBookingRead.model_validate(row)


@router.get("/analytics", response_model=PrivateBookingAnalyticsRead)
async def get_private_booking_analytics(
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> PrivateBookingAnalyticsRead:
    """Return private booking analytics for the current cinema admin's cinema."""
    _, cinema_id = await _require_admin_cinema(current_user, session)
    row = await PrivateBookingService().get_analytics(session, cinema_id)
    return PrivateBookingAnalyticsRead.model_validate(row)


@router.get("/{booking_id}/cancel-link", include_in_schema=False)
async def redirect_private_booking_cancel_link(booking_id: uuid.UUID) -> RedirectResponse:
    """Redirect email cancellation links to the frontend confirmation page."""
    target_url = NotificationService().build_private_booking_cancel_confirmation_url(str(booking_id))
    return RedirectResponse(url=target_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)


@router.patch("/{booking_id}/review", response_model=PrivateBookingRead)
async def review_private_booking(
    booking_id: str,
    payload: PrivateBookingReview,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> PrivateBookingRead:
    """Review and update booking status as owning cinema admin."""
    user_id, cinema_id = await _require_admin_cinema(current_user, session)
    row = await PrivateBookingService().review_request(
        session=session,
        booking_id=booking_id,
        reviewer_user_id=user_id,
        cinema_id=cinema_id,
        payload=payload,
    )
    return PrivateBookingRead.model_validate(row)


@router.post("/{booking_id}/accept/checkout-session", response_model=CheckoutSessionRead)
async def accept_private_booking_checkout_session(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> CheckoutSessionRead:
    """Accept an offered private booking and create a Stripe Checkout Session."""
    user_id, role = await _resolve_actor(current_user, session)
    require_any_role(role, {"audience", "cinema_admin"})
    checkout = await PaymentService().create_private_booking_checkout_session(
        session=session,
        booking_id=booking_id,
        buyer_user_id=user_id,
        email_notification=current_user.get("email"),
    )
    return CheckoutSessionRead(**checkout)


@router.post("/{booking_id}/cancel", response_model=PrivateBookingRead)
async def cancel_private_booking(
    booking_id: str,
    payload: PrivateBookingCancel | None = None,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> PrivateBookingRead:
    """Cancel a private booking as requester or owning cinema admin."""
    user_id, role = await _resolve_actor(current_user, session)
    require_any_role(role, {"audience", "cinema_admin"})
    cinema_id = None
    if role == "cinema_admin":
        cinema_id = await CampaignService().get_admin_cinema_id(session, user_id)
    row = await PrivateBookingService().cancel_request(
        session=session,
        booking_id=booking_id,
        actor_user_id=user_id,
        actor_role=role,
        cinema_id=cinema_id,
        payload=payload,
    )
    return PrivateBookingRead.model_validate(row)
