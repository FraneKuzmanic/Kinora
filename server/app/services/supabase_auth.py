import httpx
from fastapi import HTTPException, status

from app.core.config import settings


class SupabaseAuthService:
    """Thin wrapper around Supabase Auth user introspection endpoint."""

    async def get_user(self, access_token: str) -> dict | None:
        """Return Supabase user payload for a valid access token, otherwise None."""
        if not settings.supabase_url or not settings.supabase_anon_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Supabase auth is not configured",
            )

        url = f"{settings.supabase_url.rstrip('/')}/auth/v1/user"

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                url,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "apikey": settings.supabase_anon_key,
                },
            )

        if response.status_code == status.HTTP_200_OK:
            return response.json()

        return None
