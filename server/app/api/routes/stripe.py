import stripe
from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.routing import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.db import get_db
from app.api.html_pages import render_status_page
from app.core.config import settings
from app.services.payment_service import PaymentService

router = APIRouter()


@router.get("/checkout/success")
async def stripe_checkout_success(
    session_id: str,
    session: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    """Finalize a successful Stripe Checkout redirect and queue receipt email."""
    result = await PaymentService().handle_checkout_success_redirect(session, session_id)
    await session.commit()
    return RedirectResponse(url=result.get("redirect_url") or settings.client_url, status_code=status.HTTP_303_SEE_OTHER)


@router.get("/checkout/cancel", response_class=HTMLResponse)
async def stripe_checkout_cancel(order_id: str | None = None) -> HTMLResponse:
    """Show a backend-hosted Checkout cancellation page for local testing."""
    body = render_status_page(
        title="Payment cancelled",
        eyebrow="Checkout",
        message="No payment was completed. You can close this page and start checkout again.",
        rows=[("Order reference", order_id)],
    )
    return HTMLResponse(content=body)


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
    session: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Receive and verify Stripe webhook events."""
    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Stripe webhook is not configured")
    if not stripe_signature:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing Stripe signature")

    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=stripe_signature,
            secret=settings.stripe_webhook_secret,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Stripe payload") from exc
    except stripe.error.SignatureVerificationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Stripe signature") from exc

    svc = PaymentService()
    should_process = await svc.record_webhook_event(session, event)
    if not should_process:
        return {"status": "duplicate"}

    if event["type"] == "checkout.session.completed":
        await svc.handle_checkout_completed(session, event["data"]["object"])

    await session.commit()
    return {"status": "ok"}
