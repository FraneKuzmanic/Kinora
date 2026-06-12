import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import Date, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cinema import CinemaHall, CinemaLocation
from app.models.payment import Order, OrderStatus
from app.models.private_booking import PrivateBookingRequest, PrivateBookingStatus
from app.notifications.service import NotificationService
from app.schemas.private_booking import PrivateBookingCancel, PrivateBookingCreate, PrivateBookingReview


ALLOWED_TRANSITIONS: dict[PrivateBookingStatus, set[PrivateBookingStatus]] = {
    PrivateBookingStatus.submitted: {
        PrivateBookingStatus.in_review,
        PrivateBookingStatus.offered,
        PrivateBookingStatus.rejected,
        PrivateBookingStatus.cancelled,
    },
    PrivateBookingStatus.in_review: {
        PrivateBookingStatus.offered,
        PrivateBookingStatus.rejected,
        PrivateBookingStatus.cancelled,
    },
    PrivateBookingStatus.offered: {
        PrivateBookingStatus.accepted,
        PrivateBookingStatus.cancelled,
    },
    PrivateBookingStatus.accepted: {
        PrivateBookingStatus.paid,
        PrivateBookingStatus.cancelled,
    },
    PrivateBookingStatus.paid: {PrivateBookingStatus.cancelled},
    PrivateBookingStatus.rejected: set(),
    PrivateBookingStatus.cancelled: set(),
}

APPROVED_STATUSES = {
    PrivateBookingStatus.offered,
    PrivateBookingStatus.accepted,
    PrivateBookingStatus.paid,
}


class PrivateBookingService:
    """Manage private booking request lifecycle."""

    def __init__(self, notification_service: NotificationService | None = None) -> None:
        self._notification_service = notification_service or NotificationService()

    async def list_requests(
        self,
        session: AsyncSession,
        *,
        requester_user_id: str | None = None,
        cinema_id: uuid.UUID | None = None,
    ) -> list[PrivateBookingRequest]:
        statement = select(PrivateBookingRequest).order_by(PrivateBookingRequest.created_at.desc())
        if requester_user_id:
            statement = statement.where(PrivateBookingRequest.requester_user_id == uuid.UUID(requester_user_id))
        if cinema_id:
            statement = statement.where(PrivateBookingRequest.cinema_id == cinema_id)
        result = await session.execute(statement)
        return list(result.scalars().all())

    async def create_request(
        self,
        session: AsyncSession,
        requester_user_id: str,
        payload: PrivateBookingCreate,
        *,
        email_notification: str | None = None,
    ) -> PrivateBookingRequest:
        if (
            payload.preferred_start_at is not None
            and payload.preferred_end_at is not None
            and payload.preferred_end_at <= payload.preferred_start_at
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Preferred end time must be after preferred start time",
            )

        if payload.preferred_location_id is not None:
            preferred_location = await session.get(CinemaLocation, payload.preferred_location_id)
            if not preferred_location or preferred_location.cinema_id != payload.cinema_id:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Preferred location does not belong to the selected cinema",
                )

        hall_count_statement = select(func.count(CinemaHall.id)).where(
            CinemaHall.allow_private_booking.is_(True),
        )
        if payload.preferred_location_id is not None:
            hall_count_statement = hall_count_statement.where(
                CinemaHall.location_id == payload.preferred_location_id,
            )
        else:
            hall_count_statement = hall_count_statement.join(
                CinemaLocation,
                CinemaLocation.id == CinemaHall.location_id,
            ).where(CinemaLocation.cinema_id == payload.cinema_id)

        private_booking_hall_count = int(
            (await session.execute(hall_count_statement)).scalar() or 0,
        )
        if private_booking_hall_count == 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This cinema currently has no halls available for private booking",
            )

        now = datetime.now(UTC)
        item = PrivateBookingRequest(
            id=uuid.uuid4(),
            requester_user_id=uuid.UUID(requester_user_id),
            cinema_id=payload.cinema_id,
            preferred_location_id=payload.preferred_location_id,
            preferred_start_at=payload.preferred_start_at,
            preferred_end_at=payload.preferred_end_at,
            group_size=payload.group_size,
            event_type=payload.event_type,
            notes=payload.notes,
            status=PrivateBookingStatus.submitted,
            currency="EUR",
            created_at=now,
            updated_at=now,
        )
        session.add(item)
        await self._notification_service.enqueue_private_booking_submitted(
            session,
            item,
            email_notification=email_notification,
        )
        await session.commit()
        await session.refresh(item)
        return item

    async def review_request(
        self,
        session: AsyncSession,
        booking_id: str,
        reviewer_user_id: str,
        cinema_id: uuid.UUID,
        payload: PrivateBookingReview,
        *,
        email_notification: str | None = None,
    ) -> PrivateBookingRequest:
        item = await self.get_request(session, booking_id)
        self.assert_admin_ownership(item, cinema_id)

        target_status = PrivateBookingStatus(payload.status)
        self._assert_transition(item.status, target_status)
        if target_status == PrivateBookingStatus.offered:
            await self._validate_offer(session, item, payload)

        now = datetime.now(UTC)
        item.status = target_status
        item.offered_location_id = payload.offered_location_id
        item.offered_hall_id = payload.offered_hall_id
        item.offered_start_at = payload.offered_start_at
        item.offered_end_at = payload.offered_end_at
        item.quoted_price_cents = payload.quoted_price_cents
        item.cinema_response_message = payload.cinema_response_message
        item.responded_by_user_id = uuid.UUID(reviewer_user_id)
        item.responded_at = now
        item.updated_at = now

        await self._notification_service.enqueue_private_booking_reviewed(
            session,
            item,
            email_notification=email_notification,
        )
        await session.commit()
        await session.refresh(item)
        return item

    async def mark_accepted(
        self,
        session: AsyncSession,
        item: PrivateBookingRequest,
        order_id: uuid.UUID,
    ) -> None:
        self._assert_transition(item.status, PrivateBookingStatus.accepted)
        now = datetime.now(UTC)
        item.status = PrivateBookingStatus.accepted
        item.accepted_at = now
        item.order_id = order_id
        item.updated_at = now
        session.add(item)

    async def mark_paid(
        self,
        session: AsyncSession,
        item: PrivateBookingRequest,
    ) -> None:
        if item.status == PrivateBookingStatus.paid:
            return
        self._assert_transition(item.status, PrivateBookingStatus.paid)
        item.status = PrivateBookingStatus.paid
        item.updated_at = datetime.now(UTC)
        session.add(item)

    async def cancel_request(
        self,
        session: AsyncSession,
        booking_id: str,
        actor_user_id: str,
        *,
        actor_role: str,
        cinema_id: uuid.UUID | None,
        payload: PrivateBookingCancel | None,
    ) -> PrivateBookingRequest:
        item = await self.get_request(session, booking_id)
        if actor_role == "cinema_admin":
            if cinema_id is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No cinema membership found for this user",
                )
            self.assert_admin_ownership(item, cinema_id)
        elif str(item.requester_user_id) != actor_user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Booking is not yours")

        self._assert_transition(item.status, PrivateBookingStatus.cancelled)
        reason = payload.reason if payload else None
        if item.status == PrivateBookingStatus.paid:
            from app.services.payment_service import PaymentService

            await PaymentService().refund_private_booking(
                session=session,
                booking=item,
                requested_by_user_id=uuid.UUID(actor_user_id),
                reason=reason or "private_booking_cancelled",
            )
        elif item.order_id:
            order = await session.get(Order, item.order_id)
            if order and order.status == OrderStatus.pending:
                order.status = OrderStatus.cancelled
                order.updated_at = datetime.now(UTC)
                session.add(order)

        now = datetime.now(UTC)
        item.status = PrivateBookingStatus.cancelled
        item.cancelled_at = now
        item.cancelled_by_user_id = uuid.UUID(actor_user_id)
        item.cancellation_reason = reason
        item.updated_at = now
        session.add(item)
        await session.commit()
        await session.refresh(item)
        return item

    async def get_analytics(self, session: AsyncSession, cinema_id: uuid.UUID) -> dict[str, Any]:
        base = PrivateBookingRequest.cinema_id == cinema_id
        counts = await session.execute(
            select(
                func.count(PrivateBookingRequest.id),
                func.count(PrivateBookingRequest.id).filter(
                    PrivateBookingRequest.status.in_(list(APPROVED_STATUSES))
                ),
                func.count(PrivateBookingRequest.id).filter(
                    PrivateBookingRequest.status == PrivateBookingStatus.rejected
                ),
                func.avg(PrivateBookingRequest.group_size),
            ).where(base)
        )
        request_count, approved_count, rejected_count, average_group_size = counts.one()
        request_count = int(request_count or 0)
        approved_count = int(approved_count or 0)
        rejected_count = int(rejected_count or 0)

        date_rows = await session.execute(
            select(
                cast(PrivateBookingRequest.preferred_start_at, Date).label("requested_date"),
                func.count(PrivateBookingRequest.id),
            )
            .where(base, PrivateBookingRequest.preferred_start_at.is_not(None))
            .group_by("requested_date")
            .order_by(func.count(PrivateBookingRequest.id).desc())
            .limit(5)
        )
        time_rows = await session.execute(
            select(
                func.date_trunc("hour", PrivateBookingRequest.preferred_start_at).label("requested_hour"),
                func.count(PrivateBookingRequest.id),
            )
            .where(base, PrivateBookingRequest.preferred_start_at.is_not(None))
            .group_by("requested_hour")
            .order_by(func.count(PrivateBookingRequest.id).desc())
            .limit(5)
        )

        return {
            "request_count": request_count,
            "approved_count": approved_count,
            "rejected_count": rejected_count,
            "approval_rate": round(approved_count / request_count, 4) if request_count else 0.0,
            "average_group_size": float(average_group_size) if average_group_size is not None else None,
            "most_requested_dates": [
                {"date": str(requested_date), "request_count": int(count)}
                for requested_date, count in date_rows.all()
            ],
            "most_requested_time_ranges": [
                {"hour": requested_hour.isoformat(), "request_count": int(count)}
                for requested_hour, count in time_rows.all()
            ],
        }

    async def get_request(self, session: AsyncSession, booking_id: str) -> PrivateBookingRequest:
        item = await session.get(PrivateBookingRequest, uuid.UUID(booking_id))
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
        return item

    def assert_admin_ownership(self, item: PrivateBookingRequest, cinema_id: uuid.UUID) -> None:
        if item.cinema_id != cinema_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Booking does not belong to your cinema",
            )

    def assert_requester_ownership(self, item: PrivateBookingRequest, requester_user_id: str) -> None:
        if str(item.requester_user_id) != requester_user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Booking is not yours")

    async def _validate_offer(
        self,
        session: AsyncSession,
        item: PrivateBookingRequest,
        payload: PrivateBookingReview,
    ) -> None:
        if not all(
            [
                payload.offered_location_id,
                payload.offered_hall_id,
                payload.offered_start_at,
                payload.offered_end_at,
            ]
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Offer requires location, hall, start time, and end time",
            )
        if payload.quoted_price_cents is None or payload.quoted_price_cents <= 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Offer requires a positive quoted price",
            )
        if payload.offered_end_at <= payload.offered_start_at:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Offer end time must be after start time",
            )

        hall = await session.get(CinemaHall, payload.offered_hall_id)
        if not hall:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Offered hall not found")
        if hall.location_id != payload.offered_location_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Offered hall must belong to offered location",
            )
        if not hall.allow_private_booking:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Offered hall does not allow private booking",
            )
        if hall.capacity < item.group_size:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Offered hall capacity is below booking group size",
            )

    def _assert_transition(
        self,
        current_status: PrivateBookingStatus | str,
        target_status: PrivateBookingStatus,
    ) -> None:
        current = (
            current_status
            if isinstance(current_status, PrivateBookingStatus)
            else PrivateBookingStatus(current_status)
        )
        if target_status not in ALLOWED_TRANSITIONS[current]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot transition private booking from {current.value} to {target_status.value}",
            )
