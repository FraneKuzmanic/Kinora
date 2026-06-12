import asyncio
import logging

from fastapi import HTTPException, status

from app.core.config import settings
from app.notifications.providers.resend import EmailDeliveryError, ResendEmailProvider
from app.services.supabase_admin import get_supabase_admin_client

logger = logging.getLogger(__name__)


class SignupService:
    """Create Supabase signup links and deliver Kinora confirmation emails."""

    SUCCESS_MESSAGE = "Account created. Check your email to verify your address before signing in."

    async def request_signup(self, email: str, password: str) -> None:
        self._ensure_configured()

        normalized_email = email.strip().lower()
        redirect_to = f"{settings.client_url.rstrip('/')}/login"

        try:
            action_link = await asyncio.to_thread(
                self._generate_signup_link,
                normalized_email,
                password,
                redirect_to,
            )
        except HTTPException:
            raise
        except Exception as exc:
            if self._is_duplicate_signup_error(exc):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "An account with this email already exists. "
                        "Sign in or reset your password."
                    ),
                ) from exc
            logger.exception("Supabase signup link generation failed")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Registration is temporarily unavailable.",
            ) from exc

        try:
            await ResendEmailProvider(
                settings.resend_api_key or "",
                settings.signup_confirmation_email_from,
            ).send_email(
                normalized_email,
                "Confirm your Kinora account",
                self._text_body(action_link),
                html_body=self._html_body(action_link),
            )
        except EmailDeliveryError as exc:
            logger.exception("Signup confirmation email delivery failed")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Could not send the confirmation email right now.",
            ) from exc

    def _ensure_configured(self) -> None:
        missing = [
            name
            for name, value in {
                "SUPABASE_URL": settings.supabase_url,
                "SUPABASE_SERVICE_ROLE_KEY": settings.supabase_service_role_key,
                "RESEND_API_KEY": settings.resend_api_key,
            }.items()
            if not value
        ]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Signup confirmation email is not configured: {', '.join(missing)}",
            )

    def _generate_signup_link(self, email: str, password: str, redirect_to: str) -> str:
        response = get_supabase_admin_client().auth.admin.generate_link(
            {
                "type": "signup",
                "email": email,
                "password": password,
                "options": {
                    "data": {
                        "role": "audience",
                    },
                    "redirect_to": redirect_to,
                },
            }
        )
        return response.properties.action_link

    def _is_duplicate_signup_error(self, exc: Exception) -> bool:
        message = str(exc).lower()
        duplicate_markers = (
            "already registered",
            "already exists",
            "user exists",
            "user_already_exists",
        )
        return any(marker in message for marker in duplicate_markers)

    def _text_body(self, action_link: str) -> str:
        return "\n".join(
            [
                "Confirm your Kinora account",
                "",
                "Welcome to Kinora. Confirm your email address to finish creating your account.",
                f"Open this secure link to confirm your account: {action_link}",
                "",
                "If you did not create a Kinora account, you can ignore this email.",
            ]
        )

    def _html_body(self, action_link: str) -> str:
        return f"""
<div style="background:#131a27;color:#ffffff;font-family:Arial,sans-serif;padding:32px">
  <div style="max-width:520px;margin:0 auto;border:1px solid #dfc56a;padding:28px">
    <p style="color:#dfc56a;font-size:12px;letter-spacing:2px;text-transform:uppercase;
      margin:0 0 16px">
      Kinora
    </p>
    <h1 style="font-size:28px;line-height:1.2;margin:0 0 16px">Confirm your Kinora account</h1>
    <p style="color:#c8ceda;font-size:15px;line-height:1.6;margin:0 0 24px">
      Welcome to Kinora. Confirm your email address to finish creating your account.
    </p>
    <p style="margin:0 0 24px">
      <a href="{action_link}" style="display:inline-block;border:1px solid #dfc56a;
        color:#131a27;background:#dfc56a;padding:14px 20px;text-decoration:none;
        font-weight:700">
        Confirm email
      </a>
    </p>
    <p style="color:#7a8499;font-size:13px;line-height:1.5;margin:0">
      If you did not create a Kinora account, you can ignore this email.
    </p>
  </div>
</div>
""".strip()
