from dataclasses import dataclass

import httpx

from app.notifications.attachments import EmailAttachment
from app.notifications.types import DeliveryErrorKind


@dataclass(slots=True)
class EmailSendResult:
    provider_message_id: str


class EmailDeliveryError(Exception):
    def __init__(self, message: str, kind: DeliveryErrorKind) -> None:
        super().__init__(message)
        self.kind = kind


class ResendEmailProvider:
    """Thin Resend HTTP adapter."""

    def __init__(self, api_key: str, email_from: str, base_url: str = "https://api.resend.com") -> None:
        self._api_key = api_key
        self._email_from = email_from
        self._base_url = base_url.rstrip("/")

    async def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        *,
        html_body: str | None = None,
        attachments: list[EmailAttachment] | None = None,
    ) -> EmailSendResult:
        payload = {
            "from": self._email_from,
            "to": [to_email],
            "subject": subject,
            "text": body,
        }
        if html_body:
            payload["html"] = html_body
        if attachments:
            payload["attachments"] = [
                {
                    "filename": attachment.filename,
                    "content": attachment.content,
                    **({"content_type": attachment.content_type} if attachment.content_type else {}),
                }
                for attachment in attachments
            ]

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    f"{self._base_url}/emails",
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
        except httpx.HTTPError as exc:
            raise EmailDeliveryError(str(exc), DeliveryErrorKind.transient) from exc

        if 200 <= response.status_code < 300:
            data = response.json()
            return EmailSendResult(provider_message_id=str(data.get("id", "")))

        message = response.text or f"Resend error {response.status_code}"
        if response.status_code in {408, 409, 425, 429} or response.status_code >= 500:
            raise EmailDeliveryError(message, DeliveryErrorKind.transient)
        raise EmailDeliveryError(message, DeliveryErrorKind.permanent)
