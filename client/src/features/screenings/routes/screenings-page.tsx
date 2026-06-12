import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Search,
} from "lucide-react";
import {
  useLocation,
  useNavigate,
  useOutletContext,
} from "react-router-dom";
import type { RootLayoutOutletContext } from "@/app/routes/root-layout";
import { useAuth } from "@/features/auth/auth-context";
import {
  ScreeningCard,
  type ScreeningCardVariant,
} from "@/features/screenings/components/ScreeningCard";
import { ScreeningsPageHero } from "@/features/screenings/components/ScreeningsPageHero";
import { useActiveScreenings } from "@/features/screenings/queries/use-active-screenings";
import {
  createScreeningCheckoutSession,
  type ScreeningRead,
} from "@/lib/api/screenings";

type FilterPreset = "all" | "confirmed" | "almost" | "ending";
type SortOption = "soonest" | "demand" | "ending" | "newest";

const FILTER_PRESETS: Array<{ id: FilterPreset; label: string }> = [
  { id: "all", label: "All" },
  { id: "confirmed", label: "Confirmed" },
  { id: "almost", label: "Almost Confirmed" },
  { id: "ending", label: "Ending Soon" },
];

function getTimestamp(value: string | null | undefined) {
  if (!value) {
    return Number.NaN;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
}

function getDecisionDeadline(screening: ScreeningRead) {
  const startsAt = getTimestamp(screening.starts_at);
  if (!Number.isFinite(startsAt)) {
    return Number.NaN;
  }

  return startsAt - screening.decision_days_before_start * 24 * 60 * 60 * 1000;
}

function getThresholdProgress(screening: ScreeningRead) {
  if (screening.min_tickets_to_confirm <= 0) {
    return 0;
  }

  return Math.min(
    (screening.tickets_sold / screening.min_tickets_to_confirm) * 100,
    100,
  );
}

function getTicketsLeftToConfirm(screening: ScreeningRead) {
  return Math.max(screening.min_tickets_to_confirm - screening.tickets_sold, 0);
}

function formatPrice(priceCents: number) {
  return `$${(priceCents / 100).toFixed(2)}`;
}

function formatSlot(startsAt: string) {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) {
    return "TBA";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatCountdown(targetTimestamp: number, now: number) {
  if (!Number.isFinite(targetTimestamp)) {
    return null;
  }

  const difference = Math.max(targetTimestamp - now, 0);
  const totalSeconds = Math.floor(difference / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours.toString().padStart(2, "0")}h ${minutes
      .toString()
      .padStart(2, "0")}m`;
  }

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function getSearchableText(screening: ScreeningRead) {
  return [
    screening.movie_title,
    screening.movie_release_year?.toString() ?? "",
    screening.cinema_name,
    screening.location_name ?? "",
    screening.city_name,
    screening.hall_name,
  ]
    .join(" ")
    .toLowerCase();
}

function sortScreenings(screenings: ScreeningRead[], sortBy: SortOption) {
  return [...screenings].sort((left, right) => {
    if (sortBy === "demand") {
      const progressDifference =
        getThresholdProgress(right) - getThresholdProgress(left);
      if (progressDifference !== 0) {
        return progressDifference;
      }

      return right.tickets_sold - left.tickets_sold;
    }

    if (sortBy === "ending") {
      return getDecisionDeadline(left) - getDecisionDeadline(right);
    }

    if (sortBy === "newest") {
      return getTimestamp(right.created_at) - getTimestamp(left.created_at);
    }

    return getTimestamp(left.starts_at) - getTimestamp(right.starts_at);
  });
}

function RailSection({
  title,
  subtitle,
  icon,
  items,
  railRef,
  now,
  getVariant,
  getLabel,
  getSubtitle,
  getDeadlineLabel,
  processingScreeningId,
  onBuy,
  onView,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  items: ScreeningRead[];
  railRef: MutableRefObject<HTMLDivElement | null>;
  now: number;
  getVariant: (screening: ScreeningRead) => ScreeningCardVariant;
  getLabel: (screening: ScreeningRead) => string;
  getSubtitle: (screening: ScreeningRead) => string;
  getDeadlineLabel: (screening: ScreeningRead, now: number) => string | null;
  processingScreeningId: string | null;
  onBuy: (screening: ScreeningRead, quantity: number) => Promise<void>;
  onView: (screening: ScreeningRead) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  function scrollRail(direction: number) {
    railRef.current?.scrollBy({
      left: direction * 340,
      behavior: "smooth",
    });
  }

  return (
    <section className="mx-auto mb-10 max-w-[1400px] px-4 sm:mb-20 sm:px-8">
      <div
        className="mb-4 flex items-end justify-between sm:mb-8"
        style={{
          animation: "fadeUp 1s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      >
        <div className="flex items-center gap-3 sm:gap-4">
          {icon}
          <div>
            <h2 className="font-display text-xl uppercase tracking-wider text-white sm:text-2xl md:text-3xl">
              {title}
            </h2>
            <p className="mt-1 max-w-[24rem] text-xs leading-5 text-[var(--color-text-dim)] sm:text-sm">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <button
            type="button"
            onClick={() => scrollRail(-1)}
            className="flex h-10 w-10 cursor-pointer items-center justify-center border border-[rgba(223,197,106,0.3)] text-[var(--color-accent)] transition-colors hover:bg-[rgba(223,197,106,0.08)]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollRail(1)}
            className="flex h-10 w-10 cursor-pointer items-center justify-center border border-[rgba(223,197,106,0.3)] text-[var(--color-accent)] transition-colors hover:bg-[rgba(223,197,106,0.08)]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={railRef} className="scrollbar-hide overflow-x-auto pb-3 sm:pb-4">
        <div className="flex min-w-max gap-4 sm:gap-6">
          {items.map((screening) => (
            <ScreeningCard
              key={screening.id}
              screening={screening}
              variant={getVariant(screening)}
              label={getLabel(screening)}
              subtitle={getSubtitle(screening)}
              progressPercentage={getThresholdProgress(screening)}
              ticketsLeftToConfirm={getTicketsLeftToConfirm(screening)}
              deadlineLabel={getDeadlineLabel(screening, now)}
              priceLabel={formatPrice(screening.ticket_price_cents)}
              isProcessing={processingScreeningId === screening.id}
              onBuy={(quantity) => onBuy(screening, quantity)}
              onView={() => onView(screening)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ControlsBar({
  preset,
  setPreset,
  filterSearch,
  setFilterSearch,
  sortBy,
  setSortBy,
  isScrolled,
}: {
  preset: FilterPreset;
  setPreset: (value: FilterPreset) => void;
  filterSearch: string;
  setFilterSearch: (value: string) => void;
  sortBy: SortOption;
  setSortBy: (value: SortOption) => void;
  isScrolled: boolean;
}) {
  return (
    <div
      className="mb-10 border-y py-3 transition-all duration-300 sm:mb-12 sm:py-4"
      style={{
        backgroundColor: "rgba(19,26,39,0.72)",
        borderColor: isScrolled
          ? "rgba(223,197,106,0.5)"
          : "rgba(223,197,106,0.3)",
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 text-[10px] uppercase tracking-widest text-[var(--color-text-dim)]">
              Status:
            </span>
            {FILTER_PRESETS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setPreset(option.id)}
                className="cursor-pointer rounded-full px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] transition-all duration-300 sm:px-4 sm:py-2 sm:text-xs sm:tracking-widest"
                style={
                  preset === option.id
                    ? {
                        backgroundColor: "#DFC56A",
                        color: "#131A27",
                        boxShadow: "0 0 15px rgba(223,197,106,0.4)",
                      }
                    : option.id === "ending"
                      ? {
                          backgroundColor: "rgba(27,34,49,0.6)",
                          border: "1px solid rgba(239,68,68,0.2)",
                          color: "#f87171",
                        }
                      : {
                          backgroundColor: "rgba(27,34,49,0.6)",
                          border: "1px solid rgba(223,197,106,0.4)",
                          color: "#FFFFFF",
                        }
                }
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-[minmax(0,1fr)_auto] lg:w-auto lg:grid-cols-[16rem_auto] lg:gap-4">
            <div className="group relative min-w-0">
              <Search className="absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--color-text-dim)] transition-colors group-focus-within:text-[var(--color-accent)]" />
              <input
                type="text"
                placeholder="Search film or cinema..."
                value={filterSearch}
                onChange={(event) => setFilterSearch(event.target.value)}
                className="h-11 w-full rounded-sm border pl-11 pr-4 text-sm text-white outline-none transition-colors"
                style={{
                  backgroundColor: "rgba(27,34,49,0.5)",
                  borderColor: "rgba(223,197,106,0.4)",
                }}
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-dim)]">
                Sort:
              </span>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(event) =>
                    setSortBy(event.target.value as SortOption)
                  }
                  className="h-11 cursor-pointer appearance-none rounded-sm border bg-[rgba(27,34,49,0.6)] px-4 pr-10 text-xs uppercase tracking-widest text-white outline-none transition-colors hover:bg-[var(--color-bg-main)]"
                  style={{ borderColor: "rgba(223,197,106,0.4)" }}
                >
                  <option value="soonest">Soonest</option>
                  <option value="demand">Most Demand</option>
                  <option value="ending">Ending Soon</option>
                  <option value="newest">Newest</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-accent)]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScreeningsLoadingState() {
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

export function ScreeningsPage() {
  const { searchQuery } = useOutletContext<RootLayoutOutletContext>();
  const navigate = useNavigate();
  const location = useLocation();
  const { session, isAuthenticated } = useAuth();
  const [preset, setPreset] = useState<FilterPreset>("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("soonest");
  const [isScrolled, setIsScrolled] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const confirmedRailRef = useRef<HTMLDivElement | null>(null);
  const momentumRailRef = useRef<HTMLDivElement | null>(null);
  const endingRailRef = useRef<HTMLDivElement | null>(null);
  const { data: screenings = [], isLoading, isError } = useActiveScreenings();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 96);
    const interval = window.setInterval(() => setNow(Date.now()), 1000);

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.clearInterval(interval);
    };
  }, []);

  const screeningCheckoutMutation = useMutation({
    mutationFn: async ({
      screeningId,
      quantity,
    }: {
      screeningId: string;
      quantity: number;
    }) => {
      if (!session?.access_token) {
        throw new Error("Login is required to buy tickets.");
      }

      return createScreeningCheckoutSession(
        screeningId,
        quantity,
        session.access_token,
      );
    },
    onSuccess: (checkout) => {
      window.location.assign(checkout.checkout_url);
    },
    onError: (error) => {
      console.error("Screening checkout failed", error);
    },
  });

  async function handleBuy(screening: ScreeningRead, quantity: number) {
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

    await screeningCheckoutMutation.mutateAsync({
      screeningId: screening.id,
      quantity,
    });
  }

  function handleView(screening: ScreeningRead) {
    navigate(`/screenings/${screening.id}`);
  }

  const filteredScreenings = useMemo(() => {
    const combinedQuery = `${searchQuery} ${filterSearch}`.trim().toLowerCase();
    const queryTokens = combinedQuery.split(/\s+/).filter(Boolean);

    if (queryTokens.length === 0) {
      return screenings;
    }

    return screenings.filter((screening) =>
      queryTokens.every((token) =>
        getSearchableText(screening).includes(token),
      ),
    );
  }, [filterSearch, screenings, searchQuery]);

  const confirmedScreenings = useMemo(
    () =>
      filteredScreenings
        .filter((screening) => screening.status === "confirmed")
        .sort(
          (left, right) =>
            getTimestamp(left.starts_at) - getTimestamp(right.starts_at),
        ),
    [filteredScreenings],
  );

  const sellingScreenings = useMemo(
    () =>
      filteredScreenings.filter((screening) => screening.status === "selling"),
    [filteredScreenings],
  );

  const almostConfirmedScreenings = useMemo(() => {
    return sellingScreenings
      .filter((screening) => getThresholdProgress(screening) >= 75)
      .sort((left, right) => {
        const progressDifference =
          getThresholdProgress(right) - getThresholdProgress(left);
        if (progressDifference !== 0) {
          return progressDifference;
        }

        return getDecisionDeadline(left) - getDecisionDeadline(right);
      });
  }, [sellingScreenings]);

  const endingSoonScreenings = useMemo(() => {
    const byDeadline = [...sellingScreenings].sort(
      (left, right) => getDecisionDeadline(left) - getDecisionDeadline(right),
    );
    const within72Hours = byDeadline.filter((screening) => {
      const deadline = getDecisionDeadline(screening);
      return (
        Number.isFinite(deadline) &&
        deadline > now &&
        deadline - now <= 72 * 60 * 60 * 1000
      );
    });

    return within72Hours.length > 0 ? within72Hours : byDeadline.slice(0, 6);
  }, [now, sellingScreenings]);

  const allScreeningsForGrid = useMemo(() => {
    if (preset === "confirmed") {
      return confirmedScreenings;
    }

    if (preset === "almost") {
      return almostConfirmedScreenings;
    }

    if (preset === "ending") {
      return endingSoonScreenings;
    }

    return sortScreenings(filteredScreenings, sortBy);
  }, [
    almostConfirmedScreenings,
    confirmedScreenings,
    endingSoonScreenings,
    filteredScreenings,
    preset,
    sortBy,
  ]);

  const displayedGridScreenings = useMemo(
    () => (showAll ? allScreeningsForGrid : allScreeningsForGrid.slice(0, 6)),
    [allScreeningsForGrid, showAll],
  );

  useEffect(() => {
    setShowAll(false);
  }, [filterSearch, preset, searchQuery, sortBy]);

  return (
    <section className="w-full pb-24">
      <ScreeningsPageHero />

      {isLoading ? <ScreeningsLoadingState /> : null}

      {isError ? (
        <div className="mx-auto max-w-7xl px-8">
          <div className="rounded border border-[rgba(223,197,106,0.2)] bg-[rgba(27,34,49,0.55)] p-6 text-sm text-[var(--color-text-dim)]">
            Could not load screenings.
          </div>
        </div>
      ) : null}

      {!isLoading && !isError ? (
        <>
          {confirmedScreenings.length > 0 ? (
            <RailSection
              title="Confirmed Screenings"
              subtitle="Tickets guaranteed. These screenings are definitely happening."
              icon={
                <CheckCircle2 className="h-6 w-6 animate-pulse text-emerald-400" />
              }
              items={confirmedScreenings}
              railRef={confirmedRailRef}
              now={now}
              getVariant={() => "confirmed"}
              getLabel={() => "Confirmed"}
              getSubtitle={() => "Goal Reached"}
              getDeadlineLabel={() => null}
              processingScreeningId={
                screeningCheckoutMutation.isPending
                  ? (screeningCheckoutMutation.variables?.screeningId ?? null)
                  : null
              }
              onBuy={handleBuy}
              onView={handleView}
            />
          ) : null}

          {almostConfirmedScreenings.length > 0 ? (
            <div
              className="mb-10 sm:mb-20"
              style={{
                background:
                  "linear-gradient(to bottom, transparent, rgba(223,197,106,0.03), transparent)",
              }}
            >
              <RailSection
                title="Almost Confirmed"
                subtitle="Close to threshold. Your ticket can push these screenings over the line."
                icon={
                  <span className="relative flex h-5 w-5 items-center justify-center">
                    <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-[var(--color-accent)]" />
                    <span className="relative z-10 h-2.5 w-2.5 rounded-full bg-[var(--color-accent)]" />
                  </span>
                }
                items={almostConfirmedScreenings}
                railRef={momentumRailRef}
                now={now}
                getVariant={() => "almost"}
                getLabel={(screening) =>
                  `${Math.round(getThresholdProgress(screening))}% funded`
                }
                getSubtitle={() => "Tickets Needed"}
                getDeadlineLabel={() => null}
                processingScreeningId={
                  screeningCheckoutMutation.isPending
                    ? (screeningCheckoutMutation.variables?.screeningId ?? null)
                    : null
                }
                onBuy={handleBuy}
                onView={handleView}
              />
            </div>
          ) : null}

          {endingSoonScreenings.length > 0 ? (
            <RailSection
              title="Ending Soon"
              subtitle="Decision windows are closing. Secure a seat while there is still time."
              icon={
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
              }
              items={endingSoonScreenings}
              railRef={endingRailRef}
              now={now}
              getVariant={() => "ending"}
              getLabel={() => "Last Chance"}
              getSubtitle={() => "Tickets Needed"}
              getDeadlineLabel={(screening, currentNow) =>
                formatCountdown(getDecisionDeadline(screening), currentNow)
              }
              processingScreeningId={
                screeningCheckoutMutation.isPending
                  ? (screeningCheckoutMutation.variables?.screeningId ?? null)
                  : null
              }
              onBuy={handleBuy}
              onView={handleView}
            />
          ) : null}

          <ControlsBar
            preset={preset}
            setPreset={setPreset}
            filterSearch={filterSearch}
            setFilterSearch={setFilterSearch}
            sortBy={sortBy}
            setSortBy={setSortBy}
            isScrolled={isScrolled}
          />

          <section className="mx-auto max-w-7xl px-4 sm:px-8">
            <div className="mb-6 flex flex-col gap-4 border-b border-[rgba(223,197,106,0.2)] pb-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="font-heading text-3xl text-white">
                    All Screenings
                  </h2>
                </div>
                <p className="text-[12px] uppercase tracking-[0.24em] text-[rgba(223,197,106,0.72)]">
                  {allScreeningsForGrid.length} result
                  {allScreeningsForGrid.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            {allScreeningsForGrid.length === 0 ? (
              <div className="rounded border border-[rgba(223,197,106,0.2)] bg-[rgba(27,34,49,0.55)] p-6 text-sm text-[var(--color-text-dim)]">
                No screenings match your filters.
              </div>
            ) : (
              <div className="mx-auto grid max-w-[1200px] grid-cols-1 justify-items-center gap-x-6 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
                {displayedGridScreenings.map((screening) => (
                  <ScreeningCard
                    key={screening.id}
                    screening={screening}
                    variant={
                      screening.status === "confirmed"
                        ? "confirmed"
                        : endingSoonScreenings.some(
                              (item) => item.id === screening.id,
                            )
                          ? "ending"
                          : getThresholdProgress(screening) >= 75
                            ? "almost"
                            : "default"
                    }
                    label={
                      screening.status === "confirmed"
                        ? "Confirmed"
                        : endingSoonScreenings.some(
                              (item) => item.id === screening.id,
                            )
                          ? "Ending Soon"
                          : getThresholdProgress(screening) >= 75
                            ? `${Math.round(getThresholdProgress(screening))}% funded`
                            : "Selling"
                    }
                    subtitle={
                      screening.status === "confirmed"
                        ? "Goal Reached"
                        : "Tickets Needed"
                    }
                    progressPercentage={getThresholdProgress(screening)}
                    ticketsLeftToConfirm={getTicketsLeftToConfirm(screening)}
                    deadlineLabel={
                      screening.status === "confirmed"
                        ? formatSlot(screening.starts_at)
                        : formatCountdown(getDecisionDeadline(screening), now)
                    }
                    priceLabel={formatPrice(screening.ticket_price_cents)}
                    isProcessing={
                      screeningCheckoutMutation.isPending &&
                      screeningCheckoutMutation.variables?.screeningId === screening.id
                    }
                    onBuy={(quantity) => handleBuy(screening, quantity)}
                    onView={() => handleView(screening)}
                    showStatusChrome={false}
                    constrainedWidth={false}
                  />
                ))}
              </div>
            )}

            {allScreeningsForGrid.length > 6 ? (
              <div
                className="mt-8 flex justify-center pb-16"
                style={{
                  animation:
                    "fadeUp 1s cubic-bezier(0.16, 1, 0.3, 1) 300ms forwards",
                  opacity: 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowAll((value) => !value)}
                  className="group relative cursor-pointer overflow-hidden border bg-transparent px-8 py-3 transition-all duration-300"
                  style={{ borderColor: "rgba(255,255,255,0.2)" }}
                >
                  <div
                    className="absolute inset-0 origin-left scale-x-0 transition-transform duration-500 ease-out group-hover:scale-x-100"
                    style={{ backgroundColor: "#DFC56A" }}
                  />
                  <span className="relative z-10 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition-colors duration-300 group-hover:text-[var(--color-bg-primary)]">
                    {showAll ? "Show Less" : "Load All Screenings"}
                    <ChevronDown className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-y-0.5" />
                  </span>
                </button>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </section>
  );
}
