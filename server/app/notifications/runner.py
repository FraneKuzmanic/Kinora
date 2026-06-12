import asyncio
import logging
from contextlib import suppress

from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.config import settings
from app.notifications.dispatcher import EmailOutboxDispatcher
from app.notifications.providers.resend import ResendEmailProvider
from app.notifications.types import DEFAULT_BATCH_SIZE, DEFAULT_POLL_INTERVAL_SECONDS

logger = logging.getLogger(__name__)


class NotificationRunner:
    def __init__(self, session_factory: async_sessionmaker) -> None:
        self._session_factory = session_factory
        self._task: asyncio.Task | None = None

    def start(self) -> None:
        if self._task is not None or not self.is_enabled():
            return
        self._task = asyncio.create_task(self._run_loop(), name="notification-outbox-runner")

    async def stop(self) -> None:
        if self._task is None:
            return
        self._task.cancel()
        with suppress(asyncio.CancelledError):
            await self._task
        self._task = None

    def is_enabled(self) -> bool:
        return bool(settings.database_url and settings.resend_api_key and settings.email_from)

    async def _run_loop(self) -> None:
        provider = ResendEmailProvider(settings.resend_api_key or "", settings.email_from or "")
        dispatcher = EmailOutboxDispatcher(provider=provider)

        while True:
            try:
                async with self._session_factory() as session:
                    await dispatcher.dispatch_batch(
                        session,
                        batch_size=settings.notification_batch_size or DEFAULT_BATCH_SIZE,
                    )
            except Exception:
                logger.exception("Notification outbox runner iteration failed")

            await asyncio.sleep(settings.notification_poll_interval_seconds or DEFAULT_POLL_INTERVAL_SECONDS)
