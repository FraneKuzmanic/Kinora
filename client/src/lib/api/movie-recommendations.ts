import { apiFetch } from "@/lib/api/client";

export type MovieRecommendationCreate = {
  movie_id?: string;
  cinema_id?: string;
  city_id?: string;
  title?: string;
  message?: string;
};

export type MovieRecommendationRead = {
  id: string;
  user_id: string | null;
  cinema_id: string | null;
  city_id: string | null;
  movie_id: string | null;
  title: string | null;
  message: string | null;
  status: string;
  created_at: string;
};

export function createMovieRecommendation(
  payload: MovieRecommendationCreate,
  token: string,
) {
  return apiFetch<MovieRecommendationRead>("/movie-recommendations", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}
