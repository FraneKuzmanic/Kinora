import uuid

from asyncpg import InterfaceError as AsyncpgInterfaceError
from asyncpg.exceptions import PostgresConnectionError
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.profile import Profile, UserRole


ALLOWED_PROFILE_ROLES = {role.value for role in UserRole}


class ProfileService:
    """Profile read/write operations used by auth and role-aware flows."""

    async def get_by_user_id(self, session: AsyncSession, user_id: str | uuid.UUID) -> Profile | None:
        """Fetch a profile row by Supabase auth user id."""
        statement = select(Profile).where(Profile.user_id == user_id)
        result = await self._execute_with_retry(session, lambda: session.execute(statement))
        return result.scalar_one_or_none()

    @staticmethod
    def normalize_role(role: object) -> str | None:
        """Return a valid app role value, or None for unknown metadata."""
        if isinstance(role, UserRole):
            return role.value
        if isinstance(role, str) and role in ALLOWED_PROFILE_ROLES:
            return role
        return None

    @classmethod
    def resolve_metadata_role(cls, app_metadata: dict, user_metadata: dict) -> str:
        """Resolve the role used to bootstrap a missing profile."""
        app_role = cls.normalize_role(app_metadata.get("role"))
        if app_role:
            return app_role

        user_role = cls.normalize_role(user_metadata.get("role"))
        if user_role:
            return user_role

        return UserRole.audience.value

    @staticmethod
    def resolve_display_name(user_metadata: dict) -> str | None:
        """Resolve a display name from Supabase/Google user metadata."""
        for key in ("full_name", "name", "display_name"):
            value = user_metadata.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return None

    @classmethod
    def role_value(cls, role: object) -> str | None:
        """Serialize role values from ORM enums or plain test doubles."""
        if isinstance(role, UserRole):
            return role.value
        if isinstance(role, str):
            return role
        return None

    async def ensure_profile(self, session: AsyncSession, user_id: str | uuid.UUID, role: str) -> Profile:
        """Create a profile when missing, otherwise return the existing row."""
        profile = await self.get_by_user_id(session, user_id)
        if profile:
            return profile

        profile = Profile(user_id=user_id, role=self.normalize_role(role) or UserRole.audience.value)
        session.add(profile)
        await session.commit()
        await session.refresh(profile)
        return profile

    async def ensure_profile_for_user(
        self,
        session: AsyncSession,
        *,
        user_id: str | uuid.UUID,
        app_metadata: dict,
        user_metadata: dict,
    ) -> Profile:
        """Create or update the app profile for a Supabase-authenticated user."""
        profile = await self.get_by_user_id(session, user_id)
        display_name = self.resolve_display_name(user_metadata)

        if profile:
            if not profile.display_name and display_name:
                profile.display_name = display_name
                session.add(profile)
                await session.commit()
                await session.refresh(profile)
            return profile

        profile = Profile(
            user_id=user_id,
            role=self.resolve_metadata_role(app_metadata, user_metadata),
            display_name=display_name,
        )
        session.add(profile)
        await session.commit()
        await session.refresh(profile)
        return profile

    async def _execute_with_retry(self, session: AsyncSession, operation):
        for attempt in range(2):
            try:
                return await operation()
            except (DBAPIError, PostgresConnectionError, AsyncpgInterfaceError, OSError) as exc:
                if not self._is_retryable_disconnect(exc) or attempt == 1:
                    raise
                await session.close()

    def _is_retryable_disconnect(self, exc: Exception) -> bool:
        if isinstance(exc, (PostgresConnectionError, AsyncpgInterfaceError, ConnectionResetError)):
            return True
        if isinstance(exc, DBAPIError) and getattr(exc, "connection_invalidated", False):
            return True
        message = str(exc).lower()
        return (
            "connection was closed in the middle of operation" in message
            or "connectiondoesnotexisterror" in message
            or "forcibly closed by the remote host" in message
        )
