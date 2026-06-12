import { useQuery } from "@tanstack/react-query";
import { getCampaign } from "@/lib/api/campaigns";
import { AUDIENCE_LIVE_REFETCH_INTERVAL_MS } from "@/lib/query/realtime";

export function useCampaignDetail(
  campaignId: string | undefined,
  token?: string,
) {
  return useQuery({
    queryKey: ["campaigns", "detail", campaignId, Boolean(token)],
    enabled: Boolean(campaignId),
    staleTime: 60_000,
    refetchInterval: AUDIENCE_LIVE_REFETCH_INTERVAL_MS,
    queryFn: () => getCampaign(campaignId as string, token),
  });
}
