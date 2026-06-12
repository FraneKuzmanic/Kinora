import hashlib
import hmac
import secrets
from urllib.parse import urlencode

from fastapi import HTTPException, status

from app.core.config import settings


class EmailLinkService:
    """Build and verify signed action links used from notification emails."""

    _ADMISSION_REFUND_PURPOSE = "admission_refund"

    def build_admission_refund_url(self, admission_id: str) -> str:
        token = self._sign(self._ADMISSION_REFUND_PURPOSE, admission_id)
        base_url = settings.api_public_url.rstrip("/")
        api_prefix = settings.api_v1_prefix.strip("/")
        query = urlencode({"token": token})
        return f"{base_url}/{api_prefix}/admissions/{admission_id}/refund-link?{query}"

    def verify_admission_refund_token(self, admission_id: str, token: str) -> None:
        expected = self._sign(self._ADMISSION_REFUND_PURPOSE, admission_id)
        if not secrets.compare_digest(token, expected):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid refund link",
            )

    def _sign(self, purpose: str, subject: str) -> str:
        message = f"{purpose}:{subject}".encode("utf-8")
        return hmac.new(self._secret(), message, hashlib.sha256).hexdigest()

    def _secret(self) -> bytes:
        secret = (
            settings.supabase_jwt_secret
            or settings.stripe_webhook_secret
            or settings.stripe_secret_key
        )
        if secret:
            return secret.encode("utf-8")
        if settings.debug:
            return b"kinora-development-email-link-secret"
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email action links are not configured",
        )
