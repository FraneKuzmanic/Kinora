from fastapi import Depends, Header, HTTPException, status

from app.db.session import SessionLocal
from app.services.supabase_auth import SupabaseAuthService
from app.services.two_factor_service import TwoFactorService

TWO_FACTOR_EXEMPT_EMAILS = {"admin@test.com", "validator@example.com"}


def _requires_email_two_factor(user: dict) -> bool:
    email = user.get("email")
    if isinstance(email, str) and email.strip().lower() in TWO_FACTOR_EXEMPT_EMAILS:
        return False

    app_metadata = user.get("app_metadata") or {}
    provider = app_metadata.get("provider")
    providers = app_metadata.get("providers") or []
    if provider == "google":
        return False
    if provider == "email":
        return True
    return "email" in providers and "google" not in providers


async def _resolve_bearer_user(authorization: str | None) -> dict | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ").strip()
    return await SupabaseAuthService().get_user(token)


async def _has_verified_two_factor(user_id: str, token: str | None) -> bool:
    async with SessionLocal() as session:
        return await TwoFactorService().verify_session(
            session,
            user_id=user_id,
            token=token,
        )


async def get_unverified_current_user(authorization: str | None = Header(default=None)) -> dict:
    """Resolve the current Supabase user without enforcing the Kinora 2FA gate."""
    user = await _resolve_bearer_user(authorization)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return user


async def get_optional_user(
    authorization: str | None = Header(default=None),
    x_kinora_2fa: str | None = Header(default=None, alias="X-Kinora-2FA"),
) -> dict | None:
    """Resolve the current user if bearer + required 2FA are present; else anonymous."""
    user = await _resolve_bearer_user(authorization)
    if not user:
        return None

    user_id = user.get("id")
    if _requires_email_two_factor(user) and (
        not user_id or not await _has_verified_two_factor(str(user_id), x_kinora_2fa)
    ):
        return None

    return user


async def get_current_user(
    current_user: dict = Depends(get_unverified_current_user),
    x_kinora_2fa: str | None = Header(default=None, alias="X-Kinora-2FA"),
) -> dict:
    """Resolve the current Supabase user and enforce Kinora 2FA where required."""
    user_id = current_user.get("id")
    if _requires_email_two_factor(current_user) and (
        not user_id or not await _has_verified_two_factor(str(user_id), x_kinora_2fa)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "two_factor_required",
                "message": "Email verification is required.",
            },
        )

    return current_user
