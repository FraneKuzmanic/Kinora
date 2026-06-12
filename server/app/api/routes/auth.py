from time import monotonic

from fastapi import Depends, Request
from fastapi.routing import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.db import get_db
from app.api.deps.auth import get_current_user, get_unverified_current_user
from app.schemas.auth import MeResponse, PasswordResetRequest, PasswordResetRequestResponse
from app.schemas.auth import (
    SignupRequest,
    SignupResponse,
    TwoFactorEmailOtpRequestResponse,
    TwoFactorEmailOtpVerifyRequest,
    TwoFactorEmailOtpVerifyResponse,
)
from app.services.password_reset_service import PasswordResetService
from app.services.profile_service import ProfileService
from app.services.signup_service import SignupService
from app.services.two_factor_service import TwoFactorService

router = APIRouter()

_RESET_REQUEST_WINDOW_SECONDS = 60.0
_RESET_EMAIL_ATTEMPTS: dict[str, float] = {}
_RESET_IP_ATTEMPTS: dict[str, list[float]] = {}


def _should_send_password_reset(email: str, request: Request) -> bool:
    now = monotonic()
    email_key = email.strip().lower()
    ip_key = request.client.host if request.client else "unknown"

    last_email_attempt = _RESET_EMAIL_ATTEMPTS.get(email_key)
    if last_email_attempt and now - last_email_attempt < _RESET_REQUEST_WINDOW_SECONDS:
        return False

    recent_ip_attempts = [
        attempted_at
        for attempted_at in _RESET_IP_ATTEMPTS.get(ip_key, [])
        if now - attempted_at < _RESET_REQUEST_WINDOW_SECONDS
    ]
    if len(recent_ip_attempts) >= 5:
        _RESET_IP_ATTEMPTS[ip_key] = recent_ip_attempts
        return False

    _RESET_EMAIL_ATTEMPTS[email_key] = now
    _RESET_IP_ATTEMPTS[ip_key] = [*recent_ip_attempts, now]
    return True


@router.post("/password-reset", status_code=202)
async def request_password_reset(
    payload: PasswordResetRequest,
    request: Request,
) -> PasswordResetRequestResponse:
    if _should_send_password_reset(payload.email, request):
        await PasswordResetService().request_reset(payload.email)
    return PasswordResetRequestResponse(message=PasswordResetService.GENERIC_MESSAGE)


@router.post("/signup", status_code=202)
async def request_signup(payload: SignupRequest) -> SignupResponse:
    await SignupService().request_signup(payload.email, payload.password)
    return SignupResponse(message=SignupService.SUCCESS_MESSAGE)


@router.post("/2fa/email/request", status_code=202)
async def request_email_two_factor_code(
    current_user: dict = Depends(get_unverified_current_user),
    session: AsyncSession = Depends(get_db),
) -> TwoFactorEmailOtpRequestResponse:
    result = await TwoFactorService().request_email_otp(
        session,
        user_id=str(current_user.get("id")),
        email=current_user.get("email"),
    )
    return TwoFactorEmailOtpRequestResponse(
        message=result.message,
        expires_at=result.expires_at.isoformat(),
        resend_available_at=result.resend_available_at.isoformat(),
    )


@router.post("/2fa/email/verify")
async def verify_email_two_factor_code(
    payload: TwoFactorEmailOtpVerifyRequest,
    current_user: dict = Depends(get_unverified_current_user),
    session: AsyncSession = Depends(get_db),
) -> TwoFactorEmailOtpVerifyResponse:
    result = await TwoFactorService().verify_email_otp(
        session,
        user_id=str(current_user.get("id")),
        code=payload.code,
    )
    return TwoFactorEmailOtpVerifyResponse(
        two_factor_token=result.two_factor_token,
        expires_at=result.expires_at.isoformat(),
    )


@router.get("/me")
async def get_me(
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> MeResponse:
    """Return authenticated user payload enriched with app profile data."""
    app_metadata = current_user.get("app_metadata") or {}
    user_metadata = current_user.get("user_metadata") or {}
    user_id = current_user.get("id")
    profile_service = ProfileService()

    profile = None
    if user_id:
        profile_record = await profile_service.ensure_profile_for_user(
            session,
            user_id=user_id,
            app_metadata=app_metadata,
            user_metadata=user_metadata,
        )
        profile_role = profile_service.role_value(profile_record.role)
        profile = {
            "user_id": str(profile_record.user_id),
            "role": profile_role,
            "display_name": profile_record.display_name,
        }

    role = (
        (profile["role"] if profile else None)
        or profile_service.resolve_metadata_role(app_metadata, user_metadata)
    )

    return MeResponse(
        id=user_id,
        email=current_user.get("email"),
        role=role,
        app_metadata=app_metadata,
        user_metadata=user_metadata,
        profile=profile,
    )

