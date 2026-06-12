import { apiFetch } from "@/lib/api/client";

export type DeviceInfo = {
  source: "browser-camera";
  userAgent: string;
  cameraLabel: string;
  appVersion: string;
};

export type TicketValidationRequest = {
  location_id?: string | null;
  hall_id?: string | null;
  device_info?: DeviceInfo;
};

export type TicketValidationResponse = {
  valid: boolean;
  redeemable: boolean;
  reason: string | null;
  admission_id: string | null;
  admission_type: string | null;
  screening_id: string | null;
  campaign_movie_id: string | null;
  movie_title: string | null;
  quantity: number | null;
  admission_status: string | null;
  starts_at: string | null;
  ends_at: string | null;
  redeemed_at: string | null;
  redemption_id: string | null;
};

export type RedemptionResponse = {
  redemption_id: string;
  admission_id: string;
  redeemed_at: string;
  status: "redeemed";
};

export function normalizeQr(value: string): string {
  try {
    const url = new URL(value);
    const pathSegments = url.pathname.split("/");
    return url.searchParams.get("token") ?? pathSegments[pathSegments.length - 1] ?? value;
  } catch {
    return value.trim();
  }
}

export function validateTicket(
  qrToken: string,
  token: string,
  payload: TicketValidationRequest = {},
): Promise<TicketValidationResponse> {
  return apiFetch<TicketValidationResponse>(
    `/validator/admissions/${encodeURIComponent(normalizeQr(qrToken))}/validate`,
    {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    },
  );
}

export function redeemTicket(
  qrToken: string,
  token: string,
  payload: TicketValidationRequest = {},
): Promise<RedemptionResponse> {
  return apiFetch<RedemptionResponse>(
    `/validator/admissions/${encodeURIComponent(normalizeQr(qrToken))}/redeem`,
    {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    },
  );
}
