from collections.abc import AsyncGenerator
from uuid import uuid4

from sqlalchemy.engine import URL, make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings


def _build_database_url() -> URL:
    url = make_url(settings.database_url or "postgresql+asyncpg://invalid:invalid@localhost:5432/invalid")
    if url.get_backend_name() == "postgresql" and url.get_driver_name() == "asyncpg":
        query = dict(url.query)
        query.setdefault("prepared_statement_cache_size", "0")
        if "sslmode" in query and "ssl" not in query:
            query["ssl"] = query.pop("sslmode")
        url = url.set(query=query)
    return url


engine = create_async_engine(
    _build_database_url(),
    pool_pre_ping=True,
    pool_recycle=300,
    poolclass=NullPool,
    connect_args={
        "statement_cache_size": 0,
        "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__",
    },
)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async SQLAlchemy session for request-scoped DB access."""
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL is required for database-backed endpoints")
    async with SessionLocal() as session:
        yield session


