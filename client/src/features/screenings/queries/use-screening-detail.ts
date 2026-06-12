import { useQuery } from "@tanstack/react-query";
import { getScreening } from "@/lib/api/screenings";
import { AUDIENCE_LIVE_REFETCH_INTERVAL_MS } from "@/lib/query/realtime";

export function useScreeningDetail(screeningId: string | undefined) {
  return useQuery({
    queryKey: ["screenings", "detail", screeningId],
    enabled: Boolean(screeningId),
    queryFn: () => {
      if (!screeningId) {
        throw new Error("Screening id is required.");
      }

      return getScreening(screeningId);
    },
    staleTime: 60_000,
    refetchInterval: AUDIENCE_LIVE_REFETCH_INTERVAL_MS,
  });
}
