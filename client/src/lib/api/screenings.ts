import { apiFetch } from "@/lib/api/client";

export type ScreeningStatus =
  | "scheduled"
  | "selling"
  | "pending"
  | "confirmed"
  | "cancelled";

export type ScreeningRead = {
  id: string;
  cinema_id: string;
  hall_id: string;
  movie_id: string;
  campaign_id: string | null;
  status: ScreeningStatus;
  starts_at: string;
  ends_at: string;
  decision_days_before_start: number;
  min_tickets_to_confirm: number;
  max_tickets: number;
  tickets_sold: number;
  ticket_price_cents: number;
  pending_at: string | null;
  pending_expires_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  movie_title: string;
  movie_release_year: number | null;
  movie_poster_url: string | null;
  movie_overview: string | null;
  cinema_name: string;
  hall_name: string;
  hall_capacity: number;
  location_id: string;
  location_name: string | null;
  location_address: string | null;
  city_id: string;
  city_name: string;
};

export type ScreeningFilter = {
  city_id?: string;
  cinema_id?: string;
  status?: ScreeningStatus;
  date_from?: string;
  date_to?: string;
};

export type ScreeningCreate = {
  hall_id: string;
  movie_id: string;
  starts_at: string;
  ends_at: string;
  decision_days_before_start?: number;
  min_tickets_to_confirm: number;
  max_tickets?: number;
  ticket_price_cents: number;
};

export type ScreeningCheckoutSessionRead = {
  order_id: string;
  session_id: string;
  checkout_url: string;
};

export type ListScreeningsOptions = {
  activeOnly?: boolean;
  limit?: number;
};

export function listScreenings(options: ListScreeningsOptions = {}) {
  const params = new URLSearchParams();

  if (options.activeOnly) {
    params.set("active_only", "true");
  }

  if (options.limit !== undefined) {
    params.set("limit", String(options.limit));
  }

  const query = params.toString();

  return apiFetch<ScreeningRead[]>(`/screenings${query ? `?${query}` : ""}`, {
    method: "GET",
  });
}

export function getScreening(screeningId: string) {
  return apiFetch<ScreeningRead>(`/screenings/${screeningId}`, {
    method: "GET",
  });
}

export function searchScreenings(filters: ScreeningFilter) {
  return apiFetch<ScreeningRead[]>("/screenings/search", {
    method: "POST",
    body: JSON.stringify(filters),
  });
}

export function createScreening(payload: ScreeningCreate, token: string) {
  return apiFetch<ScreeningRead>("/screenings", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export function openScreeningSales(screeningId: string, token: string) {
  return apiFetch<ScreeningRead>(`/screenings/${screeningId}/open-sales`, {
    method: "POST",
    token,
  });
}

export function confirmScreening(screeningId: string, token: string) {
  return apiFetch<ScreeningRead>(`/screenings/${screeningId}/confirm`, {
    method: "POST",
    token,
  });
}

export function cancelScreening(
  screeningId: string,
  token: string,
  reason?: string,
) {
  return apiFetch<ScreeningRead>(`/screenings/${screeningId}/cancel`, {
    method: "POST",
    token,
    body: JSON.stringify(reason ? { reason } : {}),
  });
}

export function createScreeningCheckoutSession(
  screeningId: string,
  quantity: number,
  token: string,
  couponId?: string | null,
) {
  return apiFetch<ScreeningCheckoutSessionRead>(
    `/screenings/${screeningId}/checkout-session`,
    {
      method: "POST",
      token,
      body: JSON.stringify({ quantity, coupon_id: couponId ?? null }),
    },
  );
}
