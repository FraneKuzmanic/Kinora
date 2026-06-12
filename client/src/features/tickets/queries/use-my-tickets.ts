import { useQuery } from "@tanstack/react-query";
import { listMyTickets } from "@/lib/api/tickets";

export function useMyTickets(token: string | null) {
  return useQuery({
    queryKey: ["tickets", "me"],
    queryFn: () => {
      if (!token) {
        throw new Error("Authentication token is missing.");
      }

      return listMyTickets(token);
    },
    enabled: Boolean(token),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
