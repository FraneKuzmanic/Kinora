from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from sqlalchemy.exc import DBAPIError


SAFE_RETRY_METHODS = {"GET", "HEAD", "OPTIONS"}


def is_transient_disconnect_error(error: DBAPIError) -> bool:
    if error.connection_invalidated:
        return True

    message = str(error).lower()
    return (
        "connection was closed" in message
        or "connectiondoesnotexisterror" in message
        or "connection was closed in the middle of operation" in message
    )


async def retry_transient_db_disconnect(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    try:
        return await call_next(request)
    except DBAPIError as error:
        if request.method.upper() not in SAFE_RETRY_METHODS:
            raise
        if not is_transient_disconnect_error(error):
            raise

    return await call_next(request)
