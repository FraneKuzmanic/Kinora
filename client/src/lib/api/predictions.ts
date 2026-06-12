import { apiFetch } from "@/lib/api/client";

export type RiskBand = "green" | "yellow" | "red";
export type Confidence = "low" | "medium" | "high";

export type FilmSignals = {
  tmdb_popularity_score: number;
  platform_demand_score: number;
  genre_fit_score: number;
  novelty_score: number;
};

export type FilmScoreRead = {
  movie_id: string | null;
  tmdb_id: number;
  title: string;
  poster_url: string | null;
  score: number;
  confidence: Confidence;
  signals: FilmSignals;
  reason: string;
};

export type ScreeningPredictionRead = {
  probability_of_confirmation: number;
  risk_band: RiskBand;
  projected_tickets_at_decision: number;
  tickets_sold: number;
  tickets_remaining: number;
  current_progress: number;
  projected_progress: number;
  confidence: Confidence;
  label: string;
};

export type AttendancePredictionRequest = {
  hall_id: string;
  tmdb_id?: number;
  movie_id?: string;
  starts_at: string;
};

export type AttendancePredictionResponse = {
  predicted_attendance: number;
  predicted_fill_rate: number;
  suggested_threshold: number;
  risk_band: RiskBand;
  best_slot_hint: string;
};

export function getScreeningPrediction(screeningId: string) {
  return apiFetch<ScreeningPredictionRead>(`/predictions/screening/${screeningId}`);
}

export function predictAttendance(body: AttendancePredictionRequest, token: string) {
  return apiFetch<AttendancePredictionResponse>("/predictions/attendance", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function getCinemaRecommendations(cinemaId: string, token: string) {
  return apiFetch<FilmScoreRead[]>(`/cinemas/${cinemaId}/recommendations`, {
    method: "GET",
    token,
  });
}
