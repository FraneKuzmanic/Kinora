import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clapperboard,
  Clock3,
  MapPin,
  Popcorn,
  X,
} from "lucide-react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { CampaignDetailMovieCard } from "@/features/campaigns/components/CampaignDetailMovieCard";
import { ShareMenu } from "@/components/ShareMenu";
import { useAuth } from "@/features/auth/auth-context";
import { useCampaignDetail } from "@/features/campaigns/queries/use-campaign-detail";
import { env } from "@/config/env";
import {
  createCampaignMovieCheckoutSession,
  voteForCampaignMovie,
} from "@/lib/api/campaigns";
import { apiFetch } from "@/lib/api/client";
import { getMyLoyaltyWallet } from "@/lib/api/loyalty";

function getDeadlineTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatVotingCountdown(targetDate: string | null, now: number) {
  const deadline = getDeadlineTimestamp(targetDate);
  if (!deadline) {
    return { days: "00", hours: "00", minutes: "00", seconds: "00" };
  }

  const difference = Math.max(deadline - now, 0);
  const totalSeconds = Math.floor(difference / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days: String(days).padStart(2, "0"),
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  };
}

function formatSlot(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "TBA";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatLocation(locationName: string | null, cityName: string) {
  return locationName ?? cityName;
}

function CampaignDetailLoadingState() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="relative h-20 w-20">
        <div className="absolute inset-0 rounded-full border border-[rgba(223,197,106,0.18)]" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[var(--color-accent)] border-r-[var(--color-accent)]" />
        <div className="absolute inset-4 rounded-full border border-[rgba(223,197,106,0.24)]" />
        <div className="absolute inset-[26px] rounded-full bg-[rgba(223,197,106,0.16)] shadow-[0_0_24px_rgba(223,197,106,0.38)]" />
      </div>
    </div>
  );
}

export function CampaignDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { campaignId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [now, setNow] = useState(() => Date.now());
  const queryClient = useQueryClient();
  const { session, isAuthenticated } = useAuth();
  const { data: campaign, isLoading, isError } = useCampaignDetail(
    campaignId,
    session?.access_token,
  );
  const loyaltyQuery = useQuery({
    queryKey: ["loyalty", "me", session?.access_token],
    enabled: Boolean(session?.access_token),
    queryFn: () => getMyLoyaltyWallet(session?.access_token as string),
  });
  const earlyBirdPurchaseSucceeded =
    searchParams.get("purchase") === "early-bird-success";
  const earlyBirdPurchasedQuantity = searchParams.get("quantity") ?? "1";

  function dismissPurchaseSuccess() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("purchase");
    nextParams.delete("quantity");
    nextParams.delete("order_id");
    setSearchParams(nextParams, { replace: true });
  }

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!campaignId) return;
    apiFetch(`/campaigns/${campaignId}/view`, { method: "POST" }).catch(() => undefined);
  }, [campaignId]);

  const sortedMovies = useMemo(() => {
    if (!campaign) {
      return [];
    }

    return [...campaign.movies].sort((left, right) => {
      if (right.vote_count !== left.vote_count) {
        return right.vote_count - left.vote_count;
      }

      return left.sort_order - right.sort_order;
    });
  }, [campaign]);

  const leadingMovieId = sortedMovies[0]?.id ?? null;
  const countdown = formatVotingCountdown(
    campaign?.voting_ends_at ?? null,
    now,
  );
  const totalVotes = sortedMovies.reduce(
    (sum, movie) => sum + movie.vote_count,
    0,
  );
  const locationLabel = campaign
    ? formatLocation(campaign.location_name, campaign.city_name)
    : "";
  const campaignShareTitle = campaign
    ? `${campaign.title} on Kinora`
    : "Kinora campaign";
  const campaignShareText = campaign
    ? `Vote for what plays next at ${campaign.cinema_name} on Kinora.`
    : "Vote for what plays next on Kinora.";
  const effectiveMaxTickets = campaign
    ? campaign.max_tickets ?? campaign.hall_capacity
    : 0;
  const remainingEarlyBirdCapacity = campaign
    ? Math.max(effectiveMaxTickets - campaign.total_early_bird_tickets, 0)
    : 0;
  const isEarlyBirdSoldOut = campaign
    ? campaign.total_early_bird_tickets >= effectiveMaxTickets
    : false;
  const votingStart = getDeadlineTimestamp(campaign?.voting_starts_at ?? null);
  const votingDeadline = getDeadlineTimestamp(campaign?.voting_ends_at ?? null);
  const isVotingActive =
    campaign?.status === "voting" &&
    votingStart !== null &&
    votingDeadline !== null &&
    votingStart <= now &&
    votingDeadline > now;
  const isVotingClosed =
    !campaign ||
    !isVotingActive;

  const voteMutation = useMutation({
    mutationFn: async (campaignMovieId: string) => {
      if (!campaignId || !session?.access_token) {
        throw new Error("Login is required to vote.");
      }

      return voteForCampaignMovie(
        campaignId,
        campaignMovieId,
        session.access_token,
      );
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["campaigns", "detail", campaignId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["campaigns", "active-voting"],
        }),
      ]);
    },
    onError: (error) => {
      console.error("Vote submit failed", error);
    },
  });

  const earlyBirdMutation = useMutation({
    mutationFn: async ({
      campaignMovieId,
      quantity,
      couponId,
    }: {
      campaignMovieId: string;
      quantity: number;
      couponId: string | null;
    }) => {
      if (!campaignId || !session?.access_token) {
        throw new Error("Login is required to buy Early Bird tickets.");
      }

      return createCampaignMovieCheckoutSession(
        campaignId,
        campaignMovieId,
        quantity,
        session.access_token,
        couponId,
      );
    },
    onSuccess: (checkout) => {
      window.location.assign(checkout.checkout_url);
    },
    onError: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["campaigns", "detail", campaignId],
      });
    },
  });

  function handleVote(campaignMovieId: string) {
    if (!isAuthenticated) {
      navigate("/login", {
        state: {
          from: {
            pathname: location.pathname,
          },
        },
      });
      return;
    }

    if (isVotingClosed) {
      return;
    }

    voteMutation.mutate(campaignMovieId);
  }

  async function handleEarlyBirdCheckout(
    campaignMovieId: string,
    quantity: number,
    couponId: string | null,
  ) {
    if (!isAuthenticated) {
      navigate("/login", {
        state: {
          from: {
            pathname: location.pathname,
          },
        },
      });
      return;
    }

    if (isEarlyBirdSoldOut) {
      throw new Error("Early Bird tickets are sold out.");
    }

    if (quantity < 1 || quantity > remainingEarlyBirdCapacity) {
      throw new Error("Selected quantity exceeds the remaining capacity.");
    }

    await earlyBirdMutation.mutateAsync({ campaignMovieId, quantity, couponId });
  }

  return (
    <section className="relative min-h-screen overflow-hidden pb-24">
      <div className="pointer-events-none fixed inset-x-0 top-[-45vh] z-0 h-[190vh] w-[200vw] -translate-x-1/4 bg-[conic-gradient(from_180deg_at_50%_0%,transparent_42%,rgba(223,197,106,0.015)_47%,rgba(255,255,255,0.03)_50%,rgba(223,197,106,0.015)_53%,transparent_58%)] opacity-80" />
      <div className="pointer-events-none fixed bottom-0 left-6 top-0 z-0 hidden w-[4px] opacity-20 xl:block [background-image:linear-gradient(to_bottom,rgba(122,132,153,0.3)_0%,rgba(122,132,153,0.3)_4px,transparent_4px,transparent_16px)] [background-size:4px_16px]" />
      <div className="pointer-events-none fixed bottom-0 right-6 top-0 z-0 hidden w-[4px] opacity-20 xl:block [background-image:linear-gradient(to_bottom,rgba(122,132,153,0.3)_0%,rgba(122,132,153,0.3)_4px,transparent_4px,transparent_16px)] [background-size:4px_16px]" />

      <div className="relative z-10 mx-auto max-w-[1440px] px-[5vw]">
        <header className="flex flex-col gap-6 border-b border-[rgba(122,132,153,0.3)] py-12 md:flex-row md:items-center md:justify-between">
          <button
            type="button"
            onClick={() => navigate("/campaigns")}
            className="group flex w-fit cursor-pointer items-center gap-3 text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-dim)] transition-colors duration-300 hover:text-[var(--color-accent)]"
          >
            <span className="flex items-center gap-2 transition-[filter] duration-300 group-hover:drop-shadow-[0_0_10px_rgba(223,197,106,0.55)]">
              <ArrowLeft className="h-4 w-4" />
              <span>Now Voting</span>
            </span>
            <span>/</span>
            <span className="text-[var(--color-accent)]">Campaign Detail</span>
          </button>
        </header>

        {isLoading ? <CampaignDetailLoadingState /> : null}

        {isError ? (
          <div className="mt-12 rounded border border-[rgba(223,197,106,0.2)] bg-[rgba(27,34,49,0.55)] p-6 text-sm text-[var(--color-text-dim)]">
            Could not load this campaign.
          </div>
        ) : null}

        {campaign ? (
          <>
            <section className="grid gap-8 border-b border-[rgba(122,132,153,0.3)] py-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
              <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4 xl:items-end">
                <div className="flex min-w-0 flex-col justify-end gap-1">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[rgba(122,132,153,0.65)]">
                    Cinema
                  </span>
                  <span className="flex items-center gap-2 text-base font-medium text-white">
                    <Clapperboard className="h-4 w-4 text-[var(--color-accent)]" />
                    {campaign.cinema_name}
                  </span>
                </div>

                <div className="flex min-w-0 flex-col justify-end gap-1">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[rgba(122,132,153,0.65)]">
                    Location
                  </span>
                  <span className="flex items-center gap-2 text-base font-medium text-white">
                    <MapPin className="h-4 w-4 text-[var(--color-accent)]" />
                    {locationLabel}
                  </span>
                </div>

                <div className="flex min-w-0 flex-col justify-end gap-1">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[rgba(122,132,153,0.65)]">
                    Date
                  </span>
                  <span className="flex items-center gap-2 text-base font-medium text-white">
                    <Calendar className="h-4 w-4 text-[var(--color-accent)]" />
                    {formatSlot(campaign.slot_starts_at)}
                  </span>
                </div>

                <div className="flex min-w-0 flex-col justify-end gap-1">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[rgba(122,132,153,0.65)]">
                    Total Votes
                  </span>
                  <span className="flex items-center gap-2 text-base font-medium text-white">
                    <Popcorn className="h-4 w-4 text-[var(--color-accent)]" />
                    {totalVotes.toLocaleString("en-US")}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-4 xl:items-end">
                <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.14em] text-white xl:justify-end">
                  <span className="relative flex h-3 w-3 items-center justify-center">
                    <span className="absolute h-3 w-3 rounded-full bg-red-500" />
                    <span className="absolute h-6 w-6 animate-ping rounded-full border border-red-500/70" />
                  </span>
                  Voting Live
                </div>

                <div className="flex flex-col items-start xl:items-end">
                  <span className="mb-2 text-[10px] uppercase tracking-[0.2em] text-[rgba(122,132,153,0.65)]">
                    Ends In
                  </span>
                  <div className="flex items-center gap-2 font-display text-[2rem] leading-none tracking-[0.05em] text-[var(--color-accent)] sm:text-[2.5rem]">
                    <Clock3 className="mr-1 h-5 w-5 animate-pulse text-red-400" />
                    <span className="w-10 text-center">{countdown.days}</span>
                    <span className="translate-y-[-2px] text-[1.5rem] text-[var(--color-text-dim)]">
                      :
                    </span>
                    <span className="w-10 text-center">{countdown.hours}</span>
                    <span className="translate-y-[-2px] text-[1.5rem] text-[var(--color-text-dim)]">
                      :
                    </span>
                    <span className="w-10 text-center">
                      {countdown.minutes}
                    </span>
                    <span className="translate-y-[-2px] text-[1.5rem] text-[var(--color-text-dim)]">
                      :
                    </span>
                    <span className="w-10 text-center">
                      {countdown.seconds}
                    </span>
                  </div>
                </div>

                <ShareMenu
                  title={campaignShareTitle}
                  text={campaignShareText}
                  path={
                    campaignId
                      ? `${env.shareBaseUrl}/share/campaigns/${campaignId}`
                      : undefined
                  }
                  align="right"
                  className="self-start xl:self-end"
                />
              </div>
            </section>

            <section className="relative py-14">
              <h1 className="font-display text-[4rem] uppercase leading-[0.88] text-white sm:text-[5.5rem] lg:text-[7rem]">
                Choose Your
                <br />
                Film
              </h1>
              <p className="mt-6 max-w-3xl font-heading text-xl italic leading-relaxed text-[var(--color-text-dim)] sm:text-2xl">
                Pick your favorite film by casting your deciding vote. Each vote
                helps shape what reaches the cinema screen next.
              </p>
            </section>

            {earlyBirdPurchaseSucceeded ? (
              <div className="mb-10 flex items-start justify-between gap-4 border border-[rgba(223,197,106,0.32)] bg-[linear-gradient(135deg,rgba(223,197,106,0.12),rgba(27,34,49,0.72))] px-5 py-4 text-white shadow-[0_18px_36px_rgba(0,0,0,0.22)]">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-[var(--color-accent)]" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
                      Early Bird Confirmed
                    </p>
                    <p className="mt-1 text-sm leading-6 text-white/92">
                      {earlyBirdPurchasedQuantity} Early Bird{" "}
                      {earlyBirdPurchasedQuantity === "1"
                        ? "ticket was"
                        : "tickets were"}{" "}
                      purchased successfully. This purchase now contributes to
                      the campaign outcome.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={dismissPurchaseSuccess}
                  className="cursor-pointer text-[var(--color-text-dim)] transition-colors duration-300 hover:text-[var(--color-accent)]"
                  aria-label="Dismiss purchase confirmation"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            <section className="mx-auto grid grid-cols-1 gap-x-20 gap-y-20 pb-24 xl:grid-cols-2">
              {sortedMovies.map((movie, index) => (
                <CampaignDetailMovieCard
                  key={movie.id}
                  movie={movie}
                  rank={index + 1}
                  isLeading={movie.id === leadingMovieId}
                  isSelected={
                    campaign.current_user_vote_campaign_movie_id === movie.id
                  }
                  isVotingClosed={isVotingClosed}
                  isEarlyBirdSoldOut={isVotingClosed || isEarlyBirdSoldOut}
                  remainingEarlyBirdCapacity={remainingEarlyBirdCapacity}
                  ticketPriceCents={campaign.ticket_price_cents}
                  availableCoupons={loyaltyQuery.data?.coupons ?? []}
                  isVotePending={voteMutation.isPending}
                  isSubmittingThisMovie={
                    voteMutation.isPending &&
                    voteMutation.variables === movie.id
                  }
                  isEarlyBirdPending={earlyBirdMutation.isPending}
                  isSubmittingEarlyBirdForThisMovie={
                    earlyBirdMutation.isPending &&
                    earlyBirdMutation.variables?.campaignMovieId === movie.id
                  }
                  onVote={handleVote}
                  onEarlyBirdCheckout={handleEarlyBirdCheckout}
                />
              ))}
            </section>
          </>
        ) : null}
      </div>
    </section>
  );
}
