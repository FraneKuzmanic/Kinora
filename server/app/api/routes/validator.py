from fastapi import Depends, HTTPException, status
from fastapi.routing import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.api.deps.authorization import require_any_role, resolve_role
from app.api.deps.db import get_db
from app.schemas.validator import (
    RedemptionRequest,
    RedemptionResponse,
    TicketValidationRequest,
    TicketValidationResponse,
)
from app.services.profile_service import ProfileService
from app.services.validator_service import ValidatorService

router = APIRouter()


async def _require_validator(current_user: dict, session: AsyncSession) -> str:
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user payload")

    profile = await ProfileService().get_by_user_id(session, user_id)
    role = resolve_role(current_user, profile.role if profile else None)
    require_any_role(role, {"validator"})
    return user_id


@router.post("/admissions/{qr_token}/validate", response_model=TicketValidationResponse)
async def validate_admission(
    qr_token: str,
    payload: TicketValidationRequest | None = None,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> TicketValidationResponse:
    """Validate a scanned ticket QR token without redeeming it."""
    user_id = await _require_validator(current_user, session)
    return await ValidatorService().validate_admission(
        session=session,
        qr_token=qr_token,
        validator_user_id=user_id,
        payload=payload or TicketValidationRequest(),
    )


@router.post("/admissions/{qr_token}/redeem", response_model=RedemptionResponse)
async def redeem_admission(
    qr_token: str,
    payload: RedemptionRequest,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> RedemptionResponse:
    """Redeem a ticket by QR token for validator users."""
    user_id = await _require_validator(current_user, session)

    row = await ValidatorService().redeem_admission(
        session=session,
        qr_token=qr_token,
        validator_user_id=user_id,
        payload=payload,
    )

    return RedemptionResponse(
        redemption_id=row.id,
        admission_id=row.admission_id,
        redeemed_at=row.redeemed_at,
        status="redeemed",
    )

