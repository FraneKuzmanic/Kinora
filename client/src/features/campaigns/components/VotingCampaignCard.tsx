import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Ticket,
  Vote,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { ShareMenu } from "@/components/ShareMenu";
import { env } from "@/config/env";
import { useAuth } from "@/features/auth/auth-context";
import type {
  CampaignDiscoverCardRead,
  CampaignDiscoverMovieRead,
} from "@/lib/api/campaigns";
import { voteForCampaignMovie } from "@/lib/api/campaigns";
import { tmdbImageUrl } from "@/lib/images";

type CardVariant = "grid" | "rail";
type DeckPosition = "left" | "center" | "right";
type ShuffleState =
  | { phase: "idle" }
  | { phase: "clearing" | "settling"; fromMovieId: string; toMovieId: string };

type VotingCampaignCardProps = {
  campaign: CampaignDiscoverCardRead;
  now: number;
  delayMs?: number;
  variant?: CardVariant;
  onViewCampaign?: () => void;
  onEarlyBird?: () => void;
};

const SHUFFLE_CLEAR_MS = 220;
const SHUFFLE_SETTLE_MS = 680;
const MOBILE_DECK_QUERY = "(max-width: 767px)";
const MOBILE_DECK_INTERSECTION_RATIO = 0.55;
const DECK_SWIPE_THRESHOLD_PX = 46;
const DECK_CLICK_SUPPRESSION_PX = 8;
const DECK_DRAG_RANGE_PX = 104;
const DECK_ROTATION_COMMIT_PROGRESS = 0.45;

type PosterDragPose = {
  x: number;
  y: number;
  rotate: number;
  scale: number;
  brightness: number;
  depth?: number;
  zIndex?: number;
};

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

function formatCountdown(targetDate: string | null, now: number) {
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
      .padStart(2, "0")}m`;
  }

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function isEndingSoon(votingEndsAt: string | null, now: number) {
  if (!votingEndsAt) {
    return false;
  }

  const difference = new Date(votingEndsAt).getTime() - now;
  return difference > 0 && difference <= 48 * 60 * 60 * 1000;
}

function getTopMovies(movies: CampaignDiscoverMovieRead[]) {
  return [...movies]
    .sort((left, right) => {
      if (right.vote_count !== left.vote_count) {
        return right.vote_count - left.vote_count;
      }

      return left.sort_order - right.sort_order;
    })
    .slice(0, 3);
}

function getMoviePosition(
  movieId: string,
  movies: CampaignDiscoverMovieRead[],
  centerMovieId: string | null,
): DeckPosition {
  if (movies.length <= 1 || movieId === centerMovieId) {
    return "center";
  }

  const centerIndex = Math.max(
    movies.findIndex((movie) => movie.id === centerMovieId),
    0,
  );
  const movieIndex = movies.findIndex((movie) => movie.id === movieId);

  if (movies.length === 2) {
    return movieIndex < centerIndex ? "left" : "right";
  }

  return movieIndex === (centerIndex + 1) % movies.length ? "right" : "left";
}

function getRestingStackClass(position: DeckPosition, variant: CardVariant) {
  if (position === "center") {
    return "translate-x-0 translate-y-0 rotate-0 scale-100 brightness-100 shadow-[0_24px_44px_rgba(0,0,0,0.38),0_0_0_1px_rgba(223,197,106,0.55)]";
  }

  if (position === "left") {
    return variant === "rail"
      ? "-translate-x-7 translate-y-1 -rotate-6 scale-100 brightness-[0.35] shadow-lg"
      : "-translate-x-10 translate-y-1 -rotate-7 scale-100 brightness-[0.35] shadow-lg";
  }

  return variant === "rail"
    ? "translate-x-4 translate-y-1 rotate-[3deg] scale-100 brightness-[0.65] shadow-lg"
    : "translate-x-7 translate-y-1 rotate-[4deg] scale-100 brightness-[0.65] shadow-lg";
}

function getExpandedFormationClass(
  position: DeckPosition,
  variant: CardVariant,
  isShuffling: boolean,
) {
  const railLeft = isShuffling
    ? "md:group-hover:-translate-x-[6.4rem] md:group-hover:-translate-y-4 md:group-hover:-rotate-[20deg] md:group-focus-within:-translate-x-[6.4rem] md:group-focus-within:-translate-y-4 md:group-focus-within:-rotate-[20deg]"
    : "md:group-hover:-translate-x-[5.3rem] md:group-hover:-translate-y-2 md:group-hover:-rotate-[17deg] md:group-focus-within:-translate-x-[5.3rem] md:group-focus-within:-translate-y-2 md:group-focus-within:-rotate-[17deg]";
  const railRight = isShuffling
    ? "md:group-hover:translate-x-[6.4rem] md:group-hover:-translate-y-4 md:group-hover:rotate-[20deg] md:group-focus-within:translate-x-[6.4rem] md:group-focus-within:-translate-y-4 md:group-focus-within:rotate-[20deg]"
    : "md:group-hover:translate-x-[5.3rem] md:group-hover:-translate-y-2 md:group-hover:rotate-[17deg] md:group-focus-within:translate-x-[5.3rem] md:group-focus-within:-translate-y-2 md:group-focus-within:rotate-[17deg]";
  const gridLeft = isShuffling
    ? "md:group-hover:-translate-x-[7.4rem] md:group-hover:-translate-y-4 md:group-hover:-rotate-[20deg] md:group-focus-within:-translate-x-[7.4rem] md:group-focus-within:-translate-y-4 md:group-focus-within:-rotate-[20deg]"
    : "md:group-hover:-translate-x-[6.3rem] md:group-hover:-translate-y-2 md:group-hover:-rotate-[17deg] md:group-focus-within:-translate-x-[6.3rem] md:group-focus-within:-translate-y-2 md:group-focus-within:-rotate-[17deg]";
  const gridRight = isShuffling
    ? "md:group-hover:translate-x-[7.4rem] md:group-hover:-translate-y-4 md:group-hover:rotate-[20deg] md:group-focus-within:translate-x-[7.4rem] md:group-focus-within:-translate-y-4 md:group-focus-within:rotate-[20deg]"
    : "md:group-hover:translate-x-[6.3rem] md:group-hover:-translate-y-2 md:group-hover:rotate-[17deg] md:group-focus-within:translate-x-[6.3rem] md:group-focus-within:-translate-y-2 md:group-focus-within:rotate-[17deg]";

  if (position === "center") {
    return "md:group-hover:translate-x-0 md:group-hover:-translate-y-1 md:group-hover:rotate-0 md:group-hover:scale-[1.04] md:group-hover:brightness-110 md:group-focus-within:translate-x-0 md:group-focus-within:-translate-y-1 md:group-focus-within:rotate-0 md:group-focus-within:scale-[1.04] md:group-focus-within:brightness-110";
  }

  if (position === "left") {
    const sidePresence = isShuffling
      ? "md:group-hover:scale-[0.94] md:group-hover:brightness-[0.9] md:group-focus-within:scale-[0.94] md:group-focus-within:brightness-[0.9]"
      : "md:group-hover:scale-[0.9] md:group-hover:brightness-[0.84] md:group-focus-within:scale-[0.9] md:group-focus-within:brightness-[0.84]";

    return `${sidePresence} md:group-hover:shadow-[0_0_28px_rgba(223,197,106,0.26)] md:group-focus-within:shadow-[0_0_28px_rgba(223,197,106,0.26)] ${
      variant === "rail" ? railLeft : gridLeft
    }`;
  }

  const sidePresence = isShuffling
    ? "md:group-hover:scale-[0.94] md:group-hover:brightness-[0.9] md:group-focus-within:scale-[0.94] md:group-focus-within:brightness-[0.9]"
    : "md:group-hover:scale-[0.9] md:group-hover:brightness-[0.84] md:group-focus-within:scale-[0.9] md:group-focus-within:brightness-[0.84]";

  return `${sidePresence} md:group-hover:shadow-[0_0_28px_rgba(223,197,106,0.26)] md:group-focus-within:shadow-[0_0_28px_rgba(223,197,106,0.26)] ${
    variant === "rail" ? railRight : gridRight
  }`;
}

function getPositionClass(
  position: DeckPosition,
  variant: CardVariant,
  isShuffling: boolean,
) {
  return `${getRestingStackClass(position, variant)} ${getExpandedFormationClass(
    position,
    variant,
    isShuffling,
  )}`;
}

function getVisualPosition(
  movieId: string,
  movies: CampaignDiscoverMovieRead[],
  centerMovieId: string | null,
  shuffleState: ShuffleState,
) {
  if (shuffleState.phase === "clearing") {
    if (movieId === shuffleState.fromMovieId) {
      return getMoviePosition(movieId, movies, shuffleState.toMovieId);
    }

    if (movieId === shuffleState.toMovieId) {
      return getMoviePosition(movieId, movies, shuffleState.fromMovieId);
    }
  }

  return getMoviePosition(movieId, movies, centerMovieId);
}

function getLayerClass(
  movieId: string,
  position: DeckPosition,
  frontMovieId: string | null,
  shuffleState: ShuffleState,
) {
  if (shuffleState.phase === "clearing") {
    if (movieId === shuffleState.fromMovieId) {
      return "z-30";
    }

    if (movieId === shuffleState.toMovieId) {
      return "z-20";
    }

    return "z-10";
  }

  if (movieId === frontMovieId) {
    return "z-30";
  }

  if (position === "center" || position === "right") {
    return "z-20";
  }

  return "z-10";
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function wrapIndex(index: number, length: number) {
  return ((index % length) + length) % length;
}

function getMobileDeckSpread(variant: CardVariant) {
  return variant === "rail" ? 36 : 34;
}

function getMobileDeckDragSpread(variant: CardVariant) {
  return variant === "rail" ? 54 : 50;
}

function getActiveDeckPose(
  position: DeckPosition,
  variant: CardVariant,
): PosterDragPose {
  const spread = getMobileDeckSpread(variant);

  if (position === "center") {
    return { x: 0, y: -4, rotate: 0, scale: 1.04, brightness: 1.1 };
  }

  if (position === "left") {
    return {
      x: -spread,
      y: -8,
      rotate: -17,
      scale: 0.9,
      brightness: 0.84,
    };
  }

  return {
    x: spread,
    y: -8,
    rotate: 17,
    scale: 0.9,
    brightness: 0.84,
  };
}

function getDragPose(
  position: DeckPosition,
  variant: CardVariant,
  dragProgress: number,
): PosterDragPose {
  const base = getActiveDeckPose(position, variant);
  const spread = getMobileDeckDragSpread(variant);
  const amount = Math.abs(dragProgress);
  const arc = Math.sin(amount * Math.PI) * 8;

  if (amount < 0.01) {
    return base;
  }

  if (dragProgress > 0) {
    if (position === "center") {
      return {
        x: lerp(base.x, -spread, amount),
        y: lerp(base.y, 12, amount) + arc * 0.35,
        rotate: lerp(base.rotate, -18, amount),
        scale: lerp(base.scale, 0.88, amount),
        brightness: lerp(base.brightness, 0.82, amount),
      };
    }

    if (position === "right") {
      return {
        x: lerp(base.x, 0, amount),
        y: lerp(base.y, -6, amount) - arc,
        rotate: lerp(base.rotate, 0, amount),
        scale: lerp(base.scale, 1.04, amount),
        brightness: lerp(base.brightness, 1.1, amount),
      };
    }

    return {
      x: lerp(base.x, spread * 0.92, amount),
      y: lerp(base.y, 16, amount),
      rotate: lerp(base.rotate, 18, amount),
      scale: lerp(base.scale, 0.82, amount),
      brightness: lerp(base.brightness, 0.68, amount),
    };
  }

  if (position === "center") {
    return {
      x: lerp(base.x, spread, amount),
      y: lerp(base.y, 12, amount) + arc * 0.35,
      rotate: lerp(base.rotate, 18, amount),
      scale: lerp(base.scale, 0.88, amount),
      brightness: lerp(base.brightness, 0.82, amount),
    };
  }

  if (position === "left") {
    return {
      x: lerp(base.x, 0, amount),
      y: lerp(base.y, -6, amount) - arc,
      rotate: lerp(base.rotate, 0, amount),
      scale: lerp(base.scale, 1.04, amount),
      brightness: lerp(base.brightness, 1.1, amount),
    };
  }

  return {
    x: lerp(base.x, -spread * 0.92, amount),
    y: lerp(base.y, 16, amount),
    rotate: lerp(base.rotate, -18, amount),
    scale: lerp(base.scale, 0.82, amount),
    brightness: lerp(base.brightness, 0.68, amount),
  };
}

function getLanePose(
  lane: "left" | "center" | "right" | "back",
  variant: CardVariant,
): PosterDragPose {
  const spread = getMobileDeckDragSpread(variant);

  if (lane === "center") {
    return {
      x: 0,
      y: -6,
      rotate: 0,
      scale: 1.04,
      brightness: 1.1,
      depth: 1,
      zIndex: 38,
    };
  }

  if (lane === "left") {
    return {
      x: -spread,
      y: -8,
      rotate: -17,
      scale: 0.9,
      brightness: 0.84,
      depth: 0.58,
      zIndex: 24,
    };
  }

  if (lane === "right") {
    return {
      x: spread,
      y: -8,
      rotate: 17,
      scale: 0.9,
      brightness: 0.84,
      depth: 0.58,
      zIndex: 24,
    };
  }

  return {
    x: 0,
    y: 20,
    rotate: 0,
    scale: 0.76,
    brightness: 0.62,
    depth: 0,
    zIndex: 8,
  };
}

function mixPose(
  from: PosterDragPose,
  to: PosterDragPose,
  amount: number,
  zIndex?: number,
): PosterDragPose {
  return {
    x: lerp(from.x, to.x, amount),
    y: lerp(from.y, to.y, amount),
    rotate: lerp(from.rotate, to.rotate, amount),
    scale: lerp(from.scale, to.scale, amount),
    brightness: lerp(from.brightness, to.brightness, amount),
    depth: lerp(from.depth ?? 0, to.depth ?? 0, amount),
    zIndex,
  };
}

function easeInOutSine(amount: number) {
  return (1 - Math.cos(Math.PI * amount)) / 2;
}

function easeOutCubic(amount: number) {
  return 1 - Math.pow(1 - amount, 3);
}

function easeInCubic(amount: number) {
  return amount * amount * amount;
}

function getEllipseFrontArcPose(
  from: PosterDragPose,
  to: PosterDragPose,
  amount: number,
  zIndex: number,
): PosterDragPose {
  const lift = Math.sin(amount * Math.PI) * 9;
  const frontBias = amount > 0.18 ? 12 : 0;

  return {
    ...mixPose(from, to, amount, zIndex + frontBias),
    y: lerp(from.y, to.y, amount) - lift,
    scale: lerp(from.scale, to.scale, amount) + lift * 0.002,
    brightness: lerp(from.brightness, to.brightness, amount) + lift * 0.008,
    depth: 1,
  };
}

function getEllipseSideArcPose(
  from: PosterDragPose,
  to: PosterDragPose,
  amount: number,
): PosterDragPose {
  const easedAmount = easeInOutSine(amount);
  const lift = Math.sin(easedAmount * Math.PI) * 3;

  return {
    ...mixPose(from, to, easedAmount, 28),
    y: lerp(from.y, to.y, easedAmount) - lift,
    depth: lerp(0.78, 0.58, easedAmount),
    zIndex: 30,
  };
}

function getEllipseBackArcPose(
  from: PosterDragPose,
  to: PosterDragPose,
  amount: number,
): PosterDragPose {
  const easedAmount = easeInOutSine(amount);
  const dip = Math.sin(easedAmount * Math.PI) * 12;

  return {
    ...mixPose(from, to, easedAmount, 6),
    y: lerp(from.y, to.y, easedAmount) + dip,
    scale: lerp(from.scale, to.scale, easedAmount) - dip * 0.003,
    brightness: lerp(from.brightness, to.brightness, easedAmount) - dip * 0.01,
    depth: 0,
    zIndex: 6,
  };
}

function getSideToBackPose(
  from: PosterDragPose,
  back: PosterDragPose,
  amount: number,
): PosterDragPose {
  return getEllipseBackArcPose(from, back, easeOutCubic(amount));
}

function getBackToSidePose(
  back: PosterDragPose,
  to: PosterDragPose,
  amount: number,
): PosterDragPose {
  return getEllipseBackArcPose(back, to, easeInCubic(amount));
}

function getRelativeDeckSlot(
  movieIndex: number,
  centerIndex: number,
  movieCount: number,
): DeckPosition {
  const relativeIndex = wrapIndex(movieIndex - centerIndex, movieCount);

  if (relativeIndex === 0) {
    return "center";
  }

  if (relativeIndex === 1) {
    return "right";
  }

  return "left";
}

function getOrderedDragPose(
  movieIndex: number,
  movieCount: number,
  baseCenterIndex: number,
  dragOffset: number,
  variant: CardVariant,
): PosterDragPose {
  const boundedOffset = clamp(dragOffset, -1, 1);
  const direction = boundedOffset >= 0 ? 1 : -1;
  const stepProgress = Math.abs(boundedOffset);
  const stepCenterIndex = baseCenterIndex;
  const slot = getRelativeDeckSlot(movieIndex, stepCenterIndex, movieCount);
  const leftPose = getLanePose("left", variant);
  const centerPose = getLanePose("center", variant);
  const rightPose = getLanePose("right", variant);
  const backPose = getLanePose("back", variant);
  const backExitProgress =
    stepProgress < 0.72 ? 0 : (stepProgress - 0.72) / 0.28;

  if (stepProgress < 0.01) {
    if (slot === "center") {
      return centerPose;
    }

    return slot === "left" ? leftPose : rightPose;
  }

  if (direction > 0) {
    if (slot === "right") {
      return getEllipseFrontArcPose(rightPose, centerPose, stepProgress, 56);
    }

    if (slot === "center") {
      return getEllipseSideArcPose(centerPose, leftPose, stepProgress);
    }

    return stepProgress < 0.5
      ? getSideToBackPose(leftPose, backPose, stepProgress / 0.5)
      : getBackToSidePose(backPose, rightPose, backExitProgress);
  }

  if (slot === "left") {
    return getEllipseFrontArcPose(leftPose, centerPose, stepProgress, 56);
  }

  if (slot === "center") {
    return getEllipseSideArcPose(centerPose, rightPose, stepProgress);
  }

  return stepProgress < 0.5
    ? getSideToBackPose(rightPose, backPose, stepProgress / 0.5)
    : getBackToSidePose(backPose, leftPose, backExitProgress);
}

function getMobileDragStyle(
  position: DeckPosition,
  variant: CardVariant,
  dragOffset: number,
  isDragging: boolean,
  isActive: boolean,
  movieIndex: number,
  movieCount: number,
  baseCenterIndex: number | null,
): CSSProperties | undefined {
  if (!isActive) {
    return undefined;
  }

  const useOrderedDrag = isDragging && movieCount >= 3 && baseCenterIndex !== null;
  const pose = useOrderedDrag
    ? getOrderedDragPose(
        movieIndex,
        movieCount,
        baseCenterIndex,
        dragOffset,
        variant,
      )
    : isDragging
      ? getDragPose(position, variant, Math.max(-1, Math.min(dragOffset, 1)))
    : getActiveDeckPose(position, variant);

  return {
    filter: `brightness(${pose.brightness})`,
    transform: `translate3d(${pose.x}px, ${pose.y}px, 0) rotate(${pose.rotate}deg) scale(${pose.scale})`,
    transitionDuration: isDragging ? "0ms" : undefined,
    zIndex: pose.zIndex,
  };
}

function posterFallback(movie: CampaignDiscoverMovieRead) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,rgba(27,34,49,0.96),rgba(10,14,21,0.96))] p-4 text-center">
      <span className="font-heading text-lg leading-tight text-white">
        {movie.movie_title}
      </span>
    </div>
  );
}

export function VotingCampaignCard({
  campaign,
  now,
  delayMs = 0,
  variant = "grid",
  onViewCampaign,
  onEarlyBird,
}: VotingCampaignCardProps) {
  const cardRef = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { isAuthenticated, session } = useAuth();
  const topMovies = useMemo(() => getTopMovies(campaign.movies), [campaign.movies]);
  const topMovieKey = useMemo(
    () => topMovies.map((movie) => movie.id).join("|"),
    [topMovies],
  );
  const topMovieKeyRef = useRef(topMovieKey);
  const [centerMovieId, setCenterMovieId] = useState<string | null>(
    () => topMovies[0]?.id ?? null,
  );
  const [frontMovieId, setFrontMovieId] = useState<string | null>(
    () => topMovies[0]?.id ?? null,
  );
  const [shuffleState, setShuffleState] = useState<ShuffleState>({
    phase: "idle",
  });
  const [optimisticVoteMovieId, setOptimisticVoteMovieId] = useState<
    string | null
  >(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isMobileDeckActive, setIsMobileDeckActive] = useState(false);
  const [isDeckDragging, setIsDeckDragging] = useState(false);
  const [deckDragOffset, setDeckDragOffset] = useState(0);
  const clearShuffleTimerRef = useRef<number | null>(null);
  const settleShuffleTimerRef = useRef<number | null>(null);
  const deckSwipeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    latestX: number;
    latestY: number;
    baseCenterIndex: number;
    didSwipe: boolean;
    didDrag: boolean;
  } | null>(null);
  const suppressPosterClickRef = useRef(false);
  const urgent = isEndingSoon(campaign.voting_ends_at, now);
  const centerMovie =
    topMovies.find((movie) => movie.id === centerMovieId) ?? topMovies[0] ?? null;
  const extraMovieCount = Math.max(campaign.movies.length - topMovies.length, 0);
  const selectedCampaignMovieId =
    optimisticVoteMovieId ?? campaign.current_user_vote_campaign_movie_id;
  const isSelected =
    Boolean(centerMovie) &&
    selectedCampaignMovieId === centerMovie?.id;
  const campaignShareTitle = `${
    centerMovie?.movie_title ?? campaign.leading_movie_title
  } on Kinora`;
  const campaignShareText = `Vote for what plays next at ${campaign.cinema_name} on Kinora.`;

  useEffect(() => {
    if (
      optimisticVoteMovieId &&
      campaign.current_user_vote_campaign_movie_id === optimisticVoteMovieId
    ) {
      setOptimisticVoteMovieId(null);
    }
  }, [campaign.current_user_vote_campaign_movie_id, optimisticVoteMovieId]);

  useEffect(() => {
    if (topMovieKeyRef.current !== topMovieKey) {
      topMovieKeyRef.current = topMovieKey;
      setShuffleState({ phase: "idle" });
      setIsDeckDragging(false);
      setDeckDragOffset(0);
      deckSwipeRef.current = null;
      clearShuffleTimers();
    }

    if (!topMovies.some((movie) => movie.id === centerMovieId)) {
      const nextCenterMovieId = topMovies[0]?.id ?? null;
      setCenterMovieId(nextCenterMovieId);
      setFrontMovieId(nextCenterMovieId);
      setShuffleState({ phase: "idle" });
      setIsDeckDragging(false);
      setDeckDragOffset(0);
      deckSwipeRef.current = null;
      clearShuffleTimers();
    } else if (!topMovies.some((movie) => movie.id === frontMovieId)) {
      setFrontMovieId(centerMovieId);
    }
  }, [centerMovieId, frontMovieId, topMovieKey, topMovies]);

  useEffect(() => {
    return () => {
      clearShuffleTimers();
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_DECK_QUERY);
    const updateMobileViewport = () => {
      const matches = mediaQuery.matches;
      setIsMobileViewport(matches);
      if (!matches) {
        setIsMobileDeckActive(false);
      }
    };

    updateMobileViewport();
    mediaQuery.addEventListener("change", updateMobileViewport);

    return () => {
      mediaQuery.removeEventListener("change", updateMobileViewport);
    };
  }, []);

  useEffect(() => {
    const cardNode = cardRef.current;
    if (!isMobileViewport || !cardNode) {
      setIsMobileDeckActive(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsMobileDeckActive(
          entry.isIntersecting &&
            entry.intersectionRatio >= MOBILE_DECK_INTERSECTION_RATIO,
        );
      },
      {
        threshold: [0, 0.35, MOBILE_DECK_INTERSECTION_RATIO, 0.75, 1],
      },
    );

    observer.observe(cardNode);

    return () => {
      observer.disconnect();
    };
  }, [isMobileViewport]);

  const voteMutation = useMutation({
    mutationFn: async (campaignMovieId: string) => {
      if (!session?.access_token) {
        throw new Error("Login is required to vote.");
      }

      return voteForCampaignMovie(
        campaign.id,
        campaignMovieId,
        session.access_token,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["campaigns", "active-voting"],
      });
    },
    onError: (error) => {
      setOptimisticVoteMovieId(null);
      console.error("Quick vote failed", error);
    },
  });

  function handleVote() {
    if (!centerMovie) {
      return;
    }

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

    if (isSelected || voteMutation.isPending) {
      return;
    }

    setOptimisticVoteMovieId(centerMovie.id);
    voteMutation.mutate(centerMovie.id);
  }

  function clearShuffleTimers() {
    if (clearShuffleTimerRef.current !== null) {
      window.clearTimeout(clearShuffleTimerRef.current);
      clearShuffleTimerRef.current = null;
    }

    if (settleShuffleTimerRef.current !== null) {
      window.clearTimeout(settleShuffleTimerRef.current);
      settleShuffleTimerRef.current = null;
    }
  }

  function moveMovieToCenter(movieId: string) {
    if (movieId === centerMovieId || shuffleState.phase !== "idle") {
      return;
    }

    if (!centerMovieId) {
      setCenterMovieId(movieId);
      setFrontMovieId(movieId);
      return;
    }

    clearShuffleTimers();
    setShuffleState({
      phase: "clearing",
      fromMovieId: centerMovieId,
      toMovieId: movieId,
    });

    clearShuffleTimerRef.current = window.setTimeout(() => {
      setFrontMovieId(movieId);
      setCenterMovieId(movieId);
      setShuffleState({
        phase: "settling",
        fromMovieId: centerMovieId,
        toMovieId: movieId,
      });
      clearShuffleTimerRef.current = null;

      settleShuffleTimerRef.current = window.setTimeout(() => {
        setShuffleState({ phase: "idle" });
        settleShuffleTimerRef.current = null;
      }, SHUFFLE_SETTLE_MS);
    }, SHUFFLE_CLEAR_MS);
  }

  function getSwipeTargetMovieId(dragOffset: number, baseCenterIndex: number) {
    if (
      !isMobileViewport ||
      shuffleState.phase !== "idle" ||
      Math.abs(dragOffset) * DECK_DRAG_RANGE_PX < DECK_SWIPE_THRESHOLD_PX ||
      Math.abs(dragOffset) < DECK_ROTATION_COMMIT_PROGRESS ||
      topMovies.length === 0
    ) {
      return null;
    }

    const targetIndex = wrapIndex(
      baseCenterIndex + (dragOffset > 0 ? 1 : -1),
      topMovies.length,
    );

    return topMovies[targetIndex]?.id ?? null;
  }

  function settleDraggedMovieToCenter(movieId: string) {
    if (movieId === centerMovieId || shuffleState.phase !== "idle") {
      return;
    }

    if (!centerMovieId) {
      setCenterMovieId(movieId);
      setFrontMovieId(movieId);
      return;
    }

    clearShuffleTimers();
    setFrontMovieId(movieId);
    setCenterMovieId(movieId);
    setShuffleState({
      phase: "settling",
      fromMovieId: centerMovieId,
      toMovieId: movieId,
    });

    settleShuffleTimerRef.current = window.setTimeout(() => {
      setShuffleState({ phase: "idle" });
      settleShuffleTimerRef.current = null;
    }, SHUFFLE_SETTLE_MS);
  }

  function handleDeckPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (
      !isMobileViewport ||
      !isMobileDeckActive ||
      shuffleState.phase !== "idle"
    ) {
      return;
    }

    if (
      event.target instanceof Element &&
      event.target.closest("button")
    ) {
      return;
    }

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers may decline capture during interrupted touch gestures.
    }

    const baseCenterIndex = Math.max(
      topMovies.findIndex((movie) => movie.id === centerMovieId),
      0,
    );

    deckSwipeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      latestX: event.clientX,
      latestY: event.clientY,
      baseCenterIndex,
      didSwipe: false,
      didDrag: false,
    };
    setIsDeckDragging(true);
    setDeckDragOffset(0);
  }

  function handleDeckPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const swipe = deckSwipeRef.current;
    if (!swipe || swipe.pointerId !== event.pointerId) {
      return;
    }

    swipe.latestX = event.clientX;
    swipe.latestY = event.clientY;

    const deltaX = swipe.latestX - swipe.startX;
    const deltaY = swipe.latestY - swipe.startY;
    const isMostlyHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * 1.15;

    if (Math.abs(deltaX) >= DECK_CLICK_SUPPRESSION_PX && isMostlyHorizontal) {
      swipe.didDrag = true;
      setDeckDragOffset(clamp(-deltaX / DECK_DRAG_RANGE_PX, -1, 1));
    }

    if (
      Math.abs(deltaX) >= DECK_SWIPE_THRESHOLD_PX &&
      isMostlyHorizontal
    ) {
      swipe.didSwipe = true;
    }
  }

  function finishDeckSwipe(event: ReactPointerEvent<HTMLDivElement>) {
    const swipe = deckSwipeRef.current;
    if (!swipe || swipe.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = swipe.latestX - swipe.startX;
    const dragOffset = clamp(-deltaX / DECK_DRAG_RANGE_PX, -1, 1);
    const targetMovieId = swipe.didSwipe
      ? getSwipeTargetMovieId(dragOffset, swipe.baseCenterIndex)
      : null;
    const shouldSuppressClick = swipe.didDrag;
    deckSwipeRef.current = null;
    setIsDeckDragging(false);
    setDeckDragOffset(0);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // The browser may release capture automatically during gesture cancel.
      }
    }

    if (shouldSuppressClick) {
      suppressPosterClickRef.current = true;
      window.setTimeout(() => {
        suppressPosterClickRef.current = false;
      }, 120);
    }

    if (targetMovieId) {
      settleDraggedMovieToCenter(targetMovieId);
    }
  }

  function cancelDeckSwipe(event: ReactPointerEvent<HTMLDivElement>) {
    const swipe = deckSwipeRef.current;
    if (!swipe || swipe.pointerId !== event.pointerId) {
      return;
    }

    deckSwipeRef.current = null;
    setIsDeckDragging(false);
    setDeckDragOffset(0);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // The browser may release capture automatically during gesture cancel.
      }
    }
  }

  function rotateToNextMovie() {
    if (shuffleState.phase !== "idle" || topMovies.length < 2) {
      return;
    }
    const currentIndex = Math.max(
      topMovies.findIndex((m) => m.id === centerMovieId),
      0,
    );
    const nextMovieId = topMovies[wrapIndex(currentIndex + 1, topMovies.length)]?.id;
    if (nextMovieId) {
      moveMovieToCenter(nextMovieId);
    }
  }

  function handlePosterKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    movieId: string,
  ) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    moveMovieToCenter(movieId);
  }

  const rootClass =
    variant === "rail"
      ? "w-[280px] flex-shrink-0"
      : "mx-auto w-full max-w-[332px]";

  return (
    <article
      ref={cardRef}
      data-deck-active={isMobileDeckActive || undefined}
      onClick={() => onViewCampaign?.()}
      className={`group animate-fade-up relative flex ${rootClass} cursor-pointer flex-col overflow-visible border border-[rgba(223,197,106,0.3)] bg-[var(--color-bg-main)] p-5 text-left shadow-xl transition-all duration-500 hover:z-30 hover:border-[rgba(223,197,106,0.72)] hover:shadow-[0_0_40px_rgba(223,197,106,0.15)] focus-within:z-30 data-[deck-active=true]:z-30 data-[deck-active=true]:border-[rgba(223,197,106,0.72)] data-[deck-active=true]:shadow-[0_0_40px_rgba(223,197,106,0.15)]`}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      {urgent ? (
        <div className="absolute right-4 top-4 z-50 md:top-12">
          <span className="flex items-center gap-1 rounded-sm border border-[rgba(248,113,113,0.3)] bg-[rgba(239,68,68,0.1)] px-2 py-1 text-[9px] font-medium uppercase tracking-widest text-[#f87171] backdrop-blur-md">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#f87171]" />
            Ending Soon
          </span>
        </div>
      ) : null}

      <ShareMenu
        title={campaignShareTitle}
        text={campaignShareText}
        path={`${env.shareBaseUrl}/share/campaigns/${campaign.id}`}
        align="left"
        variant="compact"
        className="absolute left-4 top-3 z-[65]"
      />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          rotateToNextMovie();
        }}
        disabled={shuffleState.phase !== "idle" || topMovies.length < 2}
        className="absolute left-0 right-0 top-3 z-10 hidden min-h-8 cursor-pointer items-center justify-center gap-2 px-4 opacity-50 transition-opacity duration-200 hover:opacity-90 disabled:cursor-default disabled:opacity-25 md:flex"
      >
        <RefreshCw className="h-4 w-4 text-[var(--color-accent)]" />
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--color-accent)]">
          Rotate deck
        </span>
      </button>

      <div
        className="relative z-10 mb-9 mt-6 h-[246px] w-[190px] self-center [perspective:1200px] [touch-action:pan-y] md:mb-5"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={handleDeckPointerDown}
        onPointerMove={handleDeckPointerMove}
        onPointerUp={finishDeckSwipe}
        onPointerCancel={cancelDeckSwipe}
      >
        <div className="absolute inset-[8%] rounded bg-[linear-gradient(180deg,rgba(223,197,106,0.08),rgba(19,26,39,0.02))] shadow-[inset_0_0_0_1px_rgba(223,197,106,0.08)]" />
        {topMovies.map((movie, index) => {
          const position = getVisualPosition(
            movie.id,
            topMovies,
            centerMovieId,
            shuffleState,
          );
          const isVisuallyCenter = position === "center";
          const isSelectedCenter =
            movie.id === centerMovieId && shuffleState.phase !== "clearing";
          const canMoveMovie =
            !isVisuallyCenter && shuffleState.phase === "idle";
          const canClickMoveMovie = canMoveMovie;
          const layerClassName = getLayerClass(
            movie.id,
            position,
            frontMovieId,
            shuffleState,
          );
          const posterDragStyle = getMobileDragStyle(
            position,
            variant,
            deckDragOffset,
            isDeckDragging,
            isMobileViewport && isMobileDeckActive,
            index,
            topMovies.length,
            deckSwipeRef.current?.baseCenterIndex ?? null,
          );
          const posterClassName = `absolute inset-0 h-full w-full overflow-hidden rounded border object-cover text-left outline-none transition-all duration-[860ms] ease-[cubic-bezier(0.16,1,0.3,1)] [backface-visibility:hidden] [transform-style:preserve-3d] [will-change:transform] ${
            isVisuallyCenter
              ? "cursor-default border-[rgba(223,197,106,0.68)]"
              : canMoveMovie
                ? "cursor-pointer border-[rgba(223,197,106,0.3)]"
                : "cursor-default border-[rgba(223,197,106,0.3)]"
          } ${layerClassName} ${getPositionClass(
            position,
            variant,
            shuffleState.phase !== "idle",
          )} hover:border-[var(--color-accent)] focus-visible:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[rgba(223,197,106,0.35)]`;
          const posterContent = (
            <>
              {movie.movie_poster_url ? (
                <img
                  src={tmdbImageUrl(movie.movie_poster_url, "w342")}
                  alt={movie.movie_title}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                posterFallback(movie)
              )}
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(7,10,16,0.7),transparent_46%)]" />
              {isSelectedCenter ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleVote();
                  }}
                  disabled={!centerMovie || isSelected || voteMutation.isPending}
                  className={`absolute bottom-14 left-4 right-4 z-40 inline-flex min-h-10 translate-y-2 cursor-pointer items-center justify-center gap-2 border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] opacity-0 shadow-[0_12px_30px_rgba(0,0,0,0.45)] backdrop-blur-md transition-all duration-300 disabled:cursor-not-allowed group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-data-[deck-active=true]:translate-y-0 group-data-[deck-active=true]:opacity-100 ${
                    isSelected
                      ? "border-[#f0d575] bg-[#f0d575] text-[var(--color-bg-primary)]"
                      : voteMutation.isPending
                        ? "border-[#f0d575] bg-[#f0d575] text-[var(--color-bg-primary)] opacity-80"
                        : "border-[rgba(223,197,106,0.65)] bg-[rgba(12,16,24,0.84)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)]"
                  }`}
                >
                  {isSelected ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : voteMutation.isPending ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Vote className="h-3.5 w-3.5" />
                  )}
                  {isSelected
                    ? "Your Vote"
                    : voteMutation.isPending
                      ? "Submitting"
                      : "Vote"}
                </button>
              ) : null}
            </>
          );

          return (
            <div
              key={movie.id}
              role={canMoveMovie ? "button" : undefined}
              tabIndex={canMoveMovie ? 0 : undefined}
              onClick={
                canClickMoveMovie
                  ? () => {
                      if (suppressPosterClickRef.current) {
                        return;
                      }

                      moveMovieToCenter(movie.id);
                    }
                  : undefined
              }
              onKeyDown={
                canMoveMovie
                  ? (event) => {
                      handlePosterKeyDown(event, movie.id);
                    }
                  : undefined
              }
              aria-label={
                isSelectedCenter
                  ? `${movie.movie_title} is selected`
                  : `Move ${movie.movie_title} to the center`
              }
              className={posterClassName}
              style={posterDragStyle}
            >
              {posterContent}
            </div>
          );
        })}
        <span className="pointer-events-none absolute -bottom-7 left-1/2 z-40 whitespace-nowrap border border-[rgba(223,197,106,0.28)] bg-[rgba(12,16,24,0.78)] px-2 py-1 text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--color-accent)] opacity-0 backdrop-blur-sm transition-opacity duration-300 -translate-x-1/2 md:hidden group-data-[deck-active=true]:opacity-100">
          Drag posters
        </span>
      </div>

      <div className="mb-4 flex min-h-[92px] w-full flex-col items-center justify-start text-center">
        <h3 className="font-heading line-clamp-2 min-h-[3.6rem] text-2xl leading-tight text-white transition-colors duration-300 group-hover:text-[var(--color-accent)] group-data-[deck-active=true]:text-[var(--color-accent)]">
          {centerMovie?.movie_title ?? campaign.leading_movie_title}
        </h3>
        <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-[var(--color-accent)]">
          <Vote className="h-3 w-3" />
          {centerMovie
            ? `${centerMovie.vote_count.toLocaleString("en-US")} votes`
            : "Voting"}
        </p>
        {extraMovieCount > 0 ? (
          <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-dim)]">
            +{extraMovieCount} more in campaign
          </p>
        ) : null}
      </div>

      <div className="flex w-full flex-col gap-3 rounded-lg border border-white/5 bg-[rgba(19,26,39,0.4)] p-4 text-xs">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
            <MapPin className="h-3.5 w-3.5 text-[var(--color-accent)]" />
            Cinema
          </span>
          <span className="text-right text-[12px] leading-snug text-white">
            {campaign.cinema_name}
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-white/5 pt-3">
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
          <div
            className={`flex items-center font-mono text-sm font-semibold ${
              urgent ? "text-[#f87171]" : "text-[var(--color-accent)]"
            }`}
          >
            <Clock3
              className={`mr-2 h-3.5 w-3.5 animate-pulse ${
                urgent ? "text-[#f87171]" : "text-[rgba(223,197,106,0.8)]"
              }`}
            />
            {formatCountdown(campaign.voting_ends_at, now)}
          </div>
        </div>
      </div>

      <div className="mt-4 flex w-full flex-col gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            (onEarlyBird ?? onViewCampaign)?.();
          }}
          className="inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 border border-[rgba(223,197,106,0.65)] bg-[rgba(223,197,106,0.08)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)] transition-colors duration-300 hover:bg-[rgba(223,197,106,0.18)] hover:text-white"
        >
          <Ticket className="h-3.5 w-3.5" />
          Early Bird
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onViewCampaign?.();
          }}
          className="inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 border border-[rgba(223,197,106,0.34)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)] transition-colors duration-300 hover:border-[var(--color-accent)] hover:bg-[rgba(223,197,106,0.08)] hover:text-white"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          View Campaign
        </button>
      </div>
    </article>
  );
}
