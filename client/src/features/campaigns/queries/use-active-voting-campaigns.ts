import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getDiscoverCampaignCards,
  type CampaignDiscoverCardRead,
} from "@/lib/api/campaigns";
import { AUDIENCE_LIST_REFETCH_INTERVAL_MS } from "@/lib/query/realtime";

export function useActiveVotingCampaigns(limit = 8, token?: string) {
  const queryClient = useQueryClient();
  const tokenKey = token ?? "anonymous";

  return useQuery({
    queryKey: ["campaigns", "active-voting", limit, tokenKey],
    staleTime: 60_000,
    refetchInterval: AUDIENCE_LIST_REFETCH_INTERVAL_MS,
    placeholderData: (previousData) =>
      previousData ??
      (limit > 8
        ? queryClient.getQueryData<CampaignDiscoverCardRead[]>([
            "campaigns",
            "active-voting",
            8,
            tokenKey,
          ])
        : undefined),
    queryFn: () => getDiscoverCampaignCards(limit, token),
  });
}
