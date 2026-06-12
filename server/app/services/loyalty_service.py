import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.loyalty import (
    LoyaltyBadgeRead,
    LoyaltyWalletRead,
    RewardCouponRead,
    VoucherOptionRead,
)


POINTS_VOTE = 10
POINTS_RECOMMENDATION = 10
POINTS_RECOMMENDATION_ACCEPTED = 30
POINTS_SCREENING_TICKET = 25
POINTS_EARLY_BIRD = 40
POINTS_ATTENDANCE = 50

VOUCHER_OPTIONS = {
    10: {"points_cost": 200, "max_discount_cents": 300},
    20: {"points_cost": 400, "max_discount_cents": 500},
}

LEVELS = [
    (0, "Newcomer"),
    (100, "Regular"),
    (300, "Cinephile"),
    (700, "Curator"),
    (1500, "Kinora Legend"),
]


class LoyaltyService:
    async def get_wallet(self, session: AsyncSession, user_id: str) -> LoyaltyWalletRead:
        user_uuid = uuid.UUID(user_id)
        await self.backfill_user_points(session, user_uuid)
        await self.evaluate_badges(session, user_uuid)
        await self.expire_old_coupons(session, user_uuid)
        await session.commit()

        points = await self._points_balance(session, user_uuid)
        badges = await self._list_badges(session, user_uuid)
        coupons = await self._list_coupons(session, user_uuid)
        current_level, next_level, points_to_next = self._level_for_points(points)

        return LoyaltyWalletRead(
            points=points,
            level_name=current_level,
            next_level_name=next_level,
            points_to_next_level=points_to_next,
            badges=badges,
            coupons=coupons,
            voucher_options=[
                VoucherOptionRead(
                    discount_percent=discount_percent,
                    points_cost=option["points_cost"],
                    max_discount_cents=option["max_discount_cents"],
                    available=points >= option["points_cost"],
                )
                for discount_percent, option in VOUCHER_OPTIONS.items()
            ],
        )

    async def create_coupon(
        self,
        session: AsyncSession,
        user_id: str,
        discount_percent: int,
    ) -> RewardCouponRead:
        if discount_percent not in VOUCHER_OPTIONS:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unsupported voucher")

        user_uuid = uuid.UUID(user_id)
        await self.backfill_user_points(session, user_uuid)
        points = await self._points_balance(session, user_uuid)
        option = VOUCHER_OPTIONS[discount_percent]
        if points < option["points_cost"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Not enough Kinora points for this voucher",
            )

        now = datetime.now(UTC)
        coupon_id = uuid.uuid4()
        await session.execute(
            text(
                "INSERT INTO public.reward_coupons "
                "(id, user_id, status, discount_percent, max_discount_cents, points_cost, created_at, expires_at) "
                "VALUES (:id, :user_id, 'available', :discount_percent, :max_discount_cents, :points_cost, :created_at, :expires_at)"
            ),
            {
                "id": coupon_id,
                "user_id": user_uuid,
                "discount_percent": discount_percent,
                "max_discount_cents": option["max_discount_cents"],
                "points_cost": option["points_cost"],
                "created_at": now,
                "expires_at": now + timedelta(days=30),
            },
        )
        await self.award_points(
            session,
            user_id=user_uuid,
            points=-option["points_cost"],
            reason=f"{discount_percent}% voucher redeemed",
            source_type="reward_coupon",
            source_id=coupon_id,
            cinema_id=None,
            created_at=now,
        )
        await self.evaluate_badges(session, user_uuid)
        await session.commit()

        rows = await session.execute(
            text(
                "SELECT id, cinema_id, status, discount_percent, max_discount_cents, points_cost, expires_at, created_at "
                "FROM public.reward_coupons WHERE id = :id"
            ),
            {"id": coupon_id},
        )
        row = rows.first()
        return self._coupon_from_row(row)

    async def award_points(
        self,
        session: AsyncSession,
        *,
        user_id: uuid.UUID,
        points: int,
        reason: str,
        source_type: str,
        source_id: uuid.UUID,
        cinema_id: uuid.UUID | None,
        created_at: datetime | None = None,
    ) -> None:
        await session.execute(
            text(
                "INSERT INTO public.points_ledger "
                "(id, user_id, cinema_id, points, reason, source_type, source_id, created_at) "
                "VALUES (:id, :user_id, :cinema_id, :points, :reason, :source_type, :source_id, :created_at) "
                "ON CONFLICT (user_id, source_type, source_id) DO NOTHING"
            ),
            {
                "id": uuid.uuid4(),
                "user_id": user_id,
                "cinema_id": cinema_id,
                "points": points,
                "reason": reason,
                "source_type": source_type,
                "source_id": source_id,
                "created_at": created_at or datetime.now(UTC),
            },
        )

    async def prepare_coupon_discount(
        self,
        session: AsyncSession,
        *,
        user_id: str,
        coupon_id: str | None,
        subtotal_cents: int,
    ) -> dict[str, str]:
        if not coupon_id:
            return {}

        rows = await session.execute(
            text(
                "SELECT id, discount_percent, max_discount_cents "
                "FROM public.reward_coupons "
                "WHERE id = :coupon_id "
                "  AND user_id = :user_id "
                "  AND status = 'available' "
                "  AND expires_at >= now()"
            ),
            {"coupon_id": uuid.UUID(coupon_id), "user_id": uuid.UUID(user_id)},
        )
        row = rows.first()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Coupon is not available for this checkout",
            )

        discount_percent = int(row.discount_percent)
        max_discount_cents = int(row.max_discount_cents)
        discount_cents = min((subtotal_cents * discount_percent) // 100, max_discount_cents)
        if discount_cents <= 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Coupon cannot reduce this checkout",
            )

        return {
            "coupon_id": str(row.id),
            "coupon_discount_percent": str(discount_percent),
            "coupon_max_discount_cents": str(max_discount_cents),
            "coupon_discount_cents": str(discount_cents),
        }

    async def mark_coupon_redeemed(
        self,
        session: AsyncSession,
        *,
        user_id: str,
        coupon_id: str | None,
        order_id: uuid.UUID,
    ) -> None:
        if not coupon_id:
            return

        await session.execute(
            text(
                "UPDATE public.reward_coupons "
                "SET status = 'redeemed', redeemed_at = :redeemed_at, redeemed_order_id = :order_id "
                "WHERE id = :coupon_id "
                "  AND user_id = :user_id "
                "  AND status = 'available'"
            ),
            {
                "coupon_id": uuid.UUID(coupon_id),
                "user_id": uuid.UUID(user_id),
                "order_id": order_id,
                "redeemed_at": datetime.now(UTC),
            },
        )

    async def backfill_user_points(self, session: AsyncSession, user_id: uuid.UUID) -> None:
        await session.execute(
            text(
                "INSERT INTO public.points_ledger "
                "(id, user_id, cinema_id, points, reason, source_type, source_id, created_at) "
                "SELECT gen_random_uuid(), cv.user_id, c.cinema_id, CAST(:points AS int), 'Campaign vote', 'campaign_vote', cv.id, cv.created_at "
                "FROM public.campaign_votes cv "
                "JOIN public.campaigns c ON c.id = cv.campaign_id "
                "WHERE cv.user_id = :user_id "
                "ON CONFLICT (user_id, source_type, source_id) DO NOTHING"
            ),
            {"user_id": user_id, "points": POINTS_VOTE},
        )
        await session.execute(
            text(
                "INSERT INTO public.points_ledger "
                "(id, user_id, cinema_id, points, reason, source_type, source_id, created_at) "
                "SELECT gen_random_uuid(), mr.user_id, mr.cinema_id, CAST(:points AS int), 'Movie recommendation', "
                "       'movie_recommendation', mr.id, mr.created_at "
                "FROM public.movie_recommendations mr "
                "WHERE mr.user_id = :user_id "
                "ON CONFLICT (user_id, source_type, source_id) DO NOTHING"
            ),
            {"user_id": user_id, "points": POINTS_RECOMMENDATION},
        )
        await session.execute(
            text(
                "INSERT INTO public.points_ledger "
                "(id, user_id, cinema_id, points, reason, source_type, source_id, created_at) "
                "SELECT gen_random_uuid(), mr.user_id, mr.cinema_id, CAST(:points AS int), 'Accepted movie recommendation', "
                "       'movie_recommendation_accepted', mr.id, mr.created_at "
                "FROM public.movie_recommendations mr "
                "WHERE mr.user_id = :user_id AND mr.status::text = 'accepted' "
                "ON CONFLICT (user_id, source_type, source_id) DO NOTHING"
            ),
            {"user_id": user_id, "points": POINTS_RECOMMENDATION_ACCEPTED},
        )
        await session.execute(
            text(
                "INSERT INTO public.points_ledger "
                "(id, user_id, cinema_id, points, reason, source_type, source_id, created_at) "
                "SELECT gen_random_uuid(), a.buyer_user_id, "
                "       COALESCE(s.cinema_id, c.cinema_id) AS cinema_id, "
                "       CASE WHEN a.type::text = 'campaign_earlybird' THEN CAST(:earlybird_points AS int) ELSE CAST(:ticket_points AS int) END, "
                "       CASE WHEN a.type::text = 'campaign_earlybird' THEN 'Early-bird ticket purchase' ELSE 'Screening ticket purchase' END, "
                "       CASE WHEN a.type::text = 'campaign_earlybird' THEN 'earlybird_purchase' ELSE 'screening_ticket_purchase' END, "
                "       a.id, a.created_at "
                "FROM public.admissions a "
                "LEFT JOIN public.screenings s ON s.id = a.screening_id "
                "LEFT JOIN public.campaign_movies cm ON cm.id = a.campaign_movie_id "
                "LEFT JOIN public.campaigns c ON c.id = cm.campaign_id "
                "WHERE a.buyer_user_id = :user_id "
                "  AND a.status::text IN ('pending_outcome', 'active', 'used', 'lost_no_refund') "
                "ON CONFLICT (user_id, source_type, source_id) DO NOTHING"
            ),
            {
                "user_id": user_id,
                "earlybird_points": POINTS_EARLY_BIRD,
                "ticket_points": POINTS_SCREENING_TICKET,
            },
        )
        await session.execute(
            text(
                "INSERT INTO public.points_ledger "
                "(id, user_id, cinema_id, points, reason, source_type, source_id, created_at) "
                "SELECT gen_random_uuid(), a.buyer_user_id, s.cinema_id, CAST(:points AS int), 'Ticket attended', "
                "       'ticket_attendance', ar.id, ar.redeemed_at "
                "FROM public.admission_redemptions ar "
                "JOIN public.admissions a ON a.id = ar.admission_id "
                "LEFT JOIN public.screenings s ON s.id = a.screening_id "
                "WHERE a.buyer_user_id = :user_id "
                "ON CONFLICT (user_id, source_type, source_id) DO NOTHING"
            ),
            {"user_id": user_id, "points": POINTS_ATTENDANCE},
        )

    async def evaluate_badges(self, session: AsyncSession, user_id: uuid.UUID) -> None:
        now = datetime.now(UTC)
        rows = await session.execute(
            text(
                "SELECT "
                "  COUNT(DISTINCT cv.id) AS votes, "
                "  COUNT(DISTINCT a.id) FILTER (WHERE a.status::text IN ('pending_outcome', 'active', 'used', 'lost_no_refund')) AS tickets, "
                "  COUNT(DISTINCT mr.id) AS recommendations, "
                "  COUNT(DISTINCT mr.id) FILTER (WHERE mr.status::text = 'accepted') AS accepted_recommendations "
                "FROM public.profiles p "
                "LEFT JOIN public.campaign_votes cv ON cv.user_id = p.user_id "
                "LEFT JOIN public.admissions a ON a.buyer_user_id = p.user_id "
                "LEFT JOIN public.movie_recommendations mr ON mr.user_id = p.user_id "
                "WHERE p.user_id = :user_id"
            ),
            {"user_id": user_id},
        )
        stats = rows.first()
        global_badges = []
        if int(stats.votes or 0) >= 1:
            global_badges.append(("first_vote", "First Vote", "Voted in your first Kinora campaign."))
        if int(stats.votes or 0) >= 5:
            global_badges.append(("campaign_regular", "Campaign Regular", "Voted in 5 campaigns."))
        if int(stats.votes or 0) >= 20:
            global_badges.append(("power_voter", "Power Voter", "Voted in 20 campaigns."))
        if int(stats.tickets or 0) >= 1:
            global_badges.append(("first_ticket", "First Ticket", "Bought your first Kinora ticket."))
        if int(stats.tickets or 0) >= 10:
            global_badges.append(("kinora_regular", "Kinora Regular", "Bought 10 tickets across Kinora."))
        if int(stats.recommendations or 0) >= 5:
            global_badges.append(("film_scout", "Film Scout", "Recommended 5 movies."))
        if int(stats.accepted_recommendations or 0) >= 1:
            global_badges.append(("taste_maker", "Taste Maker", "Had a movie recommendation accepted."))

        for key, title, description in global_badges:
            await self._insert_badge(session, user_id, None, key, title, description, now)

        cinema_rows = await session.execute(
            text(
                "SELECT cinema_id, cinema_name, SUM(ticket_count) AS ticket_count "
                "FROM ("
                "  SELECT s.cinema_id, ci.name AS cinema_name, SUM(a.quantity) AS ticket_count "
                "  FROM public.admissions a "
                "  JOIN public.screenings s ON s.id = a.screening_id "
                "  JOIN public.cinemas ci ON ci.id = s.cinema_id "
                "  WHERE a.buyer_user_id = :user_id "
                "    AND a.status::text IN ('pending_outcome', 'active', 'used', 'lost_no_refund') "
                "  GROUP BY s.cinema_id, ci.name "
                "  UNION ALL "
                "  SELECT c.cinema_id, ci.name AS cinema_name, SUM(a.quantity) AS ticket_count "
                "  FROM public.admissions a "
                "  JOIN public.campaign_movies cm ON cm.id = a.campaign_movie_id "
                "  JOIN public.campaigns c ON c.id = cm.campaign_id "
                "  JOIN public.cinemas ci ON ci.id = c.cinema_id "
                "  WHERE a.buyer_user_id = :user_id "
                "    AND a.status::text IN ('pending_outcome', 'active', 'used', 'lost_no_refund') "
                "  GROUP BY c.cinema_id, ci.name "
                ") ticket_sources "
                "GROUP BY cinema_id, cinema_name"
            ),
            {"user_id": user_id},
        )
        for row in cinema_rows:
            count = int(row.ticket_count or 0)
            thresholds = [
                (1, "visitor", "Visitor"),
                (5, "regular", "Regular"),
                (10, "loyalist", "Loyalist"),
                (20, "patron", "Patron"),
            ]
            for threshold, suffix, label in thresholds:
                if count >= threshold:
                    cinema_name = row.cinema_name
                    await self._insert_badge(
                        session,
                        user_id,
                        row.cinema_id,
                        f"cinema_{suffix}",
                        f"{cinema_name} {label}",
                        f"Bought {threshold}+ tickets for {cinema_name}.",
                        now,
                    )

    async def expire_old_coupons(self, session: AsyncSession, user_id: uuid.UUID) -> None:
        await session.execute(
            text(
                "UPDATE public.reward_coupons "
                "SET status = 'expired' "
                "WHERE user_id = :user_id AND status = 'available' AND expires_at < now()"
            ),
            {"user_id": user_id},
        )

    async def _insert_badge(
        self,
        session: AsyncSession,
        user_id: uuid.UUID,
        cinema_id: uuid.UUID | None,
        badge_key: str,
        title: str,
        description: str,
        earned_at: datetime,
    ) -> None:
        if cinema_id is None:
            await session.execute(
                text(
                    "INSERT INTO public.user_badges (id, user_id, cinema_id, badge_key, title, description, earned_at) "
                    "VALUES (:id, :user_id, NULL, :badge_key, :title, :description, :earned_at) "
                    "ON CONFLICT (user_id, badge_key) WHERE cinema_id IS NULL DO NOTHING"
                ),
                {
                    "id": uuid.uuid4(),
                    "user_id": user_id,
                    "badge_key": badge_key,
                    "title": title,
                    "description": description,
                    "earned_at": earned_at,
                },
            )
            return

        await session.execute(
            text(
                "INSERT INTO public.user_badges (id, user_id, cinema_id, badge_key, title, description, earned_at) "
                "VALUES (:id, :user_id, :cinema_id, :badge_key, :title, :description, :earned_at) "
                "ON CONFLICT (user_id, cinema_id, badge_key) DO NOTHING"
            ),
            {
                "id": uuid.uuid4(),
                "user_id": user_id,
                "cinema_id": cinema_id,
                "badge_key": badge_key,
                "title": title,
                "description": description,
                "earned_at": earned_at,
            },
        )

    async def _points_balance(self, session: AsyncSession, user_id: uuid.UUID) -> int:
        rows = await session.execute(
            text("SELECT COALESCE(SUM(points), 0)::int AS points FROM public.points_ledger WHERE user_id = :user_id"),
            {"user_id": user_id},
        )
        return int(rows.scalar() or 0)

    async def _list_badges(self, session: AsyncSession, user_id: uuid.UUID) -> list[LoyaltyBadgeRead]:
        rows = await session.execute(
            text(
                "SELECT b.id, b.cinema_id, c.name AS cinema_name, b.badge_key, b.title, b.description, b.earned_at "
                "FROM public.user_badges b "
                "LEFT JOIN public.cinemas c ON c.id = b.cinema_id "
                "WHERE b.user_id = :user_id "
                "ORDER BY b.earned_at DESC, b.title ASC"
            ),
            {"user_id": user_id},
        )
        return [LoyaltyBadgeRead(**dict(row._mapping)) for row in rows]

    async def _list_coupons(self, session: AsyncSession, user_id: uuid.UUID) -> list[RewardCouponRead]:
        rows = await session.execute(
            text(
                "SELECT id, cinema_id, status, discount_percent, max_discount_cents, points_cost, expires_at, created_at "
                "FROM public.reward_coupons "
                "WHERE user_id = :user_id AND status = 'available' "
                "ORDER BY expires_at ASC"
            ),
            {"user_id": user_id},
        )
        return [self._coupon_from_row(row) for row in rows]

    def _coupon_from_row(self, row: Any) -> RewardCouponRead:
        return RewardCouponRead(**dict(row._mapping))

    def _level_for_points(self, points: int) -> tuple[str, str | None, int | None]:
        current = LEVELS[0][1]
        next_level: tuple[int, str] | None = None
        for index, (threshold, name) in enumerate(LEVELS):
            if points >= threshold:
                current = name
                next_level = LEVELS[index + 1] if index + 1 < len(LEVELS) else None
        if next_level is None:
            return current, None, None
        return current, next_level[1], max(next_level[0] - points, 0)
