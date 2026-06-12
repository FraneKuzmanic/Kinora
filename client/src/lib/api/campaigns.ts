import { apiFetch } from "@/lib/api/client";

export type CampaignStatus = "draft" | "voting" | "resolved" | "cancelled";

export type CampaignRead = {
  id: string;
  cinema_id: string;
  hall_id: string;
  cinema_name: string;
  hall_name: string;
  hall_capacity: number;
  city_id: string;
  city_name: string;
  location_name: string | null;
  title: string;
  description: string | null;
  status: CampaignStatus;
  voting_starts_at: string | null;
  voting_ends_at: string | null;
  voting_duration_days: number;
  slot_starts_at: string;
  slot_ends_at: string;
  decision_days_before_screening: number;
  min_tickets_to_confirm: number;
  max_tickets: number | null;
  ticket_price_cents: number;
  winning_movie_id: string | null;
  resolved_at: string | null;
};

export type CampaignMovieStats = {
  id: string;
  campaign_id: string;
  movie_id: string;
  sort_order: number;
  is_winner: boolean;
  vote_count: number;
  ticket_count: number | null;
  movie_title: string;
  movie_release_year: number | null;
  movie_poster_url: string | null;
  movie_overview: string | null;
  movie_runtime_minutes: number | null;
};

export type CampaignDetailRead = CampaignRead & {
  current_user_vote_campaign_movie_id: string | null;
  total_early_bird_tickets: number;
  movies: CampaignMovieStats[];
};

export type CampaignDiscoverMovieRead = {
  id: string;
  movie_id: string;
  sort_order: number;
  vote_count: number;
  movie_title: string;
  movie_poster_url: string | null;
  is_leading: boolean;
};

export type CampaignDiscoverCardRead = {
  id: string;
  created_at: string;
  cinema_name: string;
  location_name: string | null;
  city_name: string;
  slot_starts_at: string;
  voting_ends_at: string | null;
  leading_movie_title: string;
  leading_movie_vote_count: number;
  total_voters: number;
  current_user_vote_campaign_movie_id: string | null;
  movies: CampaignDiscoverMovieRead[];
};

export type CampaignFilter = {
  city_id?: string;
  cinema_id?: string;
  status?: CampaignStatus;
};

export type CampaignCreate = {
  hall_id: string;
  title: string;
  description?: string;
  slot_starts_at: string;
  slot_ends_at: string;
  voting_duration_days?: number;
  decision_days_before_screening?: number;
  min_tickets_to_confirm: number;
  max_tickets?: number;
  ticket_price_cents: number;
};

export type CampaignUpdate = Partial<CampaignCreate>;

export type CampaignMovieRead = {
  id: string;
  campaign_id: string;
  movie_id: string;
  sort_order: number;
  is_winner: boolean;
};

export type CampaignMovieCreate = {
  movie_id: string;
  sort_order?: number;
};

export function searchCampaigns(filters: CampaignFilter) {
  return apiFetch<CampaignRead[]>("/campaigns/search", {
    method: "POST",
    body: JSON.stringify(filters),
  });
}

export type CampaignVoteRead = {
  id: string;
  campaign_id: string;
  campaign_movie_id: string;
  user_id: string;
  created_at: string;
};

export type CheckoutSessionRead = {
  order_id: string;
  session_id: string;
  checkout_url: string;
};

export function getCampaign(campaignId: string, token?: string) {
  return apiFetch<CampaignDetailRead>(`/campaigns/${campaignId}`, {
    method: "GET",
    token,
  });
}

export function createCampaign(payload: CampaignCreate, token: string) {
  return apiFetch<CampaignRead>("/campaigns", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export function updateCampaign(
  campaignId: string,
  payload: CampaignUpdate,
  token: string,
) {
  return apiFetch<CampaignRead>(`/campaigns/${campaignId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export function publishCampaign(campaignId: string, token: string) {
  return apiFetch<CampaignRead>(`/campaigns/${campaignId}/publish`, {
    method: "POST",
    token,
  });
}

export function resolveCampaign(campaignId: string, token: string) {
  return apiFetch<CampaignRead>(`/campaigns/${campaignId}/resolve`, {
    method: "POST",
    token,
  });
}

export function cancelCampaign(campaignId: string, token: string) {
  return apiFetch<CampaignRead>(`/campaigns/${campaignId}/cancel`, {
    method: "POST",
    token,
  });
}

export function addCampaignMovie(
  campaignId: string,
  payload: CampaignMovieCreate,
  token: string,
) {
  return apiFetch<CampaignMovieRead>(`/campaigns/${campaignId}/movies`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export function removeCampaignMovie(
  campaignId: string,
  campaignMovieId: string,
  token: string,
) {
  return apiFetch<void>(`/campaigns/${campaignId}/movies/${campaignMovieId}`, {
    method: "DELETE",
    token,
  });
}

export function voteForCampaignMovie(
  campaignId: string,
  campaignMovieId: string,
  token: string,
) {
  return apiFetch<CampaignVoteRead>(`/campaigns/${campaignId}/votes`, {
    method: "POST",
    token,
    body: JSON.stringify({ campaign_movie_id: campaignMovieId }),
  });
}

export function createCampaignMovieCheckoutSession(
  campaignId: string,
  campaignMovieId: string,
  quantity: number,
  token: string,
  couponId?: string | null,
) {
  return apiFetch<CheckoutSessionRead>(
    `/campaigns/${campaignId}/movies/${campaignMovieId}/checkout-session`,
    {
      method: "POST",
      token,
      body: JSON.stringify({ quantity, coupon_id: couponId ?? null }),
    },
  );
}

export function getDiscoverCampaignCards(limit = 8, token?: string) {
  return apiFetch<CampaignDiscoverCardRead[]>(
    `/campaigns/discover-cards?limit=${limit}`,
    {
      method: "GET",
      token,
    },
  );
}
