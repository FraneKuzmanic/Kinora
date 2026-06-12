import asyncio
import logging

from fastapi import HTTPException, status

from app.core.config import settings
from app.notifications.providers.resend import ResendEmailProvider
from app.services.supabase_admin import get_supabase_admin_client

logger = logging.getLogger(__name__)


class PasswordResetService:
    """Generate Supabase recovery links and deliver them through Kinora email."""

    GENERIC_MESSAGE = "If an account exists for that email, we sent a reset link."

    async def request_reset(self, email: str) -> None:
        self._ensure_configured()

        normalized_email = email.strip().lower()
        redirect_to = f"{settings.client_url.rstrip('/')}/reset-password"

        try:
            action_link = await asyncio.to_thread(
                self._generate_recovery_link,
                normalized_email,
                redirect_to,
            )
            await ResendEmailProvider(
                settings.resend_api_key or "",
                settings.password_reset_email_from,
            ).send_email(
                normalized_email,
                "Reset your Kinora password",
                self._text_body(action_link),
                html_body=self._html_body(action_link),
            )
        except Exception:
            # Keep the public endpoint enumeration-safe. The request can fail
            # because the user does not exist, the token provider rejects the
            # request, or email delivery is temporarily unavailable.
            logger.exception("Password reset email request could not be completed")

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
                detail=f"Password reset email is not configured: {', '.join(missing)}",
            )

    def _generate_recovery_link(self, email: str, redirect_to: str) -> str:
        response = get_supabase_admin_client().auth.admin.generate_link(
            {
                "type": "recovery",
                "email": email,
                "options": {
                    "redirect_to": redirect_to,
                },
            }
        )
        return response.properties.action_link

    def _text_body(self, action_link: str) -> str:
        return "\n".join(
            [
                "Reset your Kinora password",
                "",
                "We received a request to reset the password for your Kinora account.",
                f"Open this secure link to choose a new password: {action_link}",
                "",
                "If you did not request this, you can ignore this email.",
            ]
        )

    def _html_body(self, action_link: str) -> str:
        return f"""
<div style="background:#131a27;color:#ffffff;font-family:Arial,sans-serif;padding:32px">
  <div style="max-width:520px;margin:0 auto;border:1px solid #dfc56a;padding:28px">
    <p style="color:#dfc56a;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:0 0 16px">
      Kinora password reset
    </p>
    <h1 style="font-size:28px;line-height:1.2;margin:0 0 16px">Reset your password</h1>
    <p style="color:#c8ceda;font-size:15px;line-height:1.6;margin:0 0 24px">
      We received a request to reset the password for your Kinora account.
    </p>
    <p style="margin:0 0 24px">
      <a href="{action_link}" style="display:inline-block;border:1px solid #dfc56a;color:#131a27;background:#dfc56a;padding:14px 20px;text-decoration:none;font-weight:700">
        Reset password
      </a>
    </p>
    <p style="color:#7a8499;font-size:13px;line-height:1.5;margin:0">
      If you did not request this, you can ignore this email.
    </p>
  </div>
</div>
""".strip()
