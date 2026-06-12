from supabase import Client, create_client

from app.core.config import settings


def get_supabase_admin_client() -> Client:
    """Build a service-role Supabase client for trusted backend operations only."""
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    return create_client(settings.supabase_url, settings.supabase_service_role_key)

