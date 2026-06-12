import { env } from "@/config/env";
import { getTwoFactorSessionToken } from "@/lib/auth/session-storage";

type RequestOptions = RequestInit & {
  token?: string;
};

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers, ...rest } = options;
  const isFormData = rest.body instanceof FormData;
  const twoFactorToken = getTwoFactorSessionToken();

  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    ...rest,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(twoFactorToken ? { "X-Kinora-2FA": twoFactorToken } : {}),
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
  });

  if (!response.ok) {
    let detail: unknown = null;

    try {
      detail = await response.json();
    } catch {
      detail = await response.text();
    }

    const message = getApiErrorMessage(detail, response.status);

    throw new ApiError(message, response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function getApiErrorMessage(detail: unknown, status: number) {
  if (typeof detail !== "object" || detail === null || !("detail" in detail)) {
    return `Request failed with status ${status}`;
  }

  const responseDetail = detail.detail;
  if (typeof responseDetail === "string") {
    return responseDetail;
  }
  if (
    typeof responseDetail === "object" &&
    responseDetail !== null &&
    "message" in responseDetail &&
    typeof responseDetail.message === "string"
  ) {
    return responseDetail.message;
  }

  return `Request failed with status ${status}`;
}

export type HealthResponse = {
  status: string;
  app: string;
  environment: string;
  timestamp: string;
};

export function getHealth() {
  return apiFetch<HealthResponse>("/health");
}

export type ProfileSummary = {
  user_id: string;
  role: string;
  display_name: string | null;
};

export type MeResponse = {
  id: string | null;
  email: string | null;
  role: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  profile: ProfileSummary | null;
};

export function getMe(token: string) {
  return apiFetch<MeResponse>("/auth/me", {
    method: "GET",
    token,
  });
}

export type PasswordResetRequestResponse = {
  message: string;
};

export function requestPasswordResetEmail(email: string) {
  return apiFetch<PasswordResetRequestResponse>("/auth/password-reset", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export type SignupRequestResponse = {
  message: string;
};

export function registerAudienceAccount(email: string, password: string) {
  return apiFetch<SignupRequestResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export type TwoFactorEmailOtpRequestResponse = {
  message: string;
  expires_at: string;
  resend_available_at: string;
};

export function requestTwoFactorEmailOtp(token: string) {
  return apiFetch<TwoFactorEmailOtpRequestResponse>("/auth/2fa/email/request", {
    method: "POST",
    token,
  });
}

export type TwoFactorEmailOtpVerifyResponse = {
  two_factor_token: string;
  expires_at: string;
};

export function verifyTwoFactorEmailOtp(token: string, code: string) {
  return apiFetch<TwoFactorEmailOtpVerifyResponse>("/auth/2fa/email/verify", {
    method: "POST",
    token,
    body: JSON.stringify({ code }),
  });
}
