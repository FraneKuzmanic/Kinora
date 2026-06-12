import { useQuery } from "@tanstack/react-query";
import { listScreenings, type ScreeningRead } from "@/lib/api/screenings";
import { AUDIENCE_LIST_REFETCH_INTERVAL_MS } from "@/lib/query/realtime";

const UPCOMING_SCREENING_STATUSES = new Set<ScreeningRead["status"]>([
  "selling",
  "confirmed",
]);

export function useUpcomingScreenings(limit = 10) {
  return useQuery({
    queryKey: ["screenings", "upcoming", limit],
    queryFn: () => listScreenings({ activeOnly: true, limit }),
    staleTime: 60_000,
    refetchInterval: AUDIENCE_LIST_REFETCH_INTERVAL_MS,
    select: (screenings) => {
      const now = Date.now();

      return screenings
        .filter((screening) => {
          const startsAt = new Date(screening.starts_at).getTime();

          return (
            UPCOMING_SCREENING_STATUSES.has(screening.status) &&
            Number.isFinite(startsAt) &&
            startsAt >= now
          );
        })
        .sort(
          (left, right) =>
            new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime(),
        )
        .slice(0, limit);
    },
  });
}
