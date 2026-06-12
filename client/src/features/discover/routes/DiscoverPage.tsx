import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Award,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Crown,
  Film,
  MapPin,
  Send,
  Users,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useOutletContext } from "react-router-dom";
import type { RootLayoutOutletContext } from "@/app/routes/root-layout";
import { ShareMenu } from "@/components/ShareMenu";
import { DiscoverHeroCameraOrnament } from "@/components/icons/DiscoverHeroCameraOrnament";
import { DiscoverHeroClapperboardOrnament } from "@/components/icons/DiscoverHeroClapperboardOrnament";
import { env } from "@/config/env";
import type {
  CampaignDiscoverCardRead,
  CampaignDiscoverMovieRead,
} from "@/lib/api/campaigns";
import { getDiscoverCampaignCards } from "@/lib/api/campaigns";
import type { CinemaRead } from "@/lib/api/cinemas";
import { tmdbImageUrl } from "@/lib/images";
import type { MovieRead } from "@/lib/api/movies";
import { createMovieRecommendation } from "@/lib/api/movie-recommendations";
import { listScreenings, type ScreeningRead } from "@/lib/api/screenings";
import { useAuth } from "@/features/auth/auth-context";
import { VotingCampaignCard } from "@/features/campaigns/components/VotingCampaignCard";
import { useActiveVotingCampaigns } from "@/features/campaigns/queries/use-active-voting-campaigns";
import { useCinemas } from "@/features/cinemas/queries/use-cinemas";
import { useMovieCatalog } from "@/features/movies/queries/use-movie-catalog";
import { useUpcomingScreenings } from "@/features/screenings/queries/use-upcoming-screenings";

function LocationMeta({ label }: { label: string }) {
  return (
    <div className="flex items-center text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
      <MapPin className="marquee-glow mr-1.5 h-2.5 w-2.5 text-[var(--color-accent)]" />
      {label}
    </div>
  );
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

function formatCountdown(targetDate: string, now: number) {
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

  return `${days}d ${hours.toString().padStart(2, "0")}h ${minutes
    .toString()
    .padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
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

function CampaignLoadingSpinner() {
  return (
    <div className="flex w-full items-center justify-center py-20">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border border-[rgba(223,197,106,0.2)]" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[var(--color-accent)] border-r-[var(--color-accent)]" />
        <div className="absolute inset-3 rounded-full border border-[rgba(223,197,106,0.25)]" />
        <div className="absolute inset-[18px] rounded-full bg-[rgba(223,197,106,0.18)] shadow-[0_0_24px_rgba(223,197,106,0.35)]" />
      </div>
    </div>
  );
}

function CampaignCard({
  campaign,
  now,
  onClick,
}: {
  campaign: CampaignDiscoverCardRead;
  now: number;
  onClick: () => void;
}) {
  const leadingMovie =
    campaign.movies.find((movie) => movie.is_leading) ?? null;
  const posterStack = buildPosterStack(campaign.movies);
  const countdownLabel = campaign.voting_ends_at
    ? formatCountdown(campaign.voting_ends_at, now)
    : "Voting closed";

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex w-[280px] flex-shrink-0 cursor-pointer flex-col items-center border border-[rgba(223,197,106,0.3)] bg-[var(--color-bg-main)] p-5 text-left shadow-xl transition-all duration-500 hover:border-[var(--color-accent)] hover:shadow-[0_0_40px_rgba(223,197,106,0.15)]"
    >
      <div className="relative z-10 mb-5 mt-4 h-60 w-44 [perspective:1000px]">
        {posterStack.map((movie, index) => {
          const stackStyles = [
            "absolute inset-0 z-10 h-full w-full -translate-x-7 translate-y-1 -rotate-6 rounded border border-[rgba(223,197,106,0.3)] object-cover shadow-lg brightness-[0.35] transition-all duration-500 group-hover:-translate-x-14 group-hover:-translate-y-2 group-hover:-rotate-[22deg] group-hover:brightness-[0.6]",
            "absolute inset-0 z-20 h-full w-full -translate-x-2 rotate-[-2deg] rounded border border-[rgba(223,197,106,0.3)] object-cover shadow-lg brightness-[0.5] transition-all duration-500 group-hover:-translate-x-6 group-hover:-translate-y-1 group-hover:-rotate-[12deg] group-hover:brightness-[0.8]",
            "absolute inset-0 z-[25] h-full w-full translate-x-4 translate-y-1 rotate-[3deg] rounded border border-[rgba(223,197,106,0.3)] object-cover shadow-lg brightness-[0.65] transition-all duration-500 group-hover:-translate-y-1 group-hover:translate-x-10 group-hover:rotate-[12deg] group-hover:brightness-[0.9]",
            "absolute inset-0 z-30 h-full w-full rounded border-2 border-[rgba(223,197,106,0.6)] object-cover shadow-2xl transition-all duration-500 group-hover:-translate-y-2 group-hover:translate-x-14 group-hover:rotate-[22deg] group-hover:border-[var(--color-accent)]",
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

        <span className="pointer-events-none absolute bottom-3 left-1/2 z-40 flex -translate-x-1/2 translate-y-2 scale-[0.96] items-center justify-center gap-2 whitespace-nowrap border border-[rgba(223,197,106,0.38)] bg-[rgba(12,16,24,0.82)] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-accent)] opacity-0 backdrop-blur-sm transition-all duration-500 group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 group-hover:shadow-[0_10px_22px_rgba(0,0,0,0.28)] group-focus-visible:translate-y-0 group-focus-visible:scale-100 group-focus-visible:opacity-100">
          View Campaign
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>

      <div className="mb-4 w-full text-center">
        <h3 className="font-heading text-xl leading-tight text-white transition-colors duration-300 group-hover:text-[var(--color-accent)]">
          {leadingMovie?.movie_title ?? "Leading film"}
        </h3>
        <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-[var(--color-accent)]">
          <Crown className="h-3 w-3 fill-current" />
          Leading
        </p>
      </div>

      <div className="w-full space-y-3 rounded-lg border border-white/5 bg-[rgba(19,26,39,0.4)] p-4 text-xs">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
            <Users className="h-3.5 w-3.5 text-[var(--color-accent)]" />
            Total Voters
          </span>
          <span className="text-base font-semibold text-[var(--color-accent)]">
            {campaign.total_voters.toLocaleString("en-US")}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
            <MapPin className="h-3.5 w-3.5 text-[var(--color-accent)]" />
            Cinema
          </span>
          <span className="justify-self-end text-right text-[12px] leading-snug text-white">
            {campaign.cinema_name}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
            <CalendarDays className="h-3.5 w-3.5 text-[var(--color-accent)]" />
            Date
          </span>
          <span className="text-[12px] text-white">
            {formatCampaignSlot(campaign.slot_starts_at)}
          </span>
        </div>
      </div>

      <div className="mt-5 flex w-full items-center justify-center border-t border-[rgba(223,197,106,0.3)] pt-4">
        <div className="flex flex-col items-center">
          <span className="mb-1 text-[9px] uppercase tracking-widest text-[var(--color-text-dim)]">
            Voting Ends In
          </span>
          <div className="flex items-center font-mono text-sm font-semibold text-[var(--color-accent)]">
            <Clock3 className="mr-2 h-3.5 w-3.5 animate-pulse text-[var(--color-accent)]" />
            {countdownLabel}
          </div>
        </div>
      </div>
    </button>
  );
}

function formatUpcomingTime(startsAt: string) {
  const screeningDate = new Date(startsAt);
  if (Number.isNaN(screeningDate.getTime())) {
    return "Coming soon";
  }

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfScreeningDay = new Date(
    screeningDate.getFullYear(),
    screeningDate.getMonth(),
    screeningDate.getDate(),
  );
  const dayDifference = Math.round(
    (startOfScreeningDay.getTime() - startOfToday.getTime()) / 86_400_000,
  );

  const timeLabel = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(screeningDate);

  if (dayDifference === 0) {
    return `Today ${timeLabel}`;
  }

  if (dayDifference === 1) {
    return `Tomorrow ${timeLabel}`;
  }

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(screeningDate);

  return `${dateLabel} ${timeLabel}`;
}

function ScreeningLocation({ screening }: { screening: ScreeningRead }) {
  const parts = [
    screening.cinema_name,
    screening.location_name ?? screening.city_name,
  ].filter(Boolean);

  return <LocationMeta label={parts.join(", ")} />;
}

function ScreeningCard({
  screening,
  onClick,
}: {
  screening: ScreeningRead;
  onClick: () => void;
}) {
  const posterUrl = tmdbImageUrl(screening.movie_poster_url, "w342");
  const titleWithYear = screening.movie_release_year
    ? `${screening.movie_title} (${screening.movie_release_year})`
    : screening.movie_title;
  const screeningShareTitle = `${screening.movie_title} on Kinora`;
  const screeningShareText = `Help ${screening.movie_title} reach the screen at ${screening.cinema_name} on Kinora.`;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className="group relative h-[320px] w-[220px] flex-shrink-0 cursor-pointer overflow-visible border border-[rgba(223,197,106,0.3)] bg-[var(--color-bg-main)] text-left transition-all duration-500 hover:border-[var(--color-accent)] hover:shadow-[0_0_28px_rgba(223,197,106,0.14)]"
    >
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={posterUrl}
          alt={titleWithYear}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-70 transition-all duration-700 group-hover:scale-110 group-hover:opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg-primary)] via-[rgba(19,26,39,0.6)] to-transparent" />
      </div>

      <div className="marquee-glow absolute right-3 top-3 z-10 border border-[rgba(223,197,106,0.3)] bg-[rgba(19,26,39,0.8)] px-2.5 py-1 text-[9px] font-medium uppercase tracking-widest text-[var(--color-accent)] backdrop-blur-md">
        {formatUpcomingTime(screening.starts_at)}
      </div>

      <ShareMenu
        title={screeningShareTitle}
        text={screeningShareText}
        path={`${env.shareBaseUrl}/share/screenings/${screening.id}`}
        align="left"
        variant="compact"
        className="absolute left-3 top-3 z-20"
      />

      <div className="absolute bottom-0 left-0 flex w-full flex-col justify-end p-4">
        <div className="transform transition-transform duration-500 group-hover:-translate-y-10">
          <div className="mb-2 flex items-start">
            <h4 className="font-heading text-lg leading-tight text-white">
              {titleWithYear}
            </h4>
          </div>
          <ScreeningLocation screening={screening} />
        </div>

        <div className="absolute bottom-4 left-4 right-4 translate-y-3 opacity-0 transition-all duration-400 group-hover:translate-y-0 group-hover:opacity-100">
          <span className="block w-full border border-[var(--color-accent)] bg-[rgba(19,26,39,0.5)] py-2 text-center text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-accent)] backdrop-blur-sm transition-colors group-hover:bg-[var(--color-accent)] group-hover:text-[var(--color-bg-primary)]">
            View Screening
          </span>
        </div>
      </div>
    </article>
  );
}

function formatMovieOption(movie: MovieRead) {
  return movie.release_year
    ? `${movie.title} (${movie.release_year})`
    : movie.title;
}

export function DiscoverPage() {
  const { searchQuery } = useOutletContext<RootLayoutOutletContext>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, session } = useAuth();
  const campaignScrollRef = useRef<HTMLDivElement | null>(null);
  const screeningsScrollRef = useRef<HTMLDivElement | null>(null);
  const suggestRef = useRef<HTMLElement | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [suggestVisible, setSuggestVisible] = useState(false);
  const [movieQuery, setMovieQuery] = useState("");
  const [selectedMovie, setSelectedMovie] = useState<MovieRead | null>(null);
  const [movieDropdownOpen, setMovieDropdownOpen] = useState(false);
  const [cinemaQuery, setCinemaQuery] = useState("");
  const [selectedCinema, setSelectedCinema] = useState<CinemaRead | null>(null);
  const [cinemaDropdownOpen, setCinemaDropdownOpen] = useState(false);
  const [showAllCampaignsMobile, setShowAllCampaignsMobile] = useState(false);
  const [showAllScreeningsMobile, setShowAllScreeningsMobile] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(
    null,
  );
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const {
    data: activeCampaigns = [],
    isLoading: areCampaignsLoading,
    isError: campaignsLoadFailed,
  } = useActiveVotingCampaigns(8, session?.access_token);
  const {
    data: upcomingScreenings = [],
    isLoading: areScreeningsLoading,
    isError: screeningsLoadFailed,
  } = useUpcomingScreenings();
  const shouldLoadSuggestionData =
    suggestVisible ||
    movieDropdownOpen ||
    cinemaDropdownOpen ||
    movieQuery.trim().length > 0 ||
    cinemaQuery.trim().length > 0;
  const { data: movies = [], isLoading: areMoviesLoading } = useMovieCatalog(
    shouldLoadSuggestionData,
  );
  const { data: cinemas = [], isLoading: areCinemasLoading } = useCinemas(
    shouldLoadSuggestionData,
  );
  const suggestMutation = useMutation({
    mutationFn: async () => {
      if (!session?.access_token || !selectedMovie) {
        throw new Error("Missing auth session or selected movie.");
      }

      return createMovieRecommendation(
        {
          movie_id: selectedMovie.id,
          cinema_id: selectedCinema?.id,
        },
        session.access_token,
      );
    },
    onSuccess: () => {
      setSubmissionMessage("Your suggestion has been submitted.");
      setSubmissionError(null);
      setMovieQuery("");
      setSelectedMovie(null);
      setCinemaQuery("");
      setSelectedCinema(null);
      setMovieDropdownOpen(false);
      setCinemaDropdownOpen(false);
    },
    onError: () => {
      setSubmissionMessage(null);
      setSubmissionError("Could not submit your suggestion. Please try again.");
    },
  });

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    setShowAllCampaignsMobile(false);
    setShowAllScreeningsMobile(false);
  }, [searchQuery]);

  useEffect(() => {
    const node = suggestRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setSuggestVisible(true);
            observer.unobserve(node);
            break;
          }
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -50px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!submissionMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSubmissionMessage(null);
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [submissionMessage]);

  useEffect(() => {
    if (areCampaignsLoading || areScreeningsLoading) {
      return;
    }

    const token = session?.access_token;
    const tokenKey = token ?? "anonymous";

    void queryClient.prefetchQuery({
      queryKey: ["campaigns", "active-voting", 48, tokenKey],
      queryFn: () => getDiscoverCampaignCards(48, token),
      staleTime: 60_000,
    });

    void queryClient.prefetchQuery({
      queryKey: ["screenings", "active"],
      queryFn: () => listScreenings({ activeOnly: true }),
      staleTime: 60_000,
    });
  }, [
    areCampaignsLoading,
    areScreeningsLoading,
    queryClient,
    session?.access_token,
  ]);

  const filteredCampaigns = useMemo(
    () =>
      activeCampaigns.filter((campaign) => {
        const locationLabel = [
          campaign.cinema_name,
          campaign.location_name ?? campaign.city_name,
        ]
          .filter(Boolean)
          .join(" ");
        const leadingMovie = campaign.movies.find((movie) => movie.is_leading);

        return (
          campaign.leading_movie_title
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          campaign.cinema_name
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          locationLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (leadingMovie?.movie_title
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ??
            false)
        );
      }),
    [activeCampaigns, searchQuery],
  );

  const filteredScreenings = useMemo(
    () =>
      upcomingScreenings.filter(
        (screening) =>
          screening.movie_title
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          screening.cinema_name
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          screening.city_name.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [searchQuery, upcomingScreenings],
  );

  const filteredMovieOptions = useMemo(() => {
    const normalizedQuery = movieQuery.trim().toLowerCase();
    const sortedMovies = [...movies].sort((left, right) =>
      left.title.localeCompare(right.title),
    );

    if (!normalizedQuery) {
      return sortedMovies.slice(0, 6);
    }

    return sortedMovies
      .filter((movie) =>
        formatMovieOption(movie).toLowerCase().includes(normalizedQuery),
      )
      .slice(0, 6);
  }, [movieQuery, movies]);

  const filteredCinemaOptions = useMemo(() => {
    const normalizedQuery = cinemaQuery.trim().toLowerCase();
    const sortedCinemas = [...cinemas]
      .filter((cinema) => cinema.is_active)
      .sort((left, right) => left.name.localeCompare(right.name));

    if (!normalizedQuery) {
      return sortedCinemas.slice(0, 6);
    }

    return sortedCinemas
      .filter((cinema) => cinema.name.toLowerCase().includes(normalizedQuery))
      .slice(0, 6);
  }, [cinemaQuery, cinemas]);

  function scrollCampaigns(direction: number) {
    campaignScrollRef.current?.scrollBy({
      left: direction * 300,
      behavior: "smooth",
    });
  }

  function scrollScreenings(direction: number) {
    screeningsScrollRef.current?.scrollBy({
      left: direction * 240,
      behavior: "smooth",
    });
  }

  async function handleSuggestionSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedMovie) {
      setSubmissionMessage(null);
      setSubmissionError("Please choose a movie from the catalog.");
      return;
    }

    if (!isAuthenticated || !session?.access_token) {
      navigate("/login");
      return;
    }

    await suggestMutation.mutateAsync();
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <section className="animate-fade-up relative mx-auto mt-12 mb-16 flex max-w-7xl flex-col items-center px-4 text-center sm:px-8">
        <div className="pointer-events-none absolute left-0 top-1/2 z-0 hidden -translate-x-2 -translate-y-1/2 opacity-60 transition-opacity duration-700 xl:block hover:opacity-100">
          <DiscoverHeroCameraOrnament />
        </div>

        <div className="pointer-events-none absolute right-0 top-1/2 z-0 hidden translate-x-2 -translate-y-1/2 opacity-60 transition-opacity duration-700 xl:block hover:opacity-100">
          <div className="discover-float-slow">
            <DiscoverHeroClapperboardOrnament />
          </div>
        </div>

        <h1 className="font-display text-stroke-gold marquee-glow mb-6 max-w-full select-none text-[3.25rem] leading-none uppercase tracking-wider min-[380px]:text-[4rem] md:text-[6rem]">
          You pick, we play!
        </h1>
        <p className="mb-8 max-w-2xl text-base font-light leading-relaxed text-[var(--color-text-dim)] md:text-lg">
          Discover voting campaigns, vote for your favorite films, and book
          tickets to help confirm screenings.
        </p>
        <button
          type="button"
          onClick={() => navigate("/screenings")}
          className="group relative cursor-pointer overflow-hidden border border-[var(--color-accent)] bg-transparent px-8 py-3 transition-all duration-300"
        >
          <div className="absolute inset-0 origin-left scale-x-0 bg-[var(--color-accent)] transition-transform duration-500 ease-out group-hover:scale-x-100" />
          <span className="relative z-10 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)] transition-colors duration-300 group-hover:text-[var(--color-bg-primary)]">
            Explore Screenings
          </span>
        </button>
      </section>

      <section className="animate-fade-up delay-100 mx-auto mb-16 max-w-7xl px-4 sm:px-8">
        <div className="flex flex-col gap-5 border border-[rgba(223,197,106,0.22)] bg-[rgba(19,26,39,0.58)] p-5 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center border border-[rgba(223,197,106,0.32)] bg-[rgba(223,197,106,0.08)] text-[var(--color-accent)]">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-accent)]">
                Kinora Badges
              </p>
              <p className="max-w-3xl text-sm leading-relaxed text-[var(--color-text-dim)] md:text-base">
                Earn badges as you vote, buy tickets, and attend screenings.
                Your badges live in My Wallet alongside points and ticket
                coupons.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/tickets")}
            className="group relative flex-shrink-0 cursor-pointer overflow-hidden border border-[rgba(223,197,106,0.45)] bg-transparent px-5 py-2.5 transition-all duration-300"
          >
            <div className="absolute inset-0 origin-left scale-x-0 bg-[var(--color-accent)] transition-transform duration-500 ease-out group-hover:scale-x-100" />
            <span className="relative z-10 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)] transition-colors duration-300 group-hover:text-[var(--color-bg-primary)]">
              View My Wallet
            </span>
          </button>
        </div>
      </section>

      <section className="mx-auto mb-20 max-w-7xl px-4 sm:px-8">
        <div className="animate-fade-up delay-100 mb-8 flex items-end justify-between border-b border-[var(--color-accent-muted)] pb-4">
          <h2 className="font-heading text-3xl text-white">
            Active Voting Campaigns
          </h2>
          <div className="hidden items-center gap-4 md:flex">
            <button
              type="button"
              onClick={() => scrollCampaigns(-1)}
              className="flex h-10 w-10 cursor-pointer items-center justify-center border border-[rgba(223,197,106,0.3)] text-[var(--color-accent)] transition-colors hover:bg-[rgba(223,197,106,0.1)]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollCampaigns(1)}
              className="flex h-10 w-10 cursor-pointer items-center justify-center border border-[rgba(223,197,106,0.3)] text-[var(--color-accent)] transition-colors hover:bg-[rgba(223,197,106,0.1)]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          ref={campaignScrollRef}
          className="-my-8 py-8 md:scrollbar-hide md:overflow-x-auto"
        >
          <div className="grid grid-cols-1 justify-items-center gap-6 overflow-visible md:flex md:min-w-max md:items-stretch md:justify-items-stretch">
            {areCampaignsLoading ? <CampaignLoadingSpinner /> : null}
            {!areCampaignsLoading &&
              !campaignsLoadFailed &&
              filteredCampaigns.map((campaign, index) => (
                <div
                  key={campaign.id}
                  className={
                    index >= 2 && !showAllCampaignsMobile
                      ? "hidden md:block md:flex-shrink-0"
                      : "block md:flex-shrink-0"
                  }
                >
                  <VotingCampaignCard
                    campaign={campaign}
                    now={now}
                    variant="rail"
                    onViewCampaign={() => navigate(`/campaigns/${campaign.id}`)}
                  />
                </div>
              ))}
            {campaignsLoadFailed ? (
              <p className="py-5 text-[var(--color-text-dim)]">
                Could not load active voting campaigns.
              </p>
            ) : null}
            {!areCampaignsLoading &&
            !campaignsLoadFailed &&
            filteredCampaigns.length === 0 ? (
              <p className="py-5 text-[var(--color-text-dim)]">
                No campaigns match your search.
              </p>
            ) : null}
          </div>
        </div>
        {!areCampaignsLoading &&
        !campaignsLoadFailed &&
        filteredCampaigns.length > 2 &&
        !showAllCampaignsMobile ? (
          <button
            type="button"
            onClick={() => setShowAllCampaignsMobile(true)}
            className="group relative mx-auto mt-6 flex cursor-pointer overflow-hidden border border-[var(--color-accent)] bg-transparent px-6 py-3 transition-all duration-300 md:hidden"
          >
            <div className="absolute inset-0 origin-left scale-x-0 bg-[var(--color-accent)] transition-transform duration-500 ease-out group-hover:scale-x-100" />
            <span className="relative z-10 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)] transition-colors duration-300 group-hover:text-[var(--color-bg-primary)]">
              Show more campaigns
            </span>
          </button>
        ) : null}
      </section>

      <section className="mx-auto mb-20 w-full max-w-7xl px-4 sm:px-8">
        <div className="animate-fade-up delay-200 mb-8 flex items-end justify-between border-b border-[var(--color-accent-muted)] pb-4">
          <h2 className="font-heading text-3xl text-white">
            Upcoming Screenings
          </h2>
          <div className="hidden items-center gap-4 md:flex">
            <button
              type="button"
              onClick={() => scrollScreenings(-1)}
              className="flex h-10 w-10 cursor-pointer items-center justify-center border border-[rgba(223,197,106,0.3)] text-[var(--color-accent)] transition-colors hover:bg-[rgba(223,197,106,0.1)]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollScreenings(1)}
              className="flex h-10 w-10 cursor-pointer items-center justify-center border border-[rgba(223,197,106,0.3)] text-[var(--color-accent)] transition-colors hover:bg-[rgba(223,197,106,0.1)]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          ref={screeningsScrollRef}
          className="pb-4 md:scrollbar-hide md:overflow-x-auto"
        >
          <div className="grid grid-cols-1 justify-items-center gap-5 md:flex md:min-w-max md:justify-items-stretch">
            {areScreeningsLoading
              ? Array.from({ length: 4 }, (_, index) => (
                  <div
                    key={`screening-skeleton-${index}`}
                    className="h-[320px] w-[220px] flex-shrink-0 animate-pulse border border-[rgba(223,197,106,0.18)] bg-[rgba(27,34,49,0.65)]"
                  />
                ))
              : null}
            {!areScreeningsLoading &&
              !screeningsLoadFailed &&
              filteredScreenings.map((screening, index) => (
                <div
                  key={screening.id}
                  className={
                    index >= 2 && !showAllScreeningsMobile
                      ? "hidden md:block md:flex-shrink-0"
                      : "block md:flex-shrink-0"
                  }
                >
                  <ScreeningCard
                    screening={screening}
                    onClick={() => navigate(`/screenings/${screening.id}`)}
                  />
                </div>
              ))}
            {screeningsLoadFailed ? (
              <p className="py-5 text-[var(--color-text-dim)]">
                Could not load upcoming screenings.
              </p>
            ) : null}
            {!areScreeningsLoading &&
            !screeningsLoadFailed &&
            filteredScreenings.length === 0 ? (
              <p className="py-5 text-[var(--color-text-dim)]">
                No screenings match your search.
              </p>
            ) : null}
          </div>
        </div>
        {!areScreeningsLoading &&
        !screeningsLoadFailed &&
        filteredScreenings.length > 2 &&
        !showAllScreeningsMobile ? (
          <button
            type="button"
            onClick={() => setShowAllScreeningsMobile(true)}
            className="group relative mx-auto mt-6 flex cursor-pointer overflow-hidden border border-[var(--color-accent)] bg-transparent px-6 py-3 transition-all duration-300 md:hidden"
          >
            <div className="absolute inset-0 origin-left scale-x-0 bg-[var(--color-accent)] transition-transform duration-500 ease-out group-hover:scale-x-100" />
            <span className="relative z-10 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)] transition-colors duration-300 group-hover:text-[var(--color-bg-primary)]">
              Show more screenings
            </span>
          </button>
        ) : null}
      </section>

      <section
        ref={suggestRef}
        className="mx-auto mb-12 max-w-4xl px-4 sm:px-8"
        style={{
          opacity: suggestVisible ? 1 : 0,
          transform: suggestVisible ? "translateY(0)" : "translateY(48px)",
          transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div className="rounded-lg border border-[rgba(223,197,106,0.3)] bg-[rgba(27,34,49,0.5)] p-8 backdrop-blur-sm md:p-10">
          <div className="mb-8 text-center">
            <h2 className="font-heading mb-3 text-2xl text-white md:text-3xl">
              Don&apos;t see your film?
            </h2>
            <p className="mx-auto max-w-lg text-sm font-light leading-relaxed text-[var(--color-text-dim)] md:text-base">
              Suggest a movie you&apos;d love to experience on the big screen
              and we&apos;ll work to bring it to your local cinema.
            </p>
          </div>

          {submissionMessage ? (
            <div className="mb-4 rounded border border-[rgba(223,197,106,0.4)] bg-[rgba(223,197,106,0.1)] px-4 py-3 text-center text-sm font-medium text-[var(--color-accent)]">
              {submissionMessage}
            </div>
          ) : null}

          {submissionError ? (
            <div className="mb-4 rounded border border-[rgba(255,255,255,0.12)] bg-[rgba(19,26,39,0.55)] px-4 py-3 text-center text-sm font-medium text-white">
              {submissionError}
            </div>
          ) : null}

          <form className="space-y-4" onSubmit={handleSuggestionSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="relative">
                <label className="mb-2 block text-[10px] uppercase tracking-widest text-[var(--color-text-dim)]">
                  Movie Title *
                </label>
                <div className="relative">
                  <Film className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-accent)]" />
                  <input
                    type="text"
                    value={movieQuery}
                    onChange={(event) => {
                      setMovieQuery(event.target.value);
                      setSelectedMovie(null);
                      setMovieDropdownOpen(true);
                      setSubmissionError(null);
                    }}
                    onFocus={() => setMovieDropdownOpen(true)}
                    onBlur={() => {
                      window.setTimeout(() => {
                        setMovieDropdownOpen(false);
                      }, 120);
                    }}
                    placeholder={
                      areMoviesLoading
                        ? "loading movie catalog..."
                        : "select a film from the catalog"
                    }
                    className="w-full border border-[rgba(223,197,106,0.4)] bg-[rgba(19,26,39,0.6)] py-3 pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-accent)]"
                  />
                </div>

                {movieDropdownOpen && filteredMovieOptions.length > 0 ? (
                  <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded border border-[rgba(223,197,106,0.35)] bg-[var(--color-bg-main)] shadow-2xl">
                    {filteredMovieOptions.map((movie) => (
                      <button
                        key={movie.id}
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setSelectedMovie(movie);
                          setMovieQuery(formatMovieOption(movie));
                          setMovieDropdownOpen(false);
                          setSubmissionError(null);
                        }}
                        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-white transition-colors hover:bg-[rgba(223,197,106,0.08)]"
                      >
                        <span>{movie.title}</span>
                        {movie.release_year ? (
                          <span className="text-xs uppercase tracking-wider text-[var(--color-text-dim)]">
                            {movie.release_year}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="relative">
                <label className="mb-2 block text-[10px] uppercase tracking-widest text-[var(--color-text-dim)]">
                  Preferred Cinema{" "}
                  <span className="text-[rgba(223,197,106,0.6)]">
                    (Optional)
                  </span>
                </label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-accent)]" />
                  <input
                    type="text"
                    value={cinemaQuery}
                    onChange={(event) => {
                      setCinemaQuery(event.target.value);
                      setSelectedCinema(null);
                      setCinemaDropdownOpen(true);
                    }}
                    onFocus={() => setCinemaDropdownOpen(true)}
                    onBlur={() => {
                      window.setTimeout(() => {
                        setCinemaDropdownOpen(false);
                      }, 120);
                    }}
                    placeholder={
                      areCinemasLoading
                        ? "loading cinemas..."
                        : "your local cinema"
                    }
                    className="w-full border border-[rgba(223,197,106,0.4)] bg-[rgba(19,26,39,0.6)] py-3 pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-accent)]"
                  />
                </div>

                {cinemaDropdownOpen && filteredCinemaOptions.length > 0 ? (
                  <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded border border-[rgba(223,197,106,0.35)] bg-[var(--color-bg-main)] shadow-2xl">
                    {filteredCinemaOptions.map((cinema) => (
                      <button
                        key={cinema.id}
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setSelectedCinema(cinema);
                          setCinemaQuery(cinema.name);
                          setCinemaDropdownOpen(false);
                        }}
                        className="block w-full px-4 py-3 text-left text-sm text-white transition-colors hover:bg-[rgba(223,197,106,0.08)]"
                      >
                        {cinema.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <button
              type="submit"
              disabled={suggestMutation.isPending}
              className="group relative mt-6 w-full cursor-pointer overflow-hidden border border-[var(--color-accent)] bg-transparent px-8 py-4 transition-all duration-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <div className="absolute inset-0 origin-left scale-x-0 bg-[var(--color-accent)] transition-transform duration-500 ease-out group-hover:scale-x-100" />
              <span className="relative z-10 flex items-center justify-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)] transition-colors duration-300 group-hover:text-[var(--color-bg-primary)]">
                <Send className="h-4 w-4" />
                {suggestMutation.isPending
                  ? "Submitting..."
                  : "Submit Suggestion"}
              </span>
            </button>
          </form>
        </div>
      </section>

      <footer className="mx-auto mb-10 max-w-7xl border-t border-[rgba(223,197,106,0.18)] px-4 pt-6 text-center sm:px-8">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-dim)]">
          Contact us at{" "}
          <a
            href="mailto:info@kinora.live"
            className="text-[var(--color-accent)] transition-colors hover:text-white"
          >
            info@kinora.live
          </a>
        </p>
      </footer>
    </div>
  );
}
