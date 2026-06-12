import { apiFetch } from "@/lib/api/client";

export type PrivateBookingStatus =
  | "submitted"
  | "in_review"
  | "offered"
  | "accepted"
  | "paid"
  | "rejected"
  | "cancelled";

export type PrivateBookingRead = {
  id: string;
  requester_user_id: string;
  cinema_id: string;
  preferred_location_id: string | null;
  preferred_start_at: string | null;
  preferred_end_at: string | null;
  group_size: number;
  event_type: string | null;
  status: PrivateBookingStatus;
  notes: string | null;
  offered_location_id: string | null;
  offered_hall_id: string | null;
  offered_start_at: string | null;
  offered_end_at: string | null;
  quoted_price_cents: number | null;
  currency: string;
  cinema_response_message: string | null;
  responded_by_user_id: string | null;
  responded_at: string | null;
  accepted_at: string | null;
  order_id: string | null;
  cancelled_at: string | null;
  cancelled_by_user_id: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type PrivateBookingCreate = {
  cinema_id: string;
  preferred_location_id?: string;
  preferred_start_at: string;
  preferred_end_at: string;
  group_size: number;
  event_type: string;
  notes?: string;
};

export type PrivateBookingReview = {
  status: "in_review" | "offered" | "rejected";
  offered_location_id?: string;
  offered_hall_id?: string;
  offered_start_at?: string;
  offered_end_at?: string;
  quoted_price_cents?: number;
  cinema_response_message?: string;
};

export type PrivateBookingCheckoutSession = {
  order_id: string;
  session_id: string;
  checkout_url: string;
};

export function listPrivateBookings(token: string) {
  return apiFetch<PrivateBookingRead[]>("/private-bookings", {
    method: "GET",
    token,
  });
}

export function createPrivateBooking(
  payload: PrivateBookingCreate,
  token: string,
) {
  return apiFetch<PrivateBookingRead>("/private-bookings", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export function reviewPrivateBooking(
  bookingId: string,
  payload: PrivateBookingReview,
  token: string,
) {
  return apiFetch<PrivateBookingRead>(
    `/private-bookings/${encodeURIComponent(bookingId)}/review`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    },
  );
}

export function acceptPrivateBookingCheckoutSession(
  bookingId: string,
  token: string,
) {
  return apiFetch<PrivateBookingCheckoutSession>(
    `/private-bookings/${encodeURIComponent(bookingId)}/accept/checkout-session`,
    {
      method: "POST",
      token,
    },
  );
}

export function cancelPrivateBooking(
  bookingId: string,
  token: string,
  reason?: string,
) {
  return apiFetch<PrivateBookingRead>(
    `/private-bookings/${encodeURIComponent(bookingId)}/cancel`,
    {
      method: "POST",
      token,
      body: JSON.stringify(reason ? { reason } : {}),
    },
  );
}
