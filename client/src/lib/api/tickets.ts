import { env } from "@/config/env";
import { apiFetch } from "@/lib/api/client";

export type AdmissionStatus =
  | "pending_outcome"
  | "active"
  | "lost_refund_pending"
  | "lost_no_refund"
  | "refunded"
  | "void"
  | "used";

export type LossDecision = "pending" | "refund" | "no_refund";

export type AdmissionType = "screening_ticket" | "campaign_earlybird";

export type AdmissionRead = {
  id: string;
  order_id: string;
  type: AdmissionType;
  screening_id: string | null;
  campaign_movie_id: string | null;
  campaign_id: string | null;
  quantity: number;
  unit_price_cents: number;
  total_price_cents: number;
  status: AdmissionStatus;
  screening_status:
    | "scheduled"
    | "selling"
    | "pending"
    | "confirmed"
    | "cancelled"
    | null;
  loss_decision: LossDecision;
  qr_token: string;
  created_at: string;
  starts_at: string | null;
  ends_at: string | null;
  redeemed_at: string | null;
  cinema_name: string | null;
  hall_name: string | null;
  location_name: string | null;
  location_address: string | null;
  city_name: string | null;
  movie_title: string;
  movie_poster_url: string | null;
  movie_release_year: number | null;
  selected_movie_title: string | null;
  selected_movie_poster_url: string | null;
  selected_movie_release_year: number | null;
  resolved_movie_title: string | null;
  resolved_movie_poster_url: string | null;
  resolved_movie_release_year: number | null;
  campaign_title: string | null;
  campaign_voting_ends_at: string | null;
  campaign_slot_starts_at: string | null;
  campaign_slot_ends_at: string | null;
  refund_eligible: boolean;
};

export type RefundRead = {
  id: string;
  admission_id: string;
  status: string;
  amount_cents: number;
};

export function listMyTickets(token: string) {
  return apiFetch<AdmissionRead[]>("/admissions/me", {
    method: "GET",
    token,
  });
}

export function requestAdmissionRefund(admissionId: string, token: string) {
  return apiFetch<RefundRead>(`/admissions/${admissionId}/refund`, {
    method: "POST",
    token,
  });
}

export async function downloadAdmissionPdf(admissionId: string, token: string) {
  const response = await fetch(
    `${env.apiBaseUrl}/admissions/${admissionId}/ticket.pdf`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `ticket-${admissionId}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
}
