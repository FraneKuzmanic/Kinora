import asyncio
import logging
from collections.abc import Awaitable, Callable

from app.core.config import settings

log = logging.getLogger(__name__)


async def _run_loop(interval_seconds: int, runner: Callable[[], Awaitable[None]], label: str) -> None:
    while True:
        await asyncio.sleep(interval_seconds)
        if not settings.database_url:
            continue
        try:
            await runner()
        except Exception:
            log.exception("Unexpected error in %s", label)


async def run_core_lifecycle_tick() -> None:
    from app.db.session import SessionLocal
    from app.services.campaign_service import CampaignService
    from app.services.screening_service import ScreeningService

    campaign_svc = CampaignService()
    screening_svc = ScreeningService()
    async with SessionLocal() as session:
        await campaign_svc.resolve_expired_campaigns(session)
        await screening_svc.open_scheduled_screenings(session)
        await screening_svc.confirm_selling_screenings(session)
        await screening_svc.cancel_undersold_screenings(session)


async def run_pending_expiry_tick() -> None:
    from app.db.session import SessionLocal
    from app.services.screening_service import ScreeningService

    screening_svc = ScreeningService()
    async with SessionLocal() as session:
        await screening_svc.auto_cancel_expired_pending_screenings(session)


def start_scheduler_tasks() -> list[asyncio.Task]:
    return [
        asyncio.create_task(_run_loop(60, run_core_lifecycle_tick, "core_lifecycle_loop")),
        asyncio.create_task(_run_loop(1800, run_pending_expiry_tick, "pending_expiry_loop")),
    ]


async def stop_scheduler_tasks(tasks: list[asyncio.Task]) -> None:
    for task in tasks:
        task.cancel()

    for task in tasks:
        try:
            await task
        except asyncio.CancelledError:
            pass

