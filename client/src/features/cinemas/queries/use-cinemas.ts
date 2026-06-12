import { useQuery } from "@tanstack/react-query";
import { listCinemas } from "@/lib/api/cinemas";

export function useCinemas(enabled = true) {
  return useQuery({
    queryKey: ["cinemas"],
    queryFn: listCinemas,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
