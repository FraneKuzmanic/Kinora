from fastapi import Depends, HTTPException, status
from fastapi.routing import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.api.deps.authorization import require_any_role, resolve_role
from app.api.deps.db import get_db
from app.schemas.loyalty import (
    CreateRewardCouponRequest,
    LoyaltyWalletRead,
    RewardCouponRead,
)
from app.services.loyalty_service import LoyaltyService
from app.services.profile_service import ProfileService

router = APIRouter()


async def _require_loyalty_user(current_user: dict, session: AsyncSession) -> str:
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user payload")

    profile = await ProfileService().get_by_user_id(session, user_id)
    role = resolve_role(current_user, profile.role if profile else None)
    require_any_role(role, {"audience", "cinema_admin"})
    return user_id


@router.get("/me", response_model=LoyaltyWalletRead)
async def get_my_loyalty_wallet(
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> LoyaltyWalletRead:
    user_id = await _require_loyalty_user(current_user, session)
    return await LoyaltyService().get_wallet(session, user_id)


@router.post("/coupons", response_model=RewardCouponRead)
async def create_reward_coupon(
    body: CreateRewardCouponRequest,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> RewardCouponRead:
    user_id = await _require_loyalty_user(current_user, session)
    return await LoyaltyService().create_coupon(session, user_id, body.discount_percent)
