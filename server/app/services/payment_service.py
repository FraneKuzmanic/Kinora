import json
import secrets
import uuid
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlencode

import stripe
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.admission import (
    Admission,
    AdmissionRedemption,
    AdmissionStatus,
    AdmissionType,
    LossDecision,
)
from app.models.campaign import Campaign, CampaignMovie, CampaignStatus
from app.models.cinema import Cinema, CinemaHall, CinemaLocation
from app.models.geography import City
from app.models.movie import Movie
from app.models.payment import (
    Order,
    OrderStatus,
    Payment,
    PaymentStatus,
    Refund,
    RefundLine,
    RefundStatus,
    StripeWebhookEvent,
)
from app.models.private_booking import PrivateBookingRequest, PrivateBookingStatus
from app.models.screening import Screening, ScreeningStatus
from app.services.email_link_service import EmailLinkService
from app.services.loyalty_service import (
    LoyaltyService,
    POINTS_EARLY_BIRD,
    POINTS_SCREENING_TICKET,
)
from app.services.payment_notification_service import PaymentNotificationService


STRIPE_API_VERSION = "2026-02-25.clover"
REFUNDABLE_ADMISSION_STATUSES = {
    AdmissionStatus.pending_outcome,
    AdmissionStatus.active,
    AdmissionStatus.lost_refund_pending,
}


class PaymentService:
    """Stripe Checkout, admission fulfillment, and refund workflows."""

    def __init__(self) -> None:
        stripe.api_version = STRIPE_API_VERSION
        if settings.stripe_secret_key:
            stripe.api_key = settings.stripe_secret_key

    async def create_screening_checkout_session(
        self,
        session: AsyncSession,
        screening_id: str,
        buyer_user_id: str,
        quantity: int,
        coupon_id: str | None = None,
        email_notification: str | None = None,
    ) -> dict[str, Any]:
        screening = await self._get_screening_for_checkout(session, screening_id)
        unit_price = screening.ticket_price_cents
        subtotal = unit_price * quantity
        coupon_metadata = await LoyaltyService().prepare_coupon_discount(
            session=session,
            user_id=buyer_user_id,
            coupon_id=coupon_id,
            subtotal_cents=subtotal,
        )
        description = "Kinora screening ticket"
        order_metadata = {
            "admission_type": AdmissionType.screening_ticket.value,
            "screening_id": str(screening.id),
            "description": description,
            "quantity": str(quantity),
            **coupon_metadata,
        }
        self._add_email_notification(order_metadata, email_notification)
        order = await self._create_order(
            session=session,
            buyer_user_id=buyer_user_id,
            unit_price_cents=unit_price,
            quantity=quantity,
            discount_cents=int(coupon_metadata.get("coupon_discount_cents") or 0),
            metadata=order_metadata,
        )

        return await self._create_checkout_session(
            order=order,
            name=description,
            quantity=quantity,
            unit_price_cents=unit_price,
            discount_cents=int(coupon_metadata.get("coupon_discount_cents") or 0),
            metadata={
                "order_id": str(order.id),
                "buyer_user_id": buyer_user_id,
                "admission_type": AdmissionType.screening_ticket.value,
                "screening_id": str(screening.id),
                "quantity": str(quantity),
                "description": description,
                **coupon_metadata,
                **({"email_notification": email_notification} if email_notification else {}),
            },
        )

    async def create_campaign_checkout_session(
        self,
        session: AsyncSession,
        campaign_id: str,
        campaign_movie_id: str,
        buyer_user_id: str,
        quantity: int,
        coupon_id: str | None = None,
        email_notification: str | None = None,
    ) -> dict[str, Any]:
        campaign, campaign_movie, movie, effective_max_tickets = await self._get_campaign_movie_for_checkout(
            session,
            campaign_id,
            campaign_movie_id,
        )
        sold_count = await self._get_campaign_early_bird_sold_count(session, campaign.id)
        if sold_count + quantity > effective_max_tickets:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Campaign early-bird tickets are sold out",
            )
        unit_price = campaign.ticket_price_cents
        subtotal = unit_price * quantity
        coupon_metadata = await LoyaltyService().prepare_coupon_discount(
            session=session,
            user_id=buyer_user_id,
            coupon_id=coupon_id,
            subtotal_cents=subtotal,
        )
        description = f"Kinora early-bird ticket: {movie.title}"
        order_metadata = {
            "admission_type": AdmissionType.campaign_earlybird.value,
            "campaign_id": str(campaign.id),
            "campaign_movie_id": str(campaign_movie.id),
            "description": description,
            "quantity": str(quantity),
            **coupon_metadata,
        }
        self._add_email_notification(order_metadata, email_notification)
        order = await self._create_order(
            session=session,
            buyer_user_id=buyer_user_id,
            unit_price_cents=unit_price,
            quantity=quantity,
            discount_cents=int(coupon_metadata.get("coupon_discount_cents") or 0),
            metadata=order_metadata,
        )

        return await self._create_checkout_session(
            order=order,
            name=description,
            quantity=quantity,
            unit_price_cents=unit_price,
            discount_cents=int(coupon_metadata.get("coupon_discount_cents") or 0),
            metadata={
                "order_id": str(order.id),
                "buyer_user_id": buyer_user_id,
                "admission_type": AdmissionType.campaign_earlybird.value,
                "campaign_id": str(campaign.id),
                "campaign_movie_id": str(campaign_movie.id),
                "quantity": str(quantity),
                "description": description,
                **coupon_metadata,
                **({"email_notification": email_notification} if email_notification else {}),
            },
        )

    async def create_private_booking_checkout_session(
        self,
        session: AsyncSession,
        booking_id: str,
        buyer_user_id: str,
        email_notification: str | None = None,
    ) -> dict[str, Any]:
        from app.services.private_booking_service import PrivateBookingService

        booking_service = PrivateBookingService()
        booking = await booking_service.get_request(session, booking_id)
        booking_service.assert_requester_ownership(booking, buyer_user_id)
        if booking.status not in {PrivateBookingStatus.offered, PrivateBookingStatus.accepted}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Private booking is not ready for acceptance",
            )
        if not booking.quoted_price_cents or booking.quoted_price_cents <= 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Private booking offer is missing a quoted price",
            )

        now = datetime.now(UTC)
        order_metadata = {
            "order_kind": "private_booking",
            "booking_id": str(booking.id),
            "description": "Kinora private cinema booking",
            "quantity": "1",
        }
        self._add_email_notification(order_metadata, email_notification)
        order: Order | None = None

        if booking.status == PrivateBookingStatus.accepted and booking.order_id:
            order = await session.get(Order, booking.order_id)
            if order and order.status == OrderStatus.paid:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Private booking has already been paid",
                )
            if order and order.status != OrderStatus.pending:
                order = None

        if order is None:
            order = Order(
                id=uuid.uuid4(),
                buyer_user_id=uuid.UUID(buyer_user_id),
                status=OrderStatus.pending,
                currency=booking.currency,
                subtotal_cents=booking.quoted_price_cents,
                fees_cents=0,
                total_cents=booking.quoted_price_cents,
                metadata_json=order_metadata,
                created_at=now,
                updated_at=now,
            )
            session.add(order)

            if booking.status == PrivateBookingStatus.offered:
                await booking_service.mark_accepted(session, booking, order.id)
            else:
                booking.order_id = order.id
                booking.updated_at = now
                session.add(booking)

        await session.flush()

        checkout = await self._create_checkout_session(
            order=order,
            name="Kinora private cinema booking",
            quantity=1,
            unit_price_cents=booking.quoted_price_cents,
            metadata={
                "order_id": str(order.id),
                "buyer_user_id": buyer_user_id,
                "order_kind": "private_booking",
                "booking_id": str(booking.id),
                "quantity": "1",
                "description": "Kinora private cinema booking",
                **({"email_notification": email_notification} if email_notification else {}),
            },
        )
        await session.commit()
        await session.refresh(booking)
        return checkout

    async def handle_checkout_completed(self, session: AsyncSession, checkout_session: Any) -> None:
        payment_intent_id = self._get(checkout_session, "payment_intent")
        metadata = self._resolved_checkout_metadata(
            checkout_session,
            payment_intent_id=str(payment_intent_id) if payment_intent_id else None,
        )
        fallback_order_id = self._get(checkout_session, "client_reference_id")
        order_id = metadata.get("order_id") or (str(fallback_order_id) if fallback_order_id else None)
        order = await self._get_order(session, order_id) if order_id else None
        if order:
            metadata = self._merged_order_metadata(order, metadata)
        self._ensure_metadata_email(metadata, checkout_session)
        order_id = metadata.get("order_id")
        buyer_user_id = metadata.get("buyer_user_id")
        order_kind = metadata.get("order_kind")
        admission_type = metadata.get("admission_type")
        quantity = int(metadata.get("quantity") or 1)

        if order_kind == "private_booking":
            await self._handle_private_booking_checkout_completed(
                session=session,
                checkout_session=checkout_session,
                metadata=metadata,
                payment_intent_id=str(payment_intent_id) if payment_intent_id else None,
            )
            return

        if not order_id or not buyer_user_id or not admission_type or not payment_intent_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Stripe metadata")

        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

        now = datetime.now(UTC)
        payment, payment_created = await self._record_checkout_payment(
            session=session,
            checkout_session=checkout_session,
            order=order,
            payment_intent_id=str(payment_intent_id),
            now=now,
        )

        admission = await self._get_admission_by_order(session, order.id)
        if not admission:
            admission = await self._build_admission_from_metadata(
                session=session,
                order=order,
                buyer_user_id=buyer_user_id,
                admission_type=admission_type,
                quantity=quantity,
                metadata=metadata,
                now=now,
            )
            session.add(admission)

        order.status = OrderStatus.paid
        order.updated_at = now
        session.add(order)
        await self._award_purchase_points(session, admission)
        await LoyaltyService().mark_coupon_redeemed(
            session=session,
            user_id=buyer_user_id,
            coupon_id=metadata.get("coupon_id"),
            order_id=order.id,
        )
        if payment_created:
            await self._notify_payment_succeeded(
                session=session,
                order=order,
                payment=payment,
                buyer_user_id=buyer_user_id,
                metadata=metadata,
                admission=admission,
            )

    async def handle_checkout_success_redirect(
        self,
        session: AsyncSession,
        checkout_session_id: str,
    ) -> dict[str, Any]:
        checkout_session = self._retrieve_checkout_session(checkout_session_id)
        checkout_status = self._get(checkout_session, "status")
        payment_status = self._get(checkout_session, "payment_status")
        if checkout_status != "complete" or payment_status not in {"paid", "no_payment_required"}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Stripe Checkout Session is not paid",
            )

        await self.handle_checkout_completed(session, checkout_session)
        payment_intent_id = self._get(checkout_session, "payment_intent")
        metadata = self._resolved_checkout_metadata(
            checkout_session,
            payment_intent_id=str(payment_intent_id) if payment_intent_id else None,
        )
        fallback_order_id = self._get(checkout_session, "client_reference_id")
        order_id = metadata.get("order_id") or (str(fallback_order_id) if fallback_order_id else None)
        order = await self._get_order(session, order_id) if session is not None and order_id else None
        if order:
            metadata = self._merged_order_metadata(order, metadata)
        return {
            "status": "processed",
            "order_id": metadata.get("order_id"),
            "session_id": checkout_session_id,
            "redirect_url": self._checkout_success_redirect_url(metadata),
        }

    async def _handle_private_booking_checkout_completed(
        self,
        session: AsyncSession,
        checkout_session: Any,
        metadata: dict[str, str],
        payment_intent_id: str | None,
    ) -> None:
        from app.services.private_booking_service import PrivateBookingService

        order_id = metadata.get("order_id")
        buyer_user_id = metadata.get("buyer_user_id")
        booking_id = metadata.get("booking_id")
        if not order_id or not buyer_user_id or not booking_id or not payment_intent_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Stripe metadata")

        order = await self._get_order(session, order_id)
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
        booking = await session.get(PrivateBookingRequest, uuid.UUID(booking_id))
        if not booking:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
        if booking.order_id != order.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Private booking is not linked to this order",
            )
        if str(booking.requester_user_id) != buyer_user_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Private booking buyer metadata does not match requester",
            )

        now = datetime.now(UTC)
        payment, payment_created = await self._record_checkout_payment(
            session=session,
            checkout_session=checkout_session,
            order=order,
            payment_intent_id=payment_intent_id,
            now=now,
        )

        order.status = OrderStatus.paid
        order.updated_at = now
        session.add(order)
        await PrivateBookingService().mark_paid(session, booking)
        if payment_created:
            await self._notify_payment_succeeded(
                session=session,
                order=order,
                payment=payment,
                buyer_user_id=buyer_user_id,
                metadata=metadata,
            )

    async def _record_checkout_payment(
        self,
        session: AsyncSession,
        checkout_session: Any,
        order: Order,
        payment_intent_id: str,
        now: datetime,
    ) -> tuple[Payment, bool]:
        existing_payment = await self._get_payment_by_intent(session, payment_intent_id)
        if existing_payment:
            return existing_payment, False

        payment_intent = self._retrieve_payment_intent(payment_intent_id)
        payment = Payment(
            id=uuid.uuid4(),
            order_id=order.id,
            provider="stripe",
            provider_payment_intent_id=payment_intent_id,
            provider_charge_id=self._get(payment_intent, "latest_charge"),
            status=PaymentStatus.succeeded,
            amount_cents=int(self._get(checkout_session, "amount_total") or order.total_cents),
            currency=str(self._get(checkout_session, "currency") or order.currency).upper(),
            authorized_at=now,
            captured_at=now,
            raw=self._to_dict(checkout_session),
            created_at=now,
        )
        session.add(payment)
        return payment, True

    async def refund_private_booking(
        self,
        session: AsyncSession,
        booking: PrivateBookingRequest,
        requested_by_user_id: uuid.UUID,
        reason: str,
    ) -> Refund:
        if booking.status != PrivateBookingStatus.paid:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Private booking is not paid")
        if not booking.order_id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Private booking payment not found")

        order = await session.get(Order, booking.order_id)
        if not order:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Order not found")
        payment = await self._get_payment_by_order(session, order.id)
        if not payment:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Payment not found")
        if payment.status not in {PaymentStatus.succeeded, PaymentStatus.partially_refunded}:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Payment is not refundable")

        now = datetime.now(UTC)
        refund = Refund(
            id=uuid.uuid4(),
            payment_id=payment.id,
            provider_refund_id=None,
            status=RefundStatus.processing,
            amount_cents=order.total_cents,
            reason=reason,
            requested_by_user_id=requested_by_user_id,
            requested_at=now,
            raw={},
        )
        session.add(refund)
        await session.flush()

        stripe_refund = self._create_stripe_refund(payment, order.total_cents, reason)
        refund.provider_refund_id = self._get(stripe_refund, "id")
        refund.status = RefundStatus.succeeded
        refund.processed_at = datetime.now(UTC)
        refund.raw = self._to_dict(stripe_refund)
        session.add(refund)

        order.status = OrderStatus.refunded
        order.updated_at = refund.processed_at
        payment.status = PaymentStatus.refunded
        session.add(order)
        session.add(payment)
        return refund

    async def list_user_admissions(
        self,
        session: AsyncSession,
        buyer_user_id: str,
    ) -> list[dict[str, Any]]:
        result = await session.execute(
            select(Admission)
            .where(Admission.buyer_user_id == uuid.UUID(buyer_user_id))
            .order_by(Admission.created_at.desc())
        )
        return [
            await self._serialize_admission_for_user(session, admission)
            for admission in result.scalars().all()
        ]

    async def request_user_refund(
        self,
        session: AsyncSession,
        admission_id: str,
        buyer_user_id: str,
    ) -> Refund:
        admission = await self._get_admission(session, admission_id)
        if not admission:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admission not found")
        if str(admission.buyer_user_id) != buyer_user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admission is not yours")
        if not self.is_user_refund_eligible(admission):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Admission is not refundable")

        refund = await self._refund_admission(
            session=session,
            admission=admission,
            reason="requested_by_customer",
            requested_by_user_id=uuid.UUID(buyer_user_id),
        )
        await session.commit()
        await session.refresh(refund)
        return refund

    async def _serialize_admission_for_user(
        self,
        session: AsyncSession,
        admission: Admission,
    ) -> dict[str, Any]:
        screening_context = await self._get_admission_screening_context(session, admission)
        campaign_context = await self._get_admission_campaign_context(session, admission)
        redeemed_at = await self._get_admission_redeemed_at(session, admission.id)

        selected_movie_title = campaign_context["movie_title"] if campaign_context else None
        selected_movie_poster_url = campaign_context["movie_poster_url"] if campaign_context else None
        selected_movie_release_year = campaign_context["movie_release_year"] if campaign_context else None

        resolved_movie_title = screening_context["movie_title"] if screening_context else None
        resolved_movie_poster_url = screening_context["movie_poster_url"] if screening_context else None
        resolved_movie_release_year = screening_context["movie_release_year"] if screening_context else None

        display_title = selected_movie_title or resolved_movie_title or "Untitled admission"
        display_poster = selected_movie_poster_url or resolved_movie_poster_url
        display_release_year = selected_movie_release_year or resolved_movie_release_year

        return {
            "id": admission.id,
            "order_id": admission.order_id,
            "type": admission.type.value if hasattr(admission.type, "value") else admission.type,
            "screening_id": admission.screening_id,
            "campaign_movie_id": admission.campaign_movie_id,
            "campaign_id": (
                campaign_context["campaign_id"]
                if campaign_context
                else screening_context["campaign_id"] if screening_context else None
            ),
            "quantity": admission.quantity,
            "unit_price_cents": admission.unit_price_cents,
            "total_price_cents": admission.total_price_cents,
            "status": admission.status.value if hasattr(admission.status, "value") else admission.status,
            "screening_status": screening_context["screening_status"] if screening_context else None,
            "loss_decision": (
                admission.loss_decision.value
                if hasattr(admission.loss_decision, "value")
                else admission.loss_decision
            ),
            "qr_token": admission.qr_token,
            "created_at": admission.created_at,
            "starts_at": screening_context["starts_at"] if screening_context else None,
            "ends_at": screening_context["ends_at"] if screening_context else None,
            "redeemed_at": redeemed_at,
            "cinema_name": (
                screening_context["cinema_name"]
                if screening_context
                else campaign_context["cinema_name"] if campaign_context else None
            ),
            "hall_name": (
                screening_context["hall_name"]
                if screening_context
                else campaign_context["hall_name"] if campaign_context else None
            ),
            "location_name": (
                screening_context["location_name"]
                if screening_context
                else campaign_context["location_name"] if campaign_context else None
            ),
            "location_address": (
                screening_context["location_address"]
                if screening_context
                else campaign_context["location_address"] if campaign_context else None
            ),
            "city_name": (
                screening_context["city_name"]
                if screening_context
                else campaign_context["city_name"] if campaign_context else None
            ),
            "movie_title": display_title,
            "movie_poster_url": display_poster,
            "movie_release_year": display_release_year,
            "selected_movie_title": selected_movie_title,
            "selected_movie_poster_url": selected_movie_poster_url,
            "selected_movie_release_year": selected_movie_release_year,
            "resolved_movie_title": resolved_movie_title,
            "resolved_movie_poster_url": resolved_movie_poster_url,
            "resolved_movie_release_year": resolved_movie_release_year,
            "campaign_title": campaign_context["campaign_title"] if campaign_context else None,
            "campaign_voting_ends_at": campaign_context["campaign_voting_ends_at"] if campaign_context else None,
            "campaign_slot_starts_at": campaign_context["campaign_slot_starts_at"] if campaign_context else None,
            "campaign_slot_ends_at": campaign_context["campaign_slot_ends_at"] if campaign_context else None,
            "refund_eligible": self.is_user_refund_eligible(admission),
        }

    async def _get_admission_screening_context(
        self,
        session: AsyncSession,
        admission: Admission,
    ) -> dict[str, Any] | None:
        if not admission.screening_id:
            return None

        result = await session.execute(
            select(Screening, Movie, Cinema, CinemaHall, CinemaLocation, City)
            .join(Movie, Movie.id == Screening.movie_id)
            .join(Cinema, Cinema.id == Screening.cinema_id)
            .join(CinemaHall, CinemaHall.id == Screening.hall_id)
            .join(CinemaLocation, CinemaLocation.id == CinemaHall.location_id)
            .join(City, City.id == CinemaLocation.city_id, isouter=True)
            .where(Screening.id == admission.screening_id)
        )
        row = result.first()
        if not row:
            return None

        screening, movie, cinema, hall, location, city = row
        return {
            "campaign_id": screening.campaign_id,
            "screening_status": screening.status.value if hasattr(screening.status, "value") else screening.status,
            "starts_at": screening.starts_at,
            "ends_at": screening.ends_at,
            "cinema_name": cinema.name,
            "hall_name": hall.name,
            "location_name": location.location_name,
            "location_address": location.address_line1,
            "city_name": city.name if city else None,
            "movie_title": movie.title,
            "movie_poster_url": movie.poster_url,
            "movie_release_year": movie.release_year,
        }

    async def _get_admission_campaign_context(
        self,
        session: AsyncSession,
        admission: Admission,
    ) -> dict[str, Any] | None:
        if not admission.campaign_movie_id:
            return None

        result = await session.execute(
            select(CampaignMovie, Campaign, Movie, Cinema, CinemaHall, CinemaLocation, City)
            .join(Campaign, Campaign.id == CampaignMovie.campaign_id)
            .join(Movie, Movie.id == CampaignMovie.movie_id)
            .join(Cinema, Cinema.id == Campaign.cinema_id)
            .join(CinemaHall, CinemaHall.id == Campaign.hall_id)
            .join(CinemaLocation, CinemaLocation.id == CinemaHall.location_id)
            .join(City, City.id == CinemaLocation.city_id, isouter=True)
            .where(CampaignMovie.id == admission.campaign_movie_id)
        )
        row = result.first()
        if not row:
            return None

        _campaign_movie, campaign, movie, cinema, hall, location, city = row
        return {
            "campaign_id": campaign.id,
            "campaign_title": campaign.title,
            "campaign_voting_ends_at": campaign.voting_ends_at,
            "campaign_slot_starts_at": campaign.slot_starts_at,
            "campaign_slot_ends_at": campaign.slot_ends_at,
            "cinema_name": cinema.name,
            "hall_name": hall.name,
            "location_name": location.location_name,
            "location_address": location.address_line1,
            "city_name": city.name if city else None,
            "movie_title": movie.title,
            "movie_poster_url": movie.poster_url,
            "movie_release_year": movie.release_year,
        }

    async def _get_admission_redeemed_at(
        self,
        session: AsyncSession,
        admission_id: uuid.UUID,
    ) -> datetime | None:
        result = await session.execute(
            select(func.max(AdmissionRedemption.redeemed_at)).where(
                AdmissionRedemption.admission_id == admission_id
            )
        )
        value = result.scalar_one_or_none()
        return value

    async def request_user_refund_from_email_link(
        self,
        session: AsyncSession,
        admission_id: str,
    ) -> Refund:
        admission = await self._get_admission(session, admission_id)
        if not admission:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admission not found")
        if not self.is_user_refund_eligible(admission):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Admission is not refundable")

        refund = await self._refund_admission(
            session=session,
            admission=admission,
            reason="requested_by_customer",
            requested_by_user_id=admission.buyer_user_id,
        )
        await session.commit()
        await session.refresh(refund)
        return refund

    async def mark_campaign_outcome(
        self,
        session: AsyncSession,
        campaign: Campaign,
        screening_id: uuid.UUID,
    ) -> None:
        if not campaign.winning_movie_id:
            return

        movies_result = await session.execute(
            select(CampaignMovie).where(CampaignMovie.campaign_id == campaign.id)
        )
        candidate_by_id = {m.id: m for m in movies_result.scalars().all()}
        winning_candidate_ids = {
            candidate.id
            for candidate in candidate_by_id.values()
            if candidate.movie_id == campaign.winning_movie_id
        }

        admissions_result = await session.execute(
            select(Admission).where(
                Admission.type == AdmissionType.campaign_earlybird,
                Admission.campaign_movie_id.in_(list(candidate_by_id.keys())),
                Admission.status == AdmissionStatus.pending_outcome,
            )
        )
        now = datetime.now(UTC)
        for admission in admissions_result.scalars().all():
            admission.screening_id = screening_id
            admission.status = AdmissionStatus.active
            if admission.campaign_movie_id in winning_candidate_ids:
                admission.loss_decision = LossDecision.no_refund
            else:
                admission.loss_decision = LossDecision.refund
            admission.loss_decided_at = now
            session.add(admission)

    async def refund_campaign_admissions(
        self,
        session: AsyncSession,
        campaign_id: uuid.UUID,
        reason: str,
    ) -> list[Refund]:
        movie_rows = await session.execute(
            select(CampaignMovie.id).where(CampaignMovie.campaign_id == campaign_id)
        )
        campaign_movie_ids = list(movie_rows.scalars().all())
        if not campaign_movie_ids:
            return []

        admissions = await session.execute(
            select(Admission).where(
                Admission.type == AdmissionType.campaign_earlybird,
                Admission.campaign_movie_id.in_(campaign_movie_ids),
                Admission.status.in_(REFUNDABLE_ADMISSION_STATUSES),
            )
        )
        return [
            await self._refund_admission(session, admission, reason=reason, requested_by_user_id=None)
            for admission in admissions.scalars().all()
        ]

    async def refund_screening_admissions(
        self,
        session: AsyncSession,
        screening_id: uuid.UUID,
        reason: str,
    ) -> list[Refund]:
        admissions = await session.execute(
            select(Admission).where(
                Admission.type == AdmissionType.screening_ticket,
                Admission.screening_id == screening_id,
                Admission.status.in_(REFUNDABLE_ADMISSION_STATUSES),
            )
        )
        return [
            await self._refund_admission(session, admission, reason=reason, requested_by_user_id=None)
            for admission in admissions.scalars().all()
        ]

    async def record_webhook_event(self, session: AsyncSession, event: Any) -> bool:
        event_id = self._get(event, "id")
        event_type = self._get(event, "type")
        if not event_id or not event_type:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Stripe event")

        existing = await session.get(StripeWebhookEvent, event_id)
        if existing:
            return False

        session.add(
            StripeWebhookEvent(
                id=event_id,
                event_type=event_type,
                processed_at=datetime.now(UTC),
                raw=self._to_dict(event),
            )
        )
        try:
            await session.flush()
        except IntegrityError:
            await session.rollback()
            return False
        return True

    def is_user_refund_eligible(self, admission: Admission) -> bool:
        return (
            admission.type == AdmissionType.campaign_earlybird
            and admission.status in REFUNDABLE_ADMISSION_STATUSES
            and admission.loss_decision == LossDecision.refund
        )

    async def _create_order(
        self,
        session: AsyncSession,
        buyer_user_id: str,
        unit_price_cents: int,
        quantity: int,
        metadata: dict[str, str],
        discount_cents: int = 0,
    ) -> Order:
        now = datetime.now(UTC)
        subtotal = unit_price_cents * quantity
        total = max(subtotal - max(discount_cents, 0), 0)
        order = Order(
            id=uuid.uuid4(),
            buyer_user_id=uuid.UUID(buyer_user_id),
            status=OrderStatus.pending,
            currency="EUR",
            subtotal_cents=subtotal,
            fees_cents=0,
            total_cents=total,
            metadata_json=metadata,
            created_at=now,
            updated_at=now,
        )
        session.add(order)
        await session.commit()
        await session.refresh(order)
        return order

    async def _create_checkout_session(
        self,
        order: Order,
        name: str,
        quantity: int,
        unit_price_cents: int,
        metadata: dict[str, str],
        discount_cents: int = 0,
    ) -> dict[str, Any]:
        if not settings.stripe_secret_key:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Stripe is not configured")

        success_url = self._api_v1_url("/stripe/checkout/success?session_id={CHECKOUT_SESSION_ID}")
        cancel_url = self._api_v1_url(f"/stripe/checkout/cancel?order_id={order.id}")
        customer_email = metadata.get("email_notification") or order.metadata_json.get("email_notification")
        if discount_cents > 0:
            line_items = [
                {
                    "price_data": {
                        "currency": "eur",
                        "product_data": {"name": f"{name} with Kinora voucher"},
                        "unit_amount": order.total_cents,
                    },
                    "quantity": 1,
                }
            ]
        else:
            line_items = [
                {
                    "price_data": {
                        "currency": "eur",
                        "product_data": {"name": name},
                        "unit_amount": unit_price_cents,
                    },
                    "quantity": quantity,
                }
            ]

        checkout_kwargs: dict[str, Any] = {
            "mode": "payment",
            "success_url": success_url,
            "cancel_url": cancel_url,
            "client_reference_id": str(order.id),
            "line_items": line_items,
            "metadata": metadata,
            "payment_intent_data": {"metadata": metadata},
        }
        if customer_email:
            checkout_kwargs["customer_email"] = customer_email
        try:
            checkout_session = stripe.checkout.Session.create(**checkout_kwargs)
        except stripe.error.StripeError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

        checkout_url = self._get(checkout_session, "url")
        session_id = self._get(checkout_session, "id")
        if not checkout_url or not session_id:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Stripe did not return Checkout URL")

        return {
            "order_id": order.id,
            "session_id": session_id,
            "checkout_url": checkout_url,
        }

    def _api_v1_url(self, path: str) -> str:
        base_url = settings.api_public_url.rstrip("/")
        api_prefix = settings.api_v1_prefix.strip("/")
        normalized_path = path if path.startswith("/") else f"/{path}"
        return f"{base_url}/{api_prefix}{normalized_path}"

    async def _get_screening_for_checkout(self, session: AsyncSession, screening_id: str) -> Screening:
        screening = await session.get(Screening, uuid.UUID(screening_id))
        if not screening:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Screening not found")
        if screening.status not in {ScreeningStatus.selling, ScreeningStatus.confirmed}:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Screening is not selling tickets")
        if screening.ticket_price_cents <= 0:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Screening ticket price is missing")
        return screening

    async def _get_campaign_movie_for_checkout(
        self,
        session: AsyncSession,
        campaign_id: str,
        campaign_movie_id: str,
    ) -> tuple[Campaign, CampaignMovie, Movie, int]:
        result = await session.execute(
            select(Campaign, CampaignMovie, Movie, CinemaHall.capacity)
            .join(CampaignMovie, CampaignMovie.campaign_id == Campaign.id)
            .join(Movie, Movie.id == CampaignMovie.movie_id)
            .join(CinemaHall, CinemaHall.id == Campaign.hall_id)
            .where(Campaign.id == uuid.UUID(campaign_id), CampaignMovie.id == uuid.UUID(campaign_movie_id))
        )
        row = result.first()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign movie not found")
        campaign, campaign_movie, movie, hall_capacity = row
        if campaign.status != CampaignStatus.voting:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Campaign is not open for tickets")
        now = datetime.now(UTC)
        if not (campaign.voting_starts_at <= now <= campaign.voting_ends_at):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Campaign voting window is not active")
        if campaign.ticket_price_cents <= 0:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Campaign ticket price is missing")
        effective_max_tickets = campaign.max_tickets if campaign.max_tickets is not None else int(hall_capacity)
        return campaign, campaign_movie, movie, effective_max_tickets

    async def _get_campaign_early_bird_sold_count(
        self,
        session: AsyncSession,
        campaign_id: uuid.UUID,
    ) -> int:
        campaign_movie_rows = await session.execute(
            select(CampaignMovie.id).where(CampaignMovie.campaign_id == campaign_id)
        )
        campaign_movie_ids = list(campaign_movie_rows.scalars().all())
        if not campaign_movie_ids:
            return 0

        sold_result = await session.execute(
            select(func.coalesce(func.sum(Admission.quantity), 0))
            .where(
                Admission.campaign_movie_id.in_(campaign_movie_ids),
                Admission.type == AdmissionType.campaign_earlybird,
                Admission.status.in_(REFUNDABLE_ADMISSION_STATUSES | {AdmissionStatus.used}),
            )
        )
        return int(sold_result.scalar() or 0)

    async def _build_admission_from_metadata(
        self,
        session: AsyncSession,
        order: Order,
        buyer_user_id: str,
        admission_type: str,
        quantity: int,
        metadata: dict[str, str],
        now: datetime,
    ) -> Admission:
        if admission_type == AdmissionType.screening_ticket.value:
            screening_id = metadata.get("screening_id")
            if not screening_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing screening metadata")
            screening = await session.get(Screening, uuid.UUID(screening_id))
            admission_status = (
                AdmissionStatus.active
                if screening and screening.status == ScreeningStatus.confirmed
                else AdmissionStatus.pending_outcome
            )
            return Admission(
                id=uuid.uuid4(),
                order_id=order.id,
                buyer_user_id=uuid.UUID(buyer_user_id),
                type=AdmissionType.screening_ticket,
                screening_id=uuid.UUID(screening_id),
                campaign_movie_id=None,
                quantity=quantity,
                unit_price_cents=order.subtotal_cents // quantity,
                total_price_cents=order.total_cents,
                status=admission_status,
                loss_decision=LossDecision.pending,
                qr_token=secrets.token_urlsafe(32),
                qr_generated_at=now,
                created_at=now,
            )

        if admission_type == AdmissionType.campaign_earlybird.value:
            campaign_movie_id = metadata.get("campaign_movie_id")
            if not campaign_movie_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing campaign movie metadata")
            return Admission(
                id=uuid.uuid4(),
                order_id=order.id,
                buyer_user_id=uuid.UUID(buyer_user_id),
                type=AdmissionType.campaign_earlybird,
                screening_id=None,
                campaign_movie_id=uuid.UUID(campaign_movie_id),
                quantity=quantity,
                unit_price_cents=order.subtotal_cents // quantity,
                total_price_cents=order.total_cents,
                status=AdmissionStatus.pending_outcome,
                loss_decision=LossDecision.pending,
                qr_token=secrets.token_urlsafe(32),
                qr_generated_at=now,
                created_at=now,
            )

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported admission type")

    async def _award_purchase_points(self, session: AsyncSession, admission: Admission) -> None:
        cinema_id = await self._get_admission_cinema_id_for_loyalty(session, admission)
        if admission.type == AdmissionType.campaign_earlybird:
            points = POINTS_EARLY_BIRD
            reason = "Early-bird ticket purchase"
            source_type = "earlybird_purchase"
        else:
            points = POINTS_SCREENING_TICKET
            reason = "Screening ticket purchase"
            source_type = "screening_ticket_purchase"

        await LoyaltyService().award_points(
            session,
            user_id=admission.buyer_user_id,
            points=points,
            reason=reason,
            source_type=source_type,
            source_id=admission.id,
            cinema_id=cinema_id,
            created_at=admission.created_at,
        )
        await LoyaltyService().evaluate_badges(session, admission.buyer_user_id)

    async def _get_admission_cinema_id_for_loyalty(
        self,
        session: AsyncSession,
        admission: Admission,
    ) -> uuid.UUID | None:
        if admission.screening_id:
            result = await session.execute(
                select(Screening.cinema_id).where(Screening.id == admission.screening_id)
            )
            return result.scalar_one_or_none()

        if admission.campaign_movie_id:
            result = await session.execute(
                select(Campaign.cinema_id)
                .join(CampaignMovie, CampaignMovie.campaign_id == Campaign.id)
                .where(CampaignMovie.id == admission.campaign_movie_id)
            )
            return result.scalar_one_or_none()

        return None

    async def _refund_admission(
        self,
        session: AsyncSession,
        admission: Admission,
        reason: str,
        requested_by_user_id: uuid.UUID | None,
    ) -> Refund:
        if admission.status not in REFUNDABLE_ADMISSION_STATUSES:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Admission is not refundable")

        payment = await self._get_payment_by_order(session, admission.order_id)
        if not payment:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Payment not found")
        if payment.status not in {PaymentStatus.succeeded, PaymentStatus.partially_refunded}:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Payment is not refundable")

        now = datetime.now(UTC)
        refund = Refund(
            id=uuid.uuid4(),
            payment_id=payment.id,
            provider_refund_id=None,
            status=RefundStatus.processing,
            amount_cents=admission.total_price_cents,
            reason=reason,
            requested_by_user_id=requested_by_user_id,
            requested_at=now,
            raw={},
        )
        session.add(refund)
        await session.flush()

        stripe_refund = self._create_stripe_refund(payment, admission.total_price_cents, reason)
        refund.provider_refund_id = self._get(stripe_refund, "id")
        refund.status = RefundStatus.succeeded
        refund.processed_at = datetime.now(UTC)
        refund.raw = self._to_dict(stripe_refund)
        session.add(refund)

        session.add(
            RefundLine(
                refund_id=refund.id,
                admission_id=admission.id,
                amount_cents=admission.total_price_cents,
            )
        )

        admission.status = AdmissionStatus.refunded
        admission.loss_decision = LossDecision.refund
        admission.loss_decided_at = refund.processed_at
        session.add(admission)

        await self._update_order_refund_state(session, admission.order_id, payment)
        return refund

    def _create_stripe_refund(self, payment: Payment, amount_cents: int, reason: str) -> Any:
        if not settings.stripe_secret_key:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Stripe is not configured")
        try:
            return stripe.Refund.create(
                payment_intent=payment.provider_payment_intent_id,
                amount=amount_cents,
                reason="requested_by_customer" if reason == "requested_by_customer" else None,
                metadata={"reason": reason, "payment_id": str(payment.id)},
            )
        except stripe.error.StripeError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    async def _update_order_refund_state(
        self,
        session: AsyncSession,
        order_id: uuid.UUID,
        payment: Payment,
    ) -> None:
        remaining = await session.execute(
            select(func.count(Admission.id)).where(
                Admission.order_id == order_id,
                Admission.status != AdmissionStatus.refunded,
            )
        )
        order = await session.get(Order, order_id)
        if not order:
            return
        if (remaining.scalar() or 0) == 0:
            order.status = OrderStatus.refunded
            payment.status = PaymentStatus.refunded
        else:
            payment.status = PaymentStatus.partially_refunded
        order.updated_at = datetime.now(UTC)
        session.add(order)
        session.add(payment)

    async def _notify_payment_succeeded(
        self,
        session: AsyncSession,
        *,
        order: Order,
        payment: Payment,
        buyer_user_id: str,
        metadata: dict[str, str],
        admission: Admission | None = None,
    ) -> None:
        ticket_admission_id = self._ticket_admission_id(admission)
        refund_admission_id = self._refund_link_admission_id(admission)
        refund_url = (
            EmailLinkService().build_admission_refund_url(refund_admission_id)
            if refund_admission_id
            else None
        )
        await PaymentNotificationService().handle_payment_succeeded(
            session,
            audience_user_id=buyer_user_id,
            order_id=str(order.id),
            payment_id=str(payment.id),
            admission_id=ticket_admission_id,
            amount_cents=payment.amount_cents,
            currency=payment.currency,
            email_notification=metadata.get("email_notification") or order.metadata_json.get("email_notification"),
            description=metadata.get("description"),
            quantity=self._metadata_int(metadata, "quantity"),
            refund_url=refund_url,
        )

    def _ticket_admission_id(self, admission: Admission | None) -> str | None:
        if admission and getattr(admission, "type", None) in {
            AdmissionType.screening_ticket,
            AdmissionType.campaign_earlybird,
        }:
            return str(admission.id)
        return None

    def _refund_link_admission_id(self, admission: Admission | None) -> str | None:
        if admission and getattr(admission, "type", None) == AdmissionType.campaign_earlybird:
            return str(admission.id)
        return None

    def _add_email_notification(self, metadata: dict[str, str], email_notification: str | None) -> None:
        if email_notification:
            metadata["email_notification"] = email_notification

    def _ensure_metadata_email(self, metadata: dict[str, str], checkout_session: Any) -> None:
        if metadata.get("email_notification"):
            return
        customer_details = self._get(checkout_session, "customer_details")
        customer_email = self._get(customer_details, "email")
        if customer_email:
            metadata["email_notification"] = str(customer_email)

    def _metadata_int(self, metadata: dict[str, str], key: str) -> int | None:
        value = metadata.get(key)
        if value is None:
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    def _metadata_dict(self, checkout_session: Any) -> dict[str, str]:
        raw_metadata = self._get(checkout_session, "metadata")
        normalized = self._to_dict(raw_metadata)
        return {
            str(key): str(value)
            for key, value in normalized.items()
            if value is not None
        }

    def _resolved_checkout_metadata(
        self,
        checkout_session: Any,
        *,
        payment_intent_id: str | None,
    ) -> dict[str, str]:
        metadata = self._metadata_dict(checkout_session)
        required_keys = {"order_id", "buyer_user_id", "admission_type"}
        if required_keys.issubset(metadata.keys()):
            return metadata

        if not payment_intent_id:
            return metadata

        payment_intent = self._retrieve_payment_intent(payment_intent_id)
        payment_intent_metadata = self._to_dict(self._get(payment_intent, "metadata"))
        for key, value in payment_intent_metadata.items():
            if value is not None and key not in metadata:
                metadata[str(key)] = str(value)
        return metadata

    def _merged_order_metadata(
        self,
        order: Order,
        metadata: dict[str, str],
    ) -> dict[str, str]:
        merged: dict[str, str] = {
            str(key): str(value)
            for key, value in (order.metadata_json or {}).items()
            if value is not None
        }
        merged.update(metadata)
        merged.setdefault("order_id", str(order.id))
        merged.setdefault("buyer_user_id", str(order.buyer_user_id))
        return merged

    def _checkout_success_redirect_url(self, metadata: dict[str, str]) -> str:
        base = settings.client_url.rstrip("/")
        order_kind = metadata.get("order_kind")
        admission_type = metadata.get("admission_type")

        if order_kind == "private_booking" and metadata.get("booking_id"):
            query = urlencode(
                {
                    "purchase": "private-booking-success",
                    "booking_id": metadata["booking_id"],
                    "order_id": metadata.get("order_id") or "",
                }
            )
            return f"{base}/private-booking?{query}"

        if (
            admission_type == AdmissionType.campaign_earlybird.value
            and metadata.get("campaign_id")
        ):
            query = urlencode(
                {
                    "purchase": "early-bird-success",
                    "quantity": metadata.get("quantity") or "1",
                    "order_id": metadata.get("order_id") or "",
                }
            )
            return f"{base}/campaigns/{metadata['campaign_id']}?{query}"

        if (
            admission_type == AdmissionType.screening_ticket.value
            and metadata.get("screening_id")
        ):
            query = urlencode(
                {
                    "purchase": "screening-success",
                    "quantity": metadata.get("quantity") or "1",
                    "order_id": metadata.get("order_id") or "",
                    "screening_id": metadata["screening_id"],
                }
            )
            return f"{base}/screenings/{metadata['screening_id']}?{query}"

        return base

    async def _get_order(self, session: AsyncSession, order_id: str) -> Order | None:
        return await session.get(Order, uuid.UUID(order_id))

    async def _get_admission(self, session: AsyncSession, admission_id: str) -> Admission | None:
        return await session.get(Admission, uuid.UUID(admission_id))

    async def _get_admission_by_order(self, session: AsyncSession, order_id: uuid.UUID) -> Admission | None:
        result = await session.execute(select(Admission).where(Admission.order_id == order_id))
        return result.scalar_one_or_none()

    async def _get_payment_by_order(self, session: AsyncSession, order_id: uuid.UUID) -> Payment | None:
        result = await session.execute(select(Payment).where(Payment.order_id == order_id))
        return result.scalar_one_or_none()

    async def _get_payment_by_intent(
        self,
        session: AsyncSession,
        payment_intent_id: str,
    ) -> Payment | None:
        result = await session.execute(
            select(Payment).where(
                Payment.provider == "stripe",
                Payment.provider_payment_intent_id == payment_intent_id,
            )
        )
        return result.scalar_one_or_none()

    def _retrieve_payment_intent(self, payment_intent_id: str) -> Any | None:
        if not settings.stripe_secret_key:
            return None
        try:
            return stripe.PaymentIntent.retrieve(payment_intent_id)
        except stripe.error.StripeError:
            return None

    def _retrieve_checkout_session(self, checkout_session_id: str) -> Any:
        if not settings.stripe_secret_key:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Stripe is not configured")
        try:
            return stripe.checkout.Session.retrieve(checkout_session_id)
        except stripe.error.StripeError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    def _get(self, obj: Any, key: str) -> Any:
        if obj is None:
            return None
        if isinstance(obj, dict):
            return obj.get(key)
        return getattr(obj, key, None)

    def _to_dict(self, obj: Any) -> dict[str, Any]:
        if obj is None:
            return {}
        if isinstance(obj, dict):
            return obj
        if hasattr(obj, "to_dict_recursive"):
            return obj.to_dict_recursive()
        if hasattr(obj, "to_json"):
            return json.loads(obj.to_json())
        return {"value": str(obj)}
