from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api.deps.auth import get_current_user
from app.api.deps.db import get_db
from app.core.config import settings
from app.main import app
from app.models.profile import Profile, UserRole
from app.services.supabase_auth import SupabaseAuthService

client = TestClient(app)


class _ScalarResult:
    def __init__(self, value=None):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class _FakeSession:
    def __init__(self, profile=None):
        self.profile = profile
        self.added = []
        self.committed = False
        self.refreshed = []

    async def execute(self, statement):
        return _ScalarResult(self.profile)

    def add(self, item):
        self.added.append(item)
        self.profile = item

    async def commit(self):
        self.committed = True

    async def refresh(self, item):
        self.refreshed.append(item)


def _profile(user_id, *, role=UserRole.audience, display_name=None):
    return Profile(user_id=user_id, role=role, display_name=display_name)


def _set_overrides(user_payload: dict, session: _FakeSession) -> None:
    async def _override_user():
        return user_payload

    async def _override_db():
        yield session

    app.dependency_overrides[get_current_user] = _override_user
    app.dependency_overrides[get_db] = _override_db


def _clear_overrides() -> None:
    app.dependency_overrides.clear()


def test_auth_me_creates_google_audience_profile_with_display_name() -> None:
    user_id = uuid4()
    session = _FakeSession()
    _set_overrides(
        {
            "id": str(user_id),
            "email": "google@example.com",
            "app_metadata": {"provider": "google"},
            "user_metadata": {
                "iss": "https://accounts.google.com",
                "email": "google@example.com",
                "full_name": "Ada Lovelace",
            },
        },
        session,
    )

    response = client.get("/api/v1/auth/me")
    _clear_overrides()

    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "audience"
    assert body["profile"]["role"] == "audience"
    assert body["profile"]["display_name"] == "Ada Lovelace"
    assert session.profile.role == "audience"
    assert session.profile.display_name == "Ada Lovelace"
    assert session.committed


def test_auth_me_existing_profile_role_wins_over_metadata() -> None:
    user_id = uuid4()
    session = _FakeSession(_profile(user_id, role=UserRole.cinema_admin, display_name="Admin"))
    _set_overrides(
        {
            "id": str(user_id),
            "email": "admin@example.com",
            "app_metadata": {},
            "user_metadata": {"role": "audience", "full_name": "Different Name"},
        },
        session,
    )

    response = client.get("/api/v1/auth/me")
    _clear_overrides()

    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "cinema_admin"
    assert body["profile"]["display_name"] == "Admin"
    assert session.profile.display_name == "Admin"


def test_auth_me_fills_missing_existing_display_name_once() -> None:
    user_id = uuid4()
    session = _FakeSession(_profile(user_id, role=UserRole.audience, display_name=None))
    _set_overrides(
        {
            "id": str(user_id),
            "email": "viewer@example.com",
            "app_metadata": {},
            "user_metadata": {"name": "Viewer Name"},
        },
        session,
    )

    response = client.get("/api/v1/auth/me")
    _clear_overrides()

    assert response.status_code == 200
    assert response.json()["profile"]["display_name"] == "Viewer Name"
    assert session.profile.display_name == "Viewer Name"
    assert session.committed


def test_auth_me_metadata_fallback_still_supports_existing_behavior() -> None:
    user_id = uuid4()
    session = _FakeSession()
    _set_overrides(
        {
            "id": str(user_id),
            "email": "validator@example.com",
            "app_metadata": {},
            "user_metadata": {"role": "validator", "display_name": "Gate Staff"},
        },
        session,
    )

    response = client.get("/api/v1/auth/me")
    _clear_overrides()

    assert response.status_code == 200
    assert response.json()["role"] == "validator"
    assert session.profile.role == "validator"


def test_auth_me_invalid_metadata_role_falls_back_to_audience() -> None:
    user_id = uuid4()
    session = _FakeSession()
    _set_overrides(
        {
            "id": str(user_id),
            "email": "unknown@example.com",
            "app_metadata": {"role": "owner"},
            "user_metadata": {"role": "guest"},
        },
        session,
    )

    response = client.get("/api/v1/auth/me")
    _clear_overrides()

    assert response.status_code == 200
    assert response.json()["role"] == "audience"
    assert session.profile.role == "audience"


def test_auth_me_email_password_user_requires_2fa(monkeypatch) -> None:
    user_id = uuid4()
    session = _FakeSession()

    async def _fake_get_user(self, access_token: str):
        return {
            "id": str(user_id),
            "email": "viewer@example.com",
            "app_metadata": {"provider": "email", "providers": ["email"]},
            "user_metadata": {},
        }

    async def _override_db():
        yield session

    monkeypatch.setattr("app.api.deps.auth.SupabaseAuthService.get_user", _fake_get_user)
    app.dependency_overrides[get_db] = _override_db

    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer token"})
    _clear_overrides()

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "two_factor_required"


def test_auth_me_email_password_user_accepts_2fa(monkeypatch) -> None:
    user_id = uuid4()
    session = _FakeSession(_profile(user_id, role=UserRole.audience, display_name="Viewer"))
    calls = []

    async def _fake_get_user(self, access_token: str):
        return {
            "id": str(user_id),
            "email": "viewer@example.com",
            "app_metadata": {"provider": "email", "providers": ["email"]},
            "user_metadata": {},
        }

    async def _fake_verify_session(self, session_arg, *, user_id: str, token: str | None):
        calls.append((user_id, token))
        return True

    async def _override_db():
        yield session

    monkeypatch.setattr("app.api.deps.auth.SupabaseAuthService.get_user", _fake_get_user)
    monkeypatch.setattr("app.api.deps.auth.TwoFactorService.verify_session", _fake_verify_session)
    app.dependency_overrides[get_db] = _override_db

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer token", "X-Kinora-2FA": "kinora-token"},
    )
    _clear_overrides()

    assert response.status_code == 200
    assert response.json()["email"] == "viewer@example.com"
    assert calls == [(str(user_id), "kinora-token")]


@pytest.mark.parametrize("email", ["admin@test.com", "validator@example.com"])
def test_auth_me_test_accounts_skip_2fa(monkeypatch, email: str) -> None:
    user_id = uuid4()
    session = _FakeSession(_profile(user_id, role=UserRole.audience, display_name="Viewer"))

    async def _fake_get_user(self, access_token: str):
        return {
            "id": str(user_id),
            "email": email,
            "app_metadata": {"provider": "email", "providers": ["email"]},
            "user_metadata": {},
        }

    async def _fake_verify_session(self, session_arg, *, user_id: str, token: str | None):
        raise AssertionError("Test account emails should not require Kinora 2FA")

    async def _override_db():
        yield session

    monkeypatch.setattr("app.api.deps.auth.SupabaseAuthService.get_user", _fake_get_user)
    monkeypatch.setattr("app.api.deps.auth.TwoFactorService.verify_session", _fake_verify_session)
    app.dependency_overrides[get_db] = _override_db

    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer token"})
    _clear_overrides()

    assert response.status_code == 200
    assert response.json()["email"] == email


def test_auth_me_google_user_skips_2fa(monkeypatch) -> None:
    user_id = uuid4()
    session = _FakeSession(_profile(user_id, role=UserRole.audience, display_name="Viewer"))

    async def _fake_get_user(self, access_token: str):
        return {
            "id": str(user_id),
            "email": "viewer@example.com",
            "app_metadata": {"provider": "google", "providers": ["google"]},
            "user_metadata": {},
        }

    async def _fake_verify_session(self, session_arg, *, user_id: str, token: str | None):
        raise AssertionError("Google sign-in should not require Kinora 2FA")

    async def _override_db():
        yield session

    monkeypatch.setattr("app.api.deps.auth.SupabaseAuthService.get_user", _fake_get_user)
    monkeypatch.setattr("app.api.deps.auth.TwoFactorService.verify_session", _fake_verify_session)
    app.dependency_overrides[get_db] = _override_db

    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer token"})
    _clear_overrides()

    assert response.status_code == 200
    assert response.json()["email"] == "viewer@example.com"


def test_auth_2fa_request_uses_unverified_session(monkeypatch) -> None:
    user_id = uuid4()
    session = _FakeSession()
    calls = []

    async def _override_user():
        return {
            "id": str(user_id),
            "email": "Viewer@Example.com",
            "app_metadata": {"provider": "email", "providers": ["email"]},
            "user_metadata": {},
        }

    async def _override_db():
        yield session

    async def _fake_request(self, session_arg, *, user_id: str, email: str | None):
        calls.append((session_arg, user_id, email))
        return SimpleNamespace(
            message="If the session is valid, we sent a verification code.",
            expires_at=SimpleNamespace(isoformat=lambda: "2026-05-03T12:10:00+00:00"),
            resend_available_at=SimpleNamespace(isoformat=lambda: "2026-05-03T12:01:00+00:00"),
        )

    from app.api.deps.auth import get_unverified_current_user

    app.dependency_overrides[get_unverified_current_user] = _override_user
    app.dependency_overrides[get_db] = _override_db
    monkeypatch.setattr("app.api.routes.auth.TwoFactorService.request_email_otp", _fake_request)

    response = client.post("/api/v1/auth/2fa/email/request")
    _clear_overrides()

    assert response.status_code == 202
    assert response.json()["resend_available_at"] == "2026-05-03T12:01:00+00:00"
    assert calls == [(session, str(user_id), "Viewer@Example.com")]


def test_auth_2fa_verify_returns_kinora_token(monkeypatch) -> None:
    user_id = uuid4()
    session = _FakeSession()

    async def _override_user():
        return {
            "id": str(user_id),
            "email": "viewer@example.com",
            "app_metadata": {"provider": "email", "providers": ["email"]},
            "user_metadata": {},
        }

    async def _override_db():
        yield session

    async def _fake_verify(self, session_arg, *, user_id: str, code: str):
        return SimpleNamespace(
            two_factor_token=f"token-for-{code}",
            expires_at=SimpleNamespace(isoformat=lambda: "2026-06-02T12:00:00+00:00"),
        )

    from app.api.deps.auth import get_unverified_current_user

    app.dependency_overrides[get_unverified_current_user] = _override_user
    app.dependency_overrides[get_db] = _override_db
    monkeypatch.setattr("app.api.routes.auth.TwoFactorService.verify_email_otp", _fake_verify)

    response = client.post("/api/v1/auth/2fa/email/verify", json={"code": "123456"})
    _clear_overrides()

    assert response.status_code == 200
    assert response.json() == {
        "two_factor_token": "token-for-123456",
        "expires_at": "2026-06-02T12:00:00+00:00",
    }


def test_password_reset_request_uses_generic_response(monkeypatch) -> None:
    calls = []

    async def _fake_request_reset(self, email: str) -> None:
        calls.append(email)

    monkeypatch.setattr(
        "app.api.routes.auth.PasswordResetService.request_reset",
        _fake_request_reset,
    )

    response = client.post(
        "/api/v1/auth/password-reset",
        json={"email": "Viewer@Example.com "},
    )

    assert response.status_code == 202
    assert response.json() == {
        "message": "If an account exists for that email, we sent a reset link."
    }
    assert calls == ["viewer@example.com"]


def test_password_reset_request_rejects_invalid_email() -> None:
    response = client.post(
        "/api/v1/auth/password-reset",
        json={"email": "not-an-email"},
    )

    assert response.status_code == 422


def test_signup_request_generates_link_and_sends_resend_email(monkeypatch) -> None:
    generated = []
    sent = []

    class _FakeAdmin:
        def generate_link(self, params):
            generated.append(params)
            return SimpleNamespace(
                properties=SimpleNamespace(
                    action_link=(
                        "https://project.supabase.co/auth/v1/verify?token=signup-token"
                    )
                )
            )

    class _FakeSupabase:
        auth = SimpleNamespace(admin=_FakeAdmin())

    class _FakeResendProvider:
        def __init__(self, api_key: str, email_from: str) -> None:
            self.api_key = api_key
            self.email_from = email_from

        async def send_email(self, to_email: str, subject: str, body: str, *, html_body=None):
            sent.append(
                {
                    "api_key": self.api_key,
                    "from": self.email_from,
                    "to": to_email,
                    "subject": subject,
                    "body": body,
                    "html": html_body,
                }
            )

    monkeypatch.setattr(settings, "supabase_url", "https://project.supabase.co")
    monkeypatch.setattr(settings, "supabase_service_role_key", "service-role")
    monkeypatch.setattr(settings, "resend_api_key", "re_test")
    monkeypatch.setattr(settings, "client_url", "https://kinora.live")
    monkeypatch.setattr(
        settings,
        "signup_confirmation_email_from",
        "Kinora <noreply@kinora.live>",
    )
    monkeypatch.setattr(
        "app.services.signup_service.get_supabase_admin_client",
        lambda: _FakeSupabase(),
    )
    monkeypatch.setattr("app.services.signup_service.ResendEmailProvider", _FakeResendProvider)

    response = client.post(
        "/api/v1/auth/signup",
        json={"email": "Viewer@Example.com ", "password": "secret123"},
    )

    assert response.status_code == 202
    assert response.json() == {
        "message": "Account created. Check your email to verify your address before signing in."
    }
    assert generated == [
        {
            "type": "signup",
            "email": "viewer@example.com",
            "password": "secret123",
            "options": {
                "data": {"role": "audience"},
                "redirect_to": "https://kinora.live/login",
            },
        }
    ]
    assert sent[0]["from"] == "Kinora <noreply@kinora.live>"
    assert sent[0]["to"] == "viewer@example.com"
    assert sent[0]["subject"] == "Confirm your Kinora account"
    assert "Confirm email" in sent[0]["html"]


def test_signup_request_rejects_invalid_payload() -> None:
    response = client.post(
        "/api/v1/auth/signup",
        json={"email": "not-an-email", "password": "short"},
    )

    assert response.status_code == 422


def test_signup_request_requires_email_config(monkeypatch) -> None:
    monkeypatch.setattr(settings, "supabase_url", None)
    monkeypatch.setattr(settings, "supabase_service_role_key", "service-role")
    monkeypatch.setattr(settings, "resend_api_key", "re_test")

    response = client.post(
        "/api/v1/auth/signup",
        json={"email": "viewer@example.com", "password": "secret123"},
    )

    assert response.status_code == 503
    assert "SUPABASE_URL" in response.json()["detail"]


def test_signup_request_returns_conflict_for_duplicate_email(monkeypatch) -> None:
    class _FakeAdmin:
        def generate_link(self, params):
            raise RuntimeError("User already registered")

    class _FakeSupabase:
        auth = SimpleNamespace(admin=_FakeAdmin())

    monkeypatch.setattr(settings, "supabase_url", "https://project.supabase.co")
    monkeypatch.setattr(settings, "supabase_service_role_key", "service-role")
    monkeypatch.setattr(settings, "resend_api_key", "re_test")
    monkeypatch.setattr(
        "app.services.signup_service.get_supabase_admin_client",
        lambda: _FakeSupabase(),
    )

    response = client.post(
        "/api/v1/auth/signup",
        json={"email": "viewer@example.com", "password": "secret123"},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == (
        "An account with this email already exists. Sign in or reset your password."
    )


@pytest.mark.asyncio
async def test_supabase_auth_requires_url_and_anon_key(monkeypatch) -> None:
    monkeypatch.setattr(settings, "supabase_url", "https://project.supabase.co")
    monkeypatch.setattr(settings, "supabase_anon_key", None)

    with pytest.raises(HTTPException) as exc:
        await SupabaseAuthService().get_user("token")

    assert exc.value.status_code == 503
    assert exc.value.detail == "Supabase auth is not configured"


@pytest.mark.asyncio
async def test_supabase_auth_invalid_token_returns_none(monkeypatch) -> None:
    calls = []

    class _FakeAsyncClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def get(self, url, headers):
            calls.append((url, headers))
            return SimpleNamespace(status_code=401)

    monkeypatch.setattr(settings, "supabase_url", "https://project.supabase.co")
    monkeypatch.setattr(settings, "supabase_anon_key", "anon-key")
    monkeypatch.setattr("app.services.supabase_auth.httpx.AsyncClient", _FakeAsyncClient)

    user = await SupabaseAuthService().get_user("bad-token")

    assert user is None
    assert calls == [
        (
            "https://project.supabase.co/auth/v1/user",
            {"Authorization": "Bearer bad-token", "apikey": "anon-key"},
        )
    ]

