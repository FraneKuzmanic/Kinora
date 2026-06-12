import { apiFetch } from "@/lib/api/client";

export type MovieRead = {
  id: string;
  title: string;
  original_title: string | null;
  release_year: number | null;
  runtime_minutes: number | null;
  overview: string | null;
  poster_url: string | null;
  trailer_url: string | null;
  language_code: string | null;
  country_code: string | null;
  tmdb_id: number | null;
  created_at: string;
};

export function listMovies() {
  return apiFetch<MovieRead[]>("/movies", {
    method: "GET",
  });
}
