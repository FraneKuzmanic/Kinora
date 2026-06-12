from pydantic import BaseModel, field_validator


def _normalize_email(value: str) -> str:
    normalized = value.strip().lower()
    if "@" not in normalized or "." not in normalized.rsplit("@", 1)[-1]:
        raise ValueError("A valid email address is required")
    return normalized


class PasswordResetRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _normalize_email(value)


class PasswordResetRequestResponse(BaseModel):
    message: str


class SignupRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _normalize_email(value)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value) < 6:
            raise ValueError("Password must be at least 6 characters")
        return value


class SignupResponse(BaseModel):
    message: str


class TwoFactorEmailOtpRequestResponse(BaseModel):
    message: str
    expires_at: str
    resend_available_at: str


class TwoFactorEmailOtpVerifyRequest(BaseModel):
    code: str

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) != 6 or not normalized.isdigit():
            raise ValueError("Enter the 6-digit verification code")
        return normalized


class TwoFactorEmailOtpVerifyResponse(BaseModel):
    two_factor_token: str
    expires_at: str


class MeResponse(BaseModel):
    id: str | None
    email: str | None
    role: str
    app_metadata: dict
    user_metadata: dict
    profile: dict | None = None

