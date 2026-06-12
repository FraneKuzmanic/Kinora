from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


ENV_FILE_PATH = Path(__file__).resolve().parents[2] / ".env"
LOCAL_CORS_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
)


class Settings(BaseSettings):
    app_name: str = "Kinora API"
    app_env: str = "development"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"
    api_public_url: str = "http://localhost:8000"
    client_url: str = "http://localhost:5173"
    cors_origins: list[str] = Field(default_factory=list)
    share_public_url: str | None = None
    enable_background_tasks: bool = True
    dispatch_notifications_inline: bool = False

    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    supabase_service_role_key: str | None = None
    supabase_jwt_secret: str | None = None
    database_url: str | None = None

    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None

    resend_api_key: str | None = None
    email_from: str | None = None
    password_reset_email_from: str = "Kinora <noreply@kinora.live>"
    signup_confirmation_email_from: str = "Kinora <noreply@kinora.live>"
    notification_poll_interval_seconds: int = 10
    notification_batch_size: int = 20

    tmdb_api_key: str | None = None
    pdf_storage_path: str = "/tmp/kinora_pdfs"
    cinema_logo_storage_path: str = "/tmp/kinora_cinema_logos"
    cinema_logo_max_bytes: int = 2 * 1024 * 1024

    model_config = SettingsConfigDict(
        env_file=ENV_FILE_PATH,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug_value(cls, value: object) -> object:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on", "development", "dev"}:
                return True
            if normalized in {"0", "false", "no", "off", "release", "production", "prod"}:
                return False
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> object:
        if value is None or value == "":
            return []
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def allowed_cors_origins(self) -> list[str]:
        origins = [self.client_url, *self.cors_origins]

        if self.app_env.strip().lower() not in {"production", "prod"}:
            origins.extend(LOCAL_CORS_ORIGINS)

        return list(dict.fromkeys(origin.rstrip("/") for origin in origins if origin))


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
