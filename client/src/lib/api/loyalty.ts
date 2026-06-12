import { apiFetch } from "@/lib/api/client";

export type LoyaltyBadgeRead = {
  id: string;
  cinema_id: string | null;
  cinema_name: string | null;
  badge_key: string;
  title: string;
  description: string;
  earned_at: string;
};

export type RewardCouponRead = {
  id: string;
  cinema_id: string | null;
  status: "available" | "redeemed" | "expired";
  discount_percent: number;
  max_discount_cents: number;
  points_cost: number;
  expires_at: string;
  created_at: string;
};

export type VoucherOptionRead = {
  discount_percent: number;
  points_cost: number;
  max_discount_cents: number;
  available: boolean;
};

export type LoyaltyWalletRead = {
  points: number;
  level_name: string;
  next_level_name: string | null;
  points_to_next_level: number | null;
  badges: LoyaltyBadgeRead[];
  coupons: RewardCouponRead[];
  voucher_options: VoucherOptionRead[];
};

export function getMyLoyaltyWallet(token: string) {
  return apiFetch<LoyaltyWalletRead>("/loyalty/me", { token });
}

export function createRewardCoupon(discountPercent: number, token: string) {
  return apiFetch<RewardCouponRead>("/loyalty/coupons", {
    method: "POST",
    token,
    body: JSON.stringify({ discount_percent: discountPercent }),
  });
}
