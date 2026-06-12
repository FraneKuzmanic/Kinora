from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from urllib.parse import urlparse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.api.routes.share_previews import router as share_previews_router
from app.core.config import settings
from app.db.session import SessionLocal
from app.middleware.db_retry import retry_transient_db_disconnect
from app.notifications.runner import NotificationRunner
from app.services.lifecycle_scheduler import start_scheduler_tasks, stop_scheduler_tasks


def _cors_origins() -> list[str]:
    origins = {origin.rstrip("/") for origin in settings.allowed_cors_origins}
    if settings.share_public_url:
        origins.add(settings.share_public_url.rstrip("/"))

    for origin in list(origins):
        parsed = urlparse(origin)
        if parsed.scheme in {"http", "https"} and parsed.netloc:
            if parsed.netloc.startswith("www."):
                origins.add(f"{parsed.scheme}://{parsed.netloc.removeprefix('www.')}")
            elif "." in parsed.netloc and parsed.netloc not in {"localhost", "127.0.0.1"}:
                origins.add(f"{parsed.scheme}://www.{parsed.netloc}")

    return sorted(origins)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
    if not settings.enable_background_tasks:
        yield
        return

    scheduler_tasks = start_scheduler_tasks()
    notification_runner = NotificationRunner(SessionLocal)
    notification_runner.start()
    try:
        yield
    finally:
        await notification_runner.stop()
        await stop_scheduler_tasks(scheduler_tasks)


def create_application() -> FastAPI:
    """Create and configure the FastAPI application instance."""
    app = FastAPI(
        title=settings.app_name,
        debug=settings.debug,
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.middleware("http")(retry_transient_db_disconnect)

    @app.get("/", tags=["root"])
    async def root() -> dict[str, str]:
        return {
            "name": settings.app_name,
            "environment": settings.app_env,
            "status": "ok",
        }

    app.include_router(api_router, prefix=settings.api_v1_prefix)
    app.include_router(share_previews_router, prefix="/share", tags=["share"])

    return app


app = create_application()
