import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listScreenings, type ScreeningRead } from "@/lib/api/screenings";
import { AUDIENCE_LIST_REFETCH_INTERVAL_MS } from "@/lib/query/realtime";

const PUBLIC_SCREENING_STATUSES = new Set<ScreeningRead["status"]>([
  "selling",
  "confirmed",
]);

export function useActiveScreenings() {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["screenings", "active"],
    queryFn: () => listScreenings({ activeOnly: true }),
    staleTime: 60_000,
    refetchInterval: AUDIENCE_LIST_REFETCH_INTERVAL_MS,
    placeholderData: () =>
      queryClient.getQueryData<ScreeningRead[]>(["screenings", "upcoming", 10]),
    select: (screenings) => {
      const now = Date.now();

      return screenings
        .filter((screening) => {
          const startsAt = new Date(screening.starts_at).getTime();
          return (
            PUBLIC_SCREENING_STATUSES.has(screening.status) &&
            Number.isFinite(startsAt) &&
            startsAt >= now
          );
        })
        .sort(
          (left, right) =>
            new Date(left.starts_at).getTime() -
            new Date(right.starts_at).getTime(),
        );
    },
  });
}
