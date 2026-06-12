import uuid
from datetime import datetime

from fastapi import Depends, HTTPException, Query, status
from fastapi.routing import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.api.deps.authorization import require_any_role, resolve_role
from app.api.deps.db import get_db
from app.schemas.analytics import (
    CampaignFunnelRead,
    ContentDemandRead,
    RevenueMetricsRead,
    SlotPerformanceRead,
)
from app.schemas.analytics import ScreeningHealthRead
from app.schemas.private_booking import PrivateBookingAnalyticsRead
from app.services.analytics_service import (
    get_campaign_funnel,
    get_content_demand,
    get_revenue_metrics,
    get_screening_health,
    get_slot_performance,
)
from app.services.campaign_service import CampaignService
from app.services.private_booking_service import PrivateBookingService
from app.services.profile_service import ProfileService

router = APIRouter()


async def _require_cinema_admin(current_user: dict, session: AsyncSession) -> tuple[str, uuid.UUID]:
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
    return user_id, cinema_id


@router.get("/campaign-funnel", response_model=CampaignFunnelRead)
async def get_campaign_funnel_endpoint(
    start_date: datetime | None = Query(default=None),
    end_date: datetime | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> CampaignFunnelRead:
    """Campaign funnel analytics: views → votes → reservations."""
    _, cinema_id = await _require_cinema_admin(current_user, session)
    return await get_campaign_funnel(session, cinema_id, start_date, end_date)


@router.get("/screening-health", response_model=list[ScreeningHealthRead])
async def get_screening_health_endpoint(
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[ScreeningHealthRead]:
    """Active screening health: ticket progress, days left, risk flag."""
    _, cinema_id = await _require_cinema_admin(current_user, session)
    return await get_screening_health(session, cinema_id)


@router.get("/slot-performance", response_model=SlotPerformanceRead)
async def get_slot_performance_endpoint(
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> SlotPerformanceRead:
    """Slot performance: average fill rates by weekday × time bucket."""
    _, cinema_id = await _require_cinema_admin(current_user, session)
    return await get_slot_performance(session, cinema_id)


@router.get("/content-demand", response_model=ContentDemandRead)
async def get_content_demand_endpoint(
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ContentDemandRead:
    """Content demand: most voted, most recommended, genre trends."""
    _, cinema_id = await _require_cinema_admin(current_user, session)
    return await get_content_demand(session, cinema_id)


@router.get("/revenue", response_model=RevenueMetricsRead)
async def get_revenue_metrics_endpoint(
    start_date: datetime | None = Query(default=None),
    end_date: datetime | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> RevenueMetricsRead:
    """Revenue metrics: confirmed revenue, pending potential, refunds."""
    _, cinema_id = await _require_cinema_admin(current_user, session)
    return await get_revenue_metrics(session, cinema_id, start_date, end_date)


@router.get("/private-bookings", response_model=PrivateBookingAnalyticsRead)
async def get_private_booking_analytics_endpoint(
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> PrivateBookingAnalyticsRead:
    """Private booking analytics: request count, approval rate, date/time preferences."""
    _, cinema_id = await _require_cinema_admin(current_user, session)
    row = await PrivateBookingService().get_analytics(session, cinema_id)
    return PrivateBookingAnalyticsRead.model_validate(row)
