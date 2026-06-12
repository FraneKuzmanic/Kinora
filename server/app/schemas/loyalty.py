import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class LoyaltyBadgeRead(BaseModel):
    id: uuid.UUID
    cinema_id: uuid.UUID | None
    cinema_name: str | None = None
    badge_key: str
    title: str
    description: str
    earned_at: datetime


class RewardCouponRead(BaseModel):
    id: uuid.UUID
    cinema_id: uuid.UUID | None
    status: Literal["available", "redeemed", "expired"]
    discount_percent: int
    max_discount_cents: int
    points_cost: int
    expires_at: datetime
    created_at: datetime


class VoucherOptionRead(BaseModel):
    discount_percent: int
    points_cost: int
    max_discount_cents: int
    available: bool


class LoyaltyWalletRead(BaseModel):
    points: int
    level_name: str
    next_level_name: str | None
    points_to_next_level: int | None
    badges: list[LoyaltyBadgeRead]
    coupons: list[RewardCouponRead]
    voucher_options: list[VoucherOptionRead]


class CreateRewardCouponRequest(BaseModel):
    discount_percent: Literal[10, 20]

