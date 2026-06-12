import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Clock3,
  Crown,
  Search,
  Users,
} from "lucide-react";
import { useNavigate, useOutletContext } from "react-router-dom";
import type { RootLayoutOutletContext } from "@/app/routes/root-layout";
import type {
  CampaignDiscoverCardRead,
  CampaignDiscoverMovieRead,
} from "@/lib/api/campaigns";
import { tmdbImageUrl } from "@/lib/images";
import { useAuth } from "@/features/auth/auth-context";
import { VotingCampaignCard } from "@/features/campaigns/components/VotingCampaignCard";
import { VotingPageHero } from "@/features/campaigns/components/VotingPageHero";
import { useActiveVotingCampaigns } from "@/features/campaigns/queries/use-active-voting-campaigns";

type SortOption = "ending" | "popular" | "newest" | "slot";
type FilterPreset = "all" | "popular" | "newest";

const FILTER_PRESETS: Array<{
  id: FilterPreset;
  label: string;
}> = [
  {
    id: "all",
    label: "All",
  },
  {
    id: "popular",
    label: "Popular",
  },
  {
    id: "newest",
    label: "Newly Added",
  },
];

function getDeadlineTimestamp(value: string | null) {
  if (!value) {
    return Number.MAX_SAFE_INTEGER;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function getCreatedTimestamp(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getSlotTimestamp(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function buildPosterStack(movies: CampaignDiscoverMovieRead[]) {
  const leadingMovie = movies.find((movie) => movie.is_leading) ?? null;
  if (!leadingMovie) {
    return [];
  }

  const supportingMovies = movies
    .filter((movie) => movie.id !== leadingMovie.id)
    .sort((left, right) => left.sort_order - right.sort_order)
    .slice(0, 3);

  return [...supportingMovies, leadingMovie];
}

function formatCampaignSlot(startsAt: string) {
  const slotDate = new Date(startsAt);
  if (Number.isNaN(slotDate.getTime())) {
    return "TBA";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(slotDate);
}

function formatCompactCountdown(targetDate: string | null, now: number) {
  if (!targetDate) {
    return "Voting closed";
  }

  const deadline = new Date(targetDate).getTime();
  if (!Number.isFinite(deadline)) {
    return "Voting closed";
  }

  const difference = Math.max(deadline - now, 0);
  const totalSeconds = Math.floor(difference / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours.toString().padStart(2, "0")}h ${minutes
      .toString()
      .padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
  }

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function sortCampaigns(
  campaigns: CampaignDiscoverCardRead[],
  sortBy: SortOption,
) {
  return [...campaigns].sort((left, right) => {
    if (sortBy === "popular") {
      return right.total_voters - left.total_voters;
    }

    if (sortBy === "newest") {
      return (
        getCreatedTimestamp(right.created_at) -
        getCreatedTimestamp(left.created_at)
      );
    }

    if (sortBy === "slot") {
      return (
        getSlotTimestamp(left.slot_starts_at) -
        getSlotTimestamp(right.slot_starts_at)
      );
    }

    return (
      getDeadlineTimestamp(left.voting_ends_at) -
      getDeadlineTimestamp(right.voting_ends_at)
    );
  });
}

function CampaignsLoadingState() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border border-[rgba(223,197,106,0.2)]" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[var(--color-accent)] border-r-[var(--color-accent)]" />
        <div className="absolute inset-3 rounded-full border border-[rgba(223,197,106,0.25)]" />
        <div className="absolute inset-[18px] rounded-full bg-[rgba(223,197,106,0.18)] shadow-[0_0_24px_rgba(223,197,106,0.35)]" />
      </div>
    </div>
  );
}

function FeaturedLargeCard({
  campaign,
  now,
  onClick,
}: {
  campaign: CampaignDiscoverCardRead;
  now: number;
  onClick: () => void;
}) {
  const posterStack = buildPosterStack(campaign.movies);
  const leadingMovie =
    campaign.movies.find((movie) => movie.is_leading) ?? null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex cursor-pointer flex-col gap-5 overflow-hidden border border-[rgba(223,197,106,0.3)] bg-[var(--color-bg-main)] p-4 text-left transition-all duration-500 hover:border-[rgba(223,197,106,0.8)] hover:shadow-[0_0_50px_rgba(223,197,106,0.2)] md:flex-row lg:col-span-2"
    >
      <div className="flex items-center absolute top-0 right-0 border-b border-l border-[rgba(239,68,68,0.4)] bg-[rgba(239,68,68,0.18)] px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-[#f87171] backdrop-blur-md">
        <Clock3 className="mr-2 h-4 w-4 animate-pulse" />
        {formatCompactCountdown(campaign.voting_ends_at, now)}
      </div>

      <div
        className="relative flex w-full flex-shrink-0 items-end justify-center md:w-52 lg:w-56"
        style={{ aspectRatio: "5 / 7" }}
      >
        <div className="relative h-full w-full [perspective:1200px]">
          {posterStack.map((movie, index) => {
            const stackStyles = [
              "absolute inset-0 m-auto h-[76%] w-[58%] origin-bottom rounded border border-white/5 object-cover shadow-lg brightness-[0.25] transition-all duration-700 -rotate-[12deg] -translate-x-8 translate-y-2 group-hover:-rotate-[20deg] group-hover:-translate-x-12 group-hover:translate-y-4 z-10",
              "absolute inset-0 m-auto h-[81%] w-[63%] origin-bottom rounded border border-white/10 object-cover shadow-lg brightness-[0.35] transition-all duration-700 rotate-[8deg] translate-x-6 translate-y-1 group-hover:rotate-[15deg] group-hover:translate-x-10 group-hover:translate-y-2 z-20",
              "absolute inset-0 m-auto h-[86%] w-[68%] origin-bottom rounded border border-[rgba(223,197,106,0.2)] object-cover shadow-lg brightness-[0.5] transition-all duration-700 -rotate-[4deg] -translate-x-3 translate-y-0 group-hover:-rotate-[10deg] group-hover:-translate-x-5 group-hover:translate-y-1 z-[25]",
              "absolute inset-0 z-30 m-auto h-[90%] w-[72%] origin-bottom rounded border-2 border-[rgba(223,197,106,0.6)] object-cover shadow-2xl transition-all duration-700 group-hover:-translate-y-2 group-hover:scale-[1.03] group-hover:border-[var(--color-accent)] group-hover:shadow-[0_0_40px_rgba(223,197,106,0.35)]",
            ];

            return (
              <img
                key={movie.id}
                src={tmdbImageUrl(movie.movie_poster_url, "w185")}
                alt={movie.movie_title}
                loading="lazy"
                decoding="async"
                className={
                  stackStyles[index] ?? stackStyles[stackStyles.length - 1]
                }
              />
            );
          })}
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between py-2">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full border border-[rgba(223,197,106,0.3)] px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-[var(--color-accent)]">
              <Crown className="h-3 w-3 fill-current" />
              Leading Movie
            </span>
            <span className="flex items-center gap-1 text-xs text-[var(--color-text-dim)]">
              <Users className="h-3 w-3 text-[var(--color-accent)]" />
              {campaign.total_voters.toLocaleString("en-US")} voters
            </span>
          </div>
          <h3 className="font-heading mb-2 text-3xl leading-tight text-white transition-colors duration-300 group-hover:text-[var(--color-accent)] md:text-4xl">
            {leadingMovie?.movie_title ?? campaign.leading_movie_title}
          </h3>
          <p className="mb-4 max-w-md text-sm leading-relaxed text-[var(--color-text-dim)]">
            Open the campaign to compare the competing films and cast a decisive
            vote before the window closes.
          </p>
          <div className="mb-5 grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
                Cinema
              </span>
              <span className="text-white">{campaign.cinema_name}</span>
            </div>
            <div>
              <span className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
                Date
              </span>
              <span className="text-white">
                {formatCampaignSlot(campaign.slot_starts_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 bg-[var(--color-accent)] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-bg-primary)]">
            View Campaign
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </button>
  );
}

function SmallFeaturedCard({
  campaign,
  now,
  onClick,
}: {
  campaign: CampaignDiscoverCardRead;
  now: number;
  onClick: () => void;
}) {
  const posterStack = buildPosterStack(campaign.movies);
  const leadingMovie =
    campaign.movies.find((movie) => movie.is_leading) ?? null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex cursor-pointer gap-4 rounded-sm border border-[rgba(223,197,106,0.3)] bg-[var(--color-bg-main)] p-4 text-left transition-all duration-500 hover:border-[rgba(223,197,106,0.8)] hover:shadow-[0_0_40px_rgba(223,197,106,0.15)]"
    >
      <div className="flex items-center absolute top-0 right-0 border-b border-l border-[rgba(239,68,68,0.4)] bg-[rgba(239,68,68,0.18)] px-3 py-1.5 text-[9px] font-medium uppercase tracking-widest text-[#f87171] backdrop-blur-md">
        <Clock3 className="mr-2 h-4 w-4 animate-pulse" />
        {formatCompactCountdown(campaign.voting_ends_at, now)}
      </div>

      <div className="relative h-32 w-24 flex-shrink-0 [perspective:1000px]">
        {posterStack.map((movie, index) => {
          const stackStyles = [
            "absolute inset-0 h-full w-full rounded border border-[rgba(223,197,106,0.22)] object-cover shadow-lg brightness-[0.3] transition-all duration-500 -translate-x-2.5 translate-y-1 -rotate-6 group-hover:-translate-x-5 group-hover:-translate-y-0.5 group-hover:-rotate-[12deg] z-10",
            "absolute inset-0 h-full w-full rounded border border-[rgba(223,197,106,0.22)] object-cover shadow-lg brightness-[0.45] transition-all duration-500 -translate-x-1 rotate-[-2deg] group-hover:-translate-x-2.5 group-hover:-translate-y-0.5 group-hover:-rotate-[8deg] z-20",
            "absolute inset-0 h-full w-full rounded border border-[rgba(223,197,106,0.24)] object-cover shadow-lg brightness-[0.6] transition-all duration-500 translate-x-1.5 rotate-[3deg] group-hover:translate-x-3 group-hover:-translate-y-0.5 group-hover:rotate-[10deg] z-[25]",
            "absolute inset-0 h-full w-full rounded border border-[rgba(223,197,106,0.5)] object-cover shadow-xl transition-all duration-500 group-hover:-translate-y-1 group-hover:translate-x-4 group-hover:rotate-[16deg] group-hover:border-[var(--color-accent)] z-30",
          ];

          return (
            <img
              key={movie.id}
              src={tmdbImageUrl(movie.movie_poster_url, "w185")}
              alt={movie.movie_title}
              loading="lazy"
              decoding="async"
              className={
                stackStyles[index] ?? stackStyles[stackStyles.length - 1]
              }
            />
          );
        })}
      </div>

      <div className="flex flex-1 flex-col justify-between py-1">
        <div>
          <h3 className="font-heading mb-1 text-lg text-white transition-colors duration-300 group-hover:text-[var(--color-accent)]">
            {leadingMovie?.movie_title ?? campaign.leading_movie_title}
          </h3>
          <p className="mb-2 flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-widest text-[var(--color-accent)]">
            <Crown className="h-2.5 w-2.5 fill-current" />
            Leading Movie
          </p>
          <div className="mb-2 flex items-center gap-2 text-[12px] text-[var(--color-text-dim)]">
            <span>{campaign.cinema_name}</span>
            <span className="text-[rgba(223,197,106,0.5)]">•</span>
            <span>{formatCampaignSlot(campaign.slot_starts_at)}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-[var(--color-accent)]">
            <Users className="h-3 w-3" />
            <span>{campaign.total_voters.toLocaleString("en-US")} voters</span>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute right-3 bottom-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <span className="flex items-center gap-1.5 bg-[var(--color-accent)] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--color-bg-primary)] shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
          View Campaign
          <ArrowRight className="h-2.5 w-2.5" />
        </span>
      </div>
    </button>
  );
}

export function CampaignsPage() {
  const navigate = useNavigate();
  const { searchQuery } = useOutletContext<RootLayoutOutletContext>();
  const { session } = useAuth();
  const [filterText, setFilterText] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("ending");
  const [preset, setPreset] = useState<FilterPreset>("all");
  const [visibleCount, setVisibleCount] = useState(6);
  const [isScrolled, setIsScrolled] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const {
    data: activeCampaigns = [],
    isLoading,
    isError,
  } = useActiveVotingCampaigns(48, session?.access_token);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 96);
    };

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.clearInterval(interval);
    };
  }, []);

  const featuredCampaigns = useMemo(() => {
    return [...activeCampaigns]
      .sort(
        (left, right) =>
          getDeadlineTimestamp(left.voting_ends_at) -
          getDeadlineTimestamp(right.voting_ends_at),
      )
      .slice(0, 3);
  }, [activeCampaigns]);

  const visibleCampaigns = useMemo(() => {
    const normalizedQuery = `${searchQuery} ${filterText}`.trim().toLowerCase();
    const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

    let filtered = activeCampaigns.filter((campaign) => {
      if (queryTokens.length === 0) {
        return true;
      }

      const searchableText = [
        campaign.leading_movie_title,
        campaign.cinema_name,
        campaign.city_name,
        ...campaign.movies.map((movie) => movie.movie_title),
      ]
        .join(" ")
        .toLowerCase();

      return queryTokens.every((token) => searchableText.includes(token));
    });

    if (preset === "popular") {
      const sortedByVoters = [...filtered].sort(
        (left, right) => right.total_voters - left.total_voters,
      );
      filtered = sortedByVoters.slice(0, Math.min(6, sortedByVoters.length));
    } else if (preset === "newest") {
      filtered = [...filtered]
        .sort(
          (left, right) =>
            getCreatedTimestamp(right.created_at) -
            getCreatedTimestamp(left.created_at),
        )
        .slice(0, Math.min(6, filtered.length));
    }

    return sortCampaigns(filtered, sortBy);
  }, [activeCampaigns, filterText, now, preset, searchQuery, sortBy]);

  useEffect(() => {
    setVisibleCount(6);
  }, [filterText, preset, searchQuery, sortBy]);

  const displayedCampaigns = useMemo(
    () => visibleCampaigns.slice(0, visibleCount),
    [visibleCampaigns, visibleCount],
  );

  return (
    <section className="w-full max-w-full overflow-x-hidden pb-24">
      <VotingPageHero />

      <section className="mx-auto w-full max-w-7xl px-4 sm:px-8">
        {isLoading ? <CampaignsLoadingState /> : null}

        {!isLoading && !isError ? (
          <section className="mb-16">
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                <h2 className="font-display text-2xl uppercase tracking-wider text-white md:text-3xl">
                  Ending Soon
                </h2>
              </div>
              <span className="text-sm text-[var(--color-text-dim)]">
                {featuredCampaigns.length} campaigns need your vote
              </span>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredCampaigns.map((campaign, index) => (
                <VotingCampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  now={now}
                  delayMs={index * 100}
                  onViewCampaign={() => navigate(`/campaigns/${campaign.id}`)}
                />
              ))}
            </div>
          </section>
        ) : null}
      </section>

      {!isLoading && !isError ? (
        <div
          className={`mb-8 border-y py-3 transition-all duration-300 sm:py-4 ${
            isScrolled
              ? "border-[rgba(223,197,106,0.5)]"
              : "border-[rgba(223,197,106,0.3)]"
          }`}
          style={{ backgroundColor: "rgba(19, 26, 39, 0.72)" }}
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-8">
            <div className="flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-center">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-2 text-[10px] uppercase tracking-widest text-[var(--color-text-dim)]">
                  Filter:
                </span>
                {FILTER_PRESETS.map((option) => {
                  const isActive = preset === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setPreset(option.id)}
                      className={`cursor-pointer rounded-full px-3 py-1.5 text-[12px] font-medium uppercase tracking-[0.08em] transition-all duration-300 ${
                        isActive
                          ? "bg-[var(--color-accent)] text-[var(--color-bg-primary)] shadow-[0_0_15px_rgba(223,197,106,0.4)]"
                          : "border border-[rgba(223,197,106,0.4)] bg-[rgba(27,34,49,0.6)] text-white hover:border-[rgba(223,197,106,0.7)]"
                      }`}
                      style={{ fontSize: "12px", letterSpacing: "0.08em" }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <div className="grid w-full gap-3 sm:grid-cols-[minmax(0,1fr)_auto] lg:w-auto lg:grid-cols-[15rem_auto]">
                <div className="group relative min-w-0">
                  <Search className="absolute left-4 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-dim)] transition-colors group-focus-within:text-[var(--color-accent)]" />
                  <input
                    type="text"
                    placeholder="Search campaigns..."
                    value={filterText}
                    onChange={(event) => setFilterText(event.target.value)}
                    className="h-11 w-full rounded-sm border border-[rgba(223,197,106,0.4)] bg-[rgba(27,34,49,0.5)] pl-11 pr-4 text-[11px] text-white outline-none transition-colors placeholder:text-[rgba(122,132,153,0.6)] focus:border-[var(--color-accent)]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-dim)]">
                    Sort:
                  </span>
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(event) =>
                        setSortBy(event.target.value as SortOption)
                      }
                      className="h-11 cursor-pointer appearance-none rounded-sm border border-[rgba(223,197,106,0.4)] bg-[rgba(27,34,49,0.6)] px-4 pr-9 text-[12px] uppercase tracking-[0.08em] text-white outline-none transition-colors hover:bg-[var(--color-bg-main)] focus:border-[var(--color-accent)]"
                      style={{ fontSize: "12px", letterSpacing: "0.08em" }}
                    >
                      <option value="ending">Ending Soon</option>
                      <option value="popular">Most Voters</option>
                      <option value="newest">Newest</option>
                      <option value="slot">Screening Date</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-accent)]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <section className="mx-auto w-full max-w-7xl px-4 sm:px-8">
        {!isLoading && !isError ? (
          <section>
            <div className="mb-6 flex flex-col gap-4 border-b border-[rgba(223,197,106,0.2)] pb-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="font-heading text-3xl text-white">
                    All Active Campaigns
                  </h2>
                  <p className="mt-1 text-sm text-[var(--color-text-dim)]">
                    Browse the full live voting slate and open a campaign to
                    compare the films in play.
                  </p>
                </div>
                <p className="text-[12px] uppercase tracking-[0.24em] text-[rgba(223,197,106,0.72)]">
                  {visibleCampaigns.length} result
                  {visibleCampaigns.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-x-4 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
              {displayedCampaigns.map((campaign, index) => (
                <VotingCampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  now={now}
                  delayMs={Math.min(index, 5) * 100}
                  onViewCampaign={() => navigate(`/campaigns/${campaign.id}`)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {isError ? (
          <div className="rounded border border-[rgba(223,197,106,0.2)] bg-[rgba(27,34,49,0.55)] p-6 text-sm text-[var(--color-text-dim)]">
            Could not load active voting campaigns.
          </div>
        ) : null}

        {!isLoading && !isError && visibleCampaigns.length === 0 ? (
          <div className="rounded border border-[rgba(223,197,106,0.2)] bg-[rgba(27,34,49,0.55)] p-6 text-sm text-[var(--color-text-dim)]">
            No campaigns match your filters.
          </div>
        ) : null}

        {!isLoading &&
        !isError &&
        displayedCampaigns.length < visibleCampaigns.length ? (
          <div className="mt-16 flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + 6)}
              className="group relative cursor-pointer overflow-hidden border border-[var(--color-accent)] bg-transparent px-8 py-3 transition-all duration-300"
            >
              <div className="absolute inset-0 scale-x-0 origin-left bg-[var(--color-accent)] transition-transform duration-500 ease-out group-hover:scale-x-100" />
              <span className="relative z-10 flex items-center gap-2 font-body text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)] transition-colors duration-300 group-hover:text-[var(--color-bg-primary)]">
                Load More
                <ChevronDown className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-y-0.5" />
              </span>
            </button>
          </div>
        ) : null}
      </section>
    </section>
  );
}
