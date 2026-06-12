import { useQuery } from "@tanstack/react-query";
import { listMovies } from "@/lib/api/movies";

export function useMovieCatalog(enabled = true) {
  return useQuery({
    queryKey: ["movies", "catalog"],
    queryFn: listMovies,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
