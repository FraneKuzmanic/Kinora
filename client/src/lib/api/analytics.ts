import { apiFetch } from "@/lib/api/client";

export type CampaignFunnelItem = {
  campaign_id: string;
  campaign_title: string;
  views: number;
  votes: number;
  reservations: number;
  threshold: number;
  view_to_vote_rate: number;
  vote_to_reservation_rate: number;
};

export type CampaignFunnelRead = {
  total_views: number;
  total_votes: number;
  total_reservations: number;
  view_to_vote_rate: number;
  vote_to_reservation_rate: number;
  campaigns: CampaignFunnelItem[];
};

export type ScreeningHealthRead = {
  screening_id: string;
  title: string;
  starts_at: string;
  tickets_sold: number;
  min_tickets_to_confirm: number;
  days_left: number;
  projected_likelihood: number;
  risk_band: string;
  at_risk: boolean;
};

export type SlotCell = {
  dow: number;
  hour_bucket: number;
  avg_fill_rate: number;
  screening_count: number;
};

export type SlotSummary = {
  dow: number;
  hour_bucket: number;
  avg_fill_rate: number;
  label: string;
};

export type SlotPerformanceRead = {
  cells: SlotCell[];
  best_slots: SlotSummary[];
  worst_slots: SlotSummary[];
};

export type FilmDemandItem = {
  movie_id: string | null;
  title: string;
  vote_count: number;
  recommendation_count: number;
  has_screening: boolean;
};

export type GenreTrendItem = {
  genre_name: string;
  interaction_count: number;
};

export type ContentDemandRead = {
  most_voted: FilmDemandItem[];
  most_recommended: FilmDemandItem[];
  repeated_demand_no_screening: FilmDemandItem[];
  genre_trends: GenreTrendItem[];
};

export type RevenueMetricsRead = {
  confirmed_revenue_cents: number;
  pending_potential_cents: number;
  refund_count: number;
  cancelled_screening_count: number;
};

export type PrivateBookingDateStats = {
  date: string;
  request_count: number;
};

export type PrivateBookingTimeStats = {
  hour: string;
  request_count: number;
};

export type PrivateBookingAnalyticsRead = {
  request_count: number;
  approved_count: number;
  rejected_count: number;
  approval_rate: number;
  average_group_size: number | null;
  most_requested_dates: PrivateBookingDateStats[];
  most_requested_time_ranges: PrivateBookingTimeStats[];
};

type DateRangeParams = {
  start_date?: string;
  end_date?: string;
};

function buildQuery(params: DateRangeParams): string {
  const q = new URLSearchParams();
  if (params.start_date) q.set("start_date", params.start_date);
  if (params.end_date) q.set("end_date", params.end_date);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function getCampaignFunnel(token: string, params: DateRangeParams = {}) {
  return apiFetch<CampaignFunnelRead>(`/analytics/campaign-funnel${buildQuery(params)}`, { token });
}

export function getScreeningHealth(token: string) {
  return apiFetch<ScreeningHealthRead[]>("/analytics/screening-health", { token });
}

export function getSlotPerformance(token: string) {
  return apiFetch<SlotPerformanceRead>("/analytics/slot-performance", { token });
}

export function getContentDemand(token: string) {
  return apiFetch<ContentDemandRead>("/analytics/content-demand", { token });
}

export function getRevenue(token: string, params: DateRangeParams = {}) {
  return apiFetch<RevenueMetricsRead>(`/analytics/revenue${buildQuery(params)}`, { token });
}

export function getPrivateBookingAnalytics(token: string) {
  return apiFetch<PrivateBookingAnalyticsRead>("/analytics/private-bookings", { token });
}
