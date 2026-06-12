import { apiFetch } from "@/lib/api/client";
import type { MovieRead } from "@/lib/api/movies";

export type TmdbMovieSearchResult = {
  tmdb_id: number;
  title: string;
  poster_url: string | null;
  release_year: number | null;
};

export function searchTmdbMovies(query: string, token: string) {
  return apiFetch<TmdbMovieSearchResult[]>(
    `/admin/movies/search?q=${encodeURIComponent(query)}`,
    {
      method: "GET",
      token,
    },
  );
}

export function syncTmdbMovie(tmdbId: number, token: string) {
  return apiFetch<MovieRead>(`/admin/movies/sync/${tmdbId}`, {
    method: "POST",
    token,
  });
}
