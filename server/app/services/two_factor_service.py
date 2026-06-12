import hmac
import logging
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.two_factor import TwoFactorEmailChallenge, TwoFactorSession
from app.notifications.providers.resend import ResendEmailProvider

logger = logging.getLogger(__name__)

OTP_EXPIRES_IN = timedelta(minutes=10)
OTP_RESEND_COOLDOWN = timedelta(seconds=60)
TWO_FACTOR_SESSION_EXPIRES_IN = timedelta(days=30)
OTP_MAX_ATTEMPTS = 5
TWO_FACTOR_EMAIL_FROM = "Kinora <noreply@kinora.live>"


@dataclass(frozen=True)
class EmailOtpRequestResult:
    message: str
    expires_at: datetime
    resend_available_at: datetime
    dev_code: str | None = None


@dataclass(frozen=True)
class EmailOtpVerifyResult:
    two_factor_token: str
    expires_at: datetime


class TwoFactorService:
    """Email OTP challenge and Kinora 2FA session management."""

    GENERIC_REQUEST_MESSAGE = "If the session is valid, we sent a verification code."

    async def request_email_otp(
        self,
        session: AsyncSession,
        *,
        user_id: str,
        email: str | None,
    ) -> EmailOtpRequestResult:
        self._ensure_configured()
        user_uuid = self._parse_user_id(user_id)
        normalized_email = self._normalize_email(email)
        now = self._now()

        existing = await self._latest_active_challenge(session, user_uuid)
        if existing and existing.next_resend_at > now:
            return EmailOtpRequestResult(
                message=self.GENERIC_REQUEST_MESSAGE,
                expires_at=existing.expires_at,
                resend_available_at=existing.next_resend_at,
            )

        await session.execute(
            update(TwoFactorEmailChallenge)
            .where(
                TwoFactorEmailChallenge.user_id == user_uuid,
                TwoFactorEmailChallenge.consumed_at.is_(None),
            )
            .values(consumed_at=now)
        )

        code = f"{secrets.randbelow(1_000_000):06d}"
        challenge = TwoFactorEmailChallenge(
            id=uuid4(),
            user_id=user_uuid,
            email=normalized_email,
            code_hash=self._hash_code(user_uuid, code),
            expires_at=now + OTP_EXPIRES_IN,
            next_resend_at=now + OTP_RESEND_COOLDOWN,
            attempt_count=0,
            max_attempts=OTP_MAX_ATTEMPTS,
        )
        session.add(challenge)
        await session.commit()

        try:
            await ResendEmailProvider(
                settings.resend_api_key or "",
                TWO_FACTOR_EMAIL_FROM,
            ).send_email(
                normalized_email,
                "Your Kinora verification code",
                self._text_body(code),
                html_body=self._html_body(code),
            )
        except Exception as exc:
            logger.exception("Email OTP delivery failed")
            challenge.consumed_at = self._now()
            await session.commit()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "code": "otp_delivery_failed",
                    "message": "Could not send a verification code right now.",
                },
            ) from exc

        return EmailOtpRequestResult(
            message=self.GENERIC_REQUEST_MESSAGE,
            expires_at=challenge.expires_at,
            resend_available_at=challenge.next_resend_at,
            code = code
        )

    async def verify_email_otp(
        self,
        session: AsyncSession,
        *,
        user_id: str,
        code: str,
    ) -> EmailOtpVerifyResult:
        user_uuid = self._parse_user_id(user_id)
        normalized_code = code.strip()
        now = self._now()
        challenge = await self._latest_active_challenge(session, user_uuid)

        if not challenge:
            raise self._otp_error("invalid_otp", "The verification code is invalid.")

        if challenge.expires_at <= now:
            challenge.consumed_at = now
            await session.commit()
            raise self._otp_error("expired_otp", "The verification code has expired.")

        if challenge.attempt_count >= challenge.max_attempts:
            challenge.consumed_at = now
            await session.commit()
            raise self._otp_error("too_many_otp_attempts", "Too many invalid attempts.")

        expected_hash = self._hash_code(user_uuid, normalized_code)
        if not hmac.compare_digest(expected_hash, challenge.code_hash):
            challenge.attempt_count += 1
            if challenge.attempt_count >= challenge.max_attempts:
                challenge.consumed_at = now
            await session.commit()
            raise self._otp_error("invalid_otp", "The verification code is invalid.")

        token = secrets.token_urlsafe(32)
        two_factor_session = TwoFactorSession(
            id=uuid4(),
            user_id=user_uuid,
            token_hash=self._hash_token(token),
            expires_at=now + TWO_FACTOR_SESSION_EXPIRES_IN,
            last_used_at=now,
        )
        challenge.consumed_at = now
        session.add(two_factor_session)
        await session.commit()

        return EmailOtpVerifyResult(
            two_factor_token=token,
            expires_at=two_factor_session.expires_at,
        )

    async def verify_session(
        self,
        session: AsyncSession,
        *,
        user_id: str,
        token: str | None,
    ) -> bool:
        if not token:
            return False

        user_uuid = self._parse_user_id(user_id)
        now = self._now()
        result = await session.execute(
            select(TwoFactorSession).where(
                TwoFactorSession.user_id == user_uuid,
                TwoFactorSession.token_hash == self._hash_token(token),
                TwoFactorSession.revoked_at.is_(None),
                TwoFactorSession.expires_at > now,
            )
        )
        two_factor_session = result.scalar_one_or_none()
        if not two_factor_session:
            return False

        two_factor_session.last_used_at = now
        await session.commit()
        return True

    async def _latest_active_challenge(
        self,
        session: AsyncSession,
        user_id: UUID,
    ) -> TwoFactorEmailChallenge | None:
        result = await session.execute(
            select(TwoFactorEmailChallenge)
            .where(
                TwoFactorEmailChallenge.user_id == user_id,
                TwoFactorEmailChallenge.consumed_at.is_(None),
            )
            .order_by(TwoFactorEmailChallenge.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    def _ensure_configured(self) -> None:
        if not settings.resend_api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "code": "otp_email_not_configured",
                    "message": "Email verification is not configured.",
                },
            )

    def _hash_code(self, user_id: UUID, code: str) -> str:
        return hmac.new(
            self._secret_key(),
            f"{user_id}:{code}".encode("utf-8"),
            sha256,
        ).hexdigest()

    def _hash_token(self, token: str) -> str:
        return sha256(token.encode("utf-8")).hexdigest()

    def _secret_key(self) -> bytes:
        secret = settings.supabase_jwt_secret or settings.supabase_service_role_key
        if not secret and settings.app_env.strip().lower() not in {"production", "prod"}:
            secret = "kinora-development-email-otp-secret"
        if not secret:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "code": "otp_secret_not_configured",
                    "message": "Email verification is not configured.",
                },
            )
        return secret.encode("utf-8")

    def _parse_user_id(self, user_id: str) -> UUID:
        try:
            return UUID(str(user_id))
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "invalid_user", "message": "Invalid authenticated user."},
            ) from exc

    def _normalize_email(self, email: str | None) -> str:
        normalized = (email or "").strip().lower()
        if "@" not in normalized:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "missing_email",
                    "message": "The authenticated account does not have an email address.",
                },
            )
        return normalized

    def _otp_error(self, code: str, message: str) -> HTTPException:
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": code, "message": message},
        )

    def _now(self) -> datetime:
        return datetime.now(UTC)

    def _text_body(self, code: str) -> str:
        return "\n".join(
            [
                "Your Kinora verification code",
                "",
                f"Enter this code to finish signing in: {code}",
                "",
                "This code expires in 10 minutes. If you did not try to sign in, "
                "you can ignore this email.",
            ]
        )

    def _html_body(self, code: str) -> str:
        escaped_digits = "".join(code)
        return f"""
<div style="background:#131a27;color:#ffffff;font-family:Arial,sans-serif;padding:32px">
  <div style="max-width:520px;margin:0 auto;border:1px solid #dfc56a;padding:28px">
    <p style="color:#dfc56a;font-size:12px;letter-spacing:2px;text-transform:uppercase;
      margin:0 0 16px">
      Kinora verification
    </p>
    <h1 style="font-size:28px;line-height:1.2;margin:0 0 16px">Finish signing in</h1>
    <p style="color:#c8ceda;font-size:15px;line-height:1.6;margin:0 0 24px">
      Enter this code to finish signing in to Kinora.
    </p>
    <p style="color:#dfc56a;font-size:34px;letter-spacing:10px;font-weight:700;margin:0 0 24px">
      {escaped_digits}
    </p>
    <p style="color:#7a8499;font-size:13px;line-height:1.5;margin:0">
      This code expires in 10 minutes. If you did not try to sign in, you can ignore this email.
    </p>
  </div>
</div>
""".strip()
