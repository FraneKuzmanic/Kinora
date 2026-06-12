from fastapi import HTTPException, status


def resolve_role(current_user: dict, profile_role: str | None = None) -> str:
    """Resolve role precedence used across API handlers."""
    app_metadata = current_user.get("app_metadata") or {}
    user_metadata = current_user.get("user_metadata") or {}
    return profile_role or app_metadata.get("role") or user_metadata.get("role") or "audience"


def require_any_role(role: str, allowed_roles: set[str]) -> None:
    """Raise 403 when caller role is not allowed for an endpoint."""
    if role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{role}' is not allowed for this operation",
        )

