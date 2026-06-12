import uuid

from fastapi import Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse, Response
from fastapi.routing import APIRouter
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.api.deps.authorization import require_any_role, resolve_role
from app.api.deps.db import get_db
from app.api.html_pages import render_status_page
from app.core.config import settings
from app.models.admission import Admission
from app.schemas.payment import AdmissionRead, RefundRead
from app.services.admission_pdf_service import AdmissionPdfService
from app.services.email_link_service import EmailLinkService
from app.services.payment_service import PaymentService
from app.services.profile_service import ProfileService

router = APIRouter()


async def _require_ticket_user(current_user: dict, session: AsyncSession) -> str:
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user payload")

    profile = await ProfileService().get_by_user_id(session, user_id)
    role = resolve_role(current_user, profile.role if profile else None)
    require_any_role(role, {"audience", "cinema_admin"})
    return user_id


@router.get("/me", response_model=list[AdmissionRead])
async def list_my_admissions(
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[AdmissionRead]:
    """List the authenticated user's tickets/admissions."""
    user_id = await _require_ticket_user(current_user, session)
    rows = await PaymentService().list_user_admissions(session, user_id)
    return [AdmissionRead(**row) for row in rows]


@router.post("/{admission_id}/refund", response_model=RefundRead)
async def request_admission_refund(
    admission_id: str,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> RefundRead:
    """Request a refund for an eligible losing early-bird admission."""
    user_id = await _require_ticket_user(current_user, session)
    refund = await PaymentService().request_user_refund(session, admission_id, user_id)
    return RefundRead(
        id=refund.id,
        admission_id=admission_id,
        status=refund.status.value if hasattr(refund.status, "value") else refund.status,
        amount_cents=refund.amount_cents,
    )


@router.get("/{admission_id}/refund-link", include_in_schema=False, response_class=HTMLResponse)
async def show_email_refund_link(
    admission_id: str,
    token: str = Query(...),
) -> HTMLResponse:
    """Show an email-link confirmation page for a losing early-bird refund request."""
    EmailLinkService().verify_admission_refund_token(admission_id, token)
    api_prefix = settings.api_v1_prefix.rstrip("/")
    return HTMLResponse(
        content=render_status_page(
            title="Request a refund",
            eyebrow="Tickets",
            message=(
                "If this early-bird ticket is eligible because its movie did not win "
                "voting, Kinora will refund it to the original payment method."
            ),
            rows=[("Admission reference", admission_id)],
            form_action=f"{api_prefix}/admissions/{admission_id}/refund-link?token={token}",
            form_button="Request refund",
        )
    )


@router.post("/{admission_id}/refund-link", include_in_schema=False, response_class=HTMLResponse)
async def request_email_refund_link(
    admission_id: str,
    token: str = Query(...),
    session: AsyncSession = Depends(get_db),
) -> HTMLResponse:
    """Process a signed email-link refund request for a losing early-bird admission."""
    EmailLinkService().verify_admission_refund_token(admission_id, token)
    try:
        refund = await PaymentService().request_user_refund_from_email_link(session, admission_id)
    except HTTPException as exc:
        return HTMLResponse(
            content=render_status_page(
                title="Refund not available",
                eyebrow="Tickets",
                message=str(exc.detail),
                rows=[("Admission reference", admission_id)],
            ),
            status_code=exc.status_code,
        )

    return HTMLResponse(
        content=render_status_page(
            title="Refund requested",
            eyebrow="Tickets",
            message="Your refund request was accepted and will be returned to the original payment method.",
            rows=[
                ("Refund reference", refund.id),
                ("Admission reference", admission_id),
                ("Amount", f"{refund.amount_cents} cents"),
            ],
        )
    )


@router.get("/{admission_id}/ticket.pdf", response_class=Response)
async def download_ticket(
    admission_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Response:
    result = await session.execute(select(Admission).where(Admission.id == admission_id))
    admission = result.scalar_one_or_none()

    if admission is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admission not found")

    if str(admission.buyer_user_id) != current_user.get("id"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    pdf = await AdmissionPdfService().get_or_generate(session, admission, settings.pdf_storage_path)
    if pdf.generated:
        await session.commit()

    return Response(
        content=pdf.bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=ticket-{admission_id}.pdf"},
    )


@router.get("/test_admission")
async def get_random_admission(
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    result = await session.execute(select(Admission))
    admissions = result.scalars().all()

    if not admissions:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No admissions found")

    admission = admissions[0]
    return {
        "id": str(admission.id),
        "type": admission.type.value,
        "status": admission.status.value,
        "quantity": admission.quantity,
        "total_price_cents": admission.total_price_cents,
        "created_at": admission.created_at.isoformat(),
    }
