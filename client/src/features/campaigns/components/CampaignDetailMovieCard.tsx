import { useEffect, useRef, useState } from "react";
import {
  CircleAlert,
  Crown,
  LoaderCircle,
  Minus,
  Plus,
  Ticket,
  Vote,
} from "lucide-react";
import type { CampaignMovieStats } from "@/lib/api/campaigns";
import { tmdbImageUrl } from "@/lib/images";
import type { RewardCouponRead } from "@/lib/api/loyalty";

function formatRuntime(runtimeMinutes: number | null) {
  if (!runtimeMinutes) {
    return null;
  }

  return `${runtimeMinutes} min`;
}

type CampaignDetailMovieCardProps = {
  movie: CampaignMovieStats;
  rank: number;
  isLeading: boolean;
  isSelected: boolean;
  isVotingClosed: boolean;
  isEarlyBirdSoldOut: boolean;
  remainingEarlyBirdCapacity: number;
  ticketPriceCents: number;
  availableCoupons: RewardCouponRead[];
  isVotePending: boolean;
  isSubmittingThisMovie: boolean;
  isEarlyBirdPending: boolean;
  isSubmittingEarlyBirdForThisMovie: boolean;
  onVote: (campaignMovieId: string) => void;
  onEarlyBirdCheckout: (
    campaignMovieId: string,
    quantity: number,
    couponId: string | null,
  ) => Promise<void>;
};

export function CampaignDetailMovieCard({
  movie,
  rank,
  isLeading,
  isSelected,
  isVotingClosed,
  isEarlyBirdSoldOut,
  remainingEarlyBirdCapacity,
  ticketPriceCents,
  availableCoupons,
  isVotePending,
  isSubmittingThisMovie,
  isEarlyBirdPending,
  isSubmittingEarlyBirdForThisMovie,
  onVote,
  onEarlyBirdCheckout,
}: CampaignDetailMovieCardProps) {
  const metadata = [
    movie.movie_release_year ? String(movie.movie_release_year) : null,
    formatRuntime(movie.movie_runtime_minutes),
  ].filter(Boolean);
  const [isEarlyBirdPopoverOpen, setIsEarlyBirdPopoverOpen] = useState(false);
  const [earlyBirdQuantity, setEarlyBirdQuantity] = useState(1);
  const [selectedCouponId, setSelectedCouponId] = useState("");
  const [earlyBirdError, setEarlyBirdError] = useState<string | null>(null);
  const earlyBirdPopoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isEarlyBirdPopoverOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (
        earlyBirdPopoverRef.current &&
        !earlyBirdPopoverRef.current.contains(event.target as Node)
      ) {
        setIsEarlyBirdPopoverOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isEarlyBirdPopoverOpen]);

  useEffect(() => {
    if (!isEarlyBirdPopoverOpen) {
      setEarlyBirdQuantity(1);
      setSelectedCouponId("");
      setEarlyBirdError(null);
      return;
    }

    setEarlyBirdQuantity((current) =>
      Math.min(Math.max(current, 1), Math.max(remainingEarlyBirdCapacity, 1)),
    );
  }, [isEarlyBirdPopoverOpen, remainingEarlyBirdCapacity]);

  const selectedCoupon =
    availableCoupons.find((coupon) => coupon.id === selectedCouponId) ?? null;
  const earlyBirdSubtotalCents = ticketPriceCents * earlyBirdQuantity;
  const earlyBirdDiscountCents = selectedCoupon
    ? Math.min(
        Math.floor(
          (earlyBirdSubtotalCents * selectedCoupon.discount_percent) / 100,
        ),
        selectedCoupon.max_discount_cents,
      )
    : 0;
  const earlyBirdTotalPrice =
    Math.max(earlyBirdSubtotalCents - earlyBirdDiscountCents, 0) / 100;

  async function handleEarlyBirdCheckout() {
    try {
      setEarlyBirdError(null);
      await onEarlyBirdCheckout(
        movie.id,
        earlyBirdQuantity,
        selectedCouponId || null,
      );
      setIsEarlyBirdPopoverOpen(false);
    } catch (error) {
      setEarlyBirdError(
        error instanceof Error
          ? error.message
          : "Checkout could not be started.",
      );
    }
  }

  return (
    <article
      className={`group relative mx-auto flex w-full max-w-[420px] flex-col gap-5 border-t pt-7 ${
        isLeading
          ? "border-[var(--color-accent)]"
          : "border-[rgba(122,132,153,0.3)]"
      }`}
    >
      <span
        className={`pointer-events-none absolute -left-1 -top-6 font-display text-[5.75rem] leading-none transition-transform duration-500 ${
          isLeading
            ? "text-[rgba(223,197,106,0.05)] [-webkit-text-stroke:1px_rgba(223,197,106,0.38)] group-hover:translate-x-2"
            : "text-transparent [-webkit-text-stroke:1px_rgba(122,132,153,0.2)] group-hover:translate-x-2 group-hover:[-webkit-text-stroke:1px_rgba(223,197,106,0.35)]"
        }`}
      >
        {String(rank).padStart(2, "0")}
      </span>

      <div
        className={`relative z-10 aspect-[3/4] overflow-hidden bg-[#0a0e15] ${
          isLeading
            ? "shadow-[0_0_0_1px_var(--color-accent),0_20px_40px_rgba(223,197,106,0.18)]"
            : ""
        }`}
      >
        {isLeading ? (
          <span className="absolute right-3 top-3 z-20 flex items-center gap-2 bg-[var(--color-accent)] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--color-bg-primary)] shadow-[0_6px_16px_rgba(0,0,0,0.45)]">
            <Crown className="h-3.5 w-3.5 fill-current" />
            Leading Movie
          </span>
        ) : null}

        {movie.movie_poster_url ? (
          <img
            src={tmdbImageUrl(movie.movie_poster_url, "w500")}
            alt={movie.movie_title}
            loading={rank === 1 ? "eager" : "lazy"}
            decoding="async"
            className={`h-full w-full object-cover transition-all duration-700 group-hover:scale-[1.02] ${
              isLeading
                ? "grayscale-0 contrast-110"
                : "grayscale-[20%] contrast-110 group-hover:grayscale-0 group-hover:contrast-125"
            }`}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[linear-gradient(180deg,rgba(27,34,49,0.95),rgba(19,26,39,0.95))] p-6 text-center">
            <span className="font-heading text-xl text-white">
              {movie.movie_title}
            </span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(19,26,39,0.92)_0%,rgba(19,26,39,0.05)_48%)]" />
        <div className="pointer-events-none absolute bottom-4 right-4 z-20 text-right [text-shadow:0_0_16px_rgba(223,197,106,0.42),0_6px_18px_rgba(0,0,0,0.42)]">
          <div
            className="text-center font-display text-[2.8rem] leading-none text-[var(--color-accent)] drop-shadow-[0_0_18px_rgba(223,197,106,0.65)]"
            style={{ WebkitTextStroke: "1px black" }}
          >
            {movie.vote_count.toLocaleString("en-US")}
          </div>
          <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/95">
            Votes
          </div>
        </div>
      </div>

      <div className="relative z-10 flex flex-col gap-4">
        <div className="border-b border-[rgba(122,132,153,0.3)] pb-4">
          <h2 className="font-heading text-[1.9rem] leading-tight text-white sm:text-[2.3rem]">
            {movie.movie_title}
          </h2>
          {metadata.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-2.5 text-[12px] uppercase tracking-[0.14em] text-[var(--color-text-dim)]">
              {metadata.map((item, index) => (
                <div
                  key={`${movie.id}-${item}`}
                  className="flex items-center gap-3"
                >
                  {index > 0 ? (
                    <span className="h-[3px] w-[3px] rounded-full bg-[var(--color-text-dim)]" />
                  ) : null}
                  <span>{item}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <p className="min-h-[3.5rem] text-[14px] leading-relaxed text-[var(--color-text-dim)]">
          {movie.movie_overview ??
            "A candidate title in this live voting campaign."}
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
          <button
            type="button"
            onClick={() => onVote(movie.id)}
            disabled={isVotePending || isVotingClosed || isSelected}
            className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] transition-all duration-300 ${
              isVotingClosed
                ? "cursor-not-allowed bg-[rgba(122,132,153,0.22)] text-[rgba(255,255,255,0.55)]"
                : isSelected
                  ? "cursor-not-allowed bg-[#f0d575] text-[var(--color-bg-primary)] shadow-[0_10px_20px_rgba(223,197,106,0.18)]"
                  : isSubmittingThisMovie
                    ? "cursor-wait bg-[#f0d575] text-[var(--color-bg-primary)] shadow-[0_10px_20px_rgba(223,197,106,0.14)]"
                    : "cursor-pointer bg-[var(--color-accent)] text-[var(--color-bg-primary)] hover:-translate-y-0.5 hover:bg-[#f0d575] hover:shadow-[0_10px_20px_rgba(223,197,106,0.14)]"
            }`}
          >
            <span className="flex items-center justify-center gap-2 whitespace-nowrap">
              <Vote className="h-4 w-4" />
              {isVotingClosed
                ? "Voting Closed"
                : isSubmittingThisMovie
                  ? "Submitting Vote"
                  : isSelected
                    ? "Your Vote"
                    : "Vote"}
            </span>
          </button>

          <div className="relative">
            <button
              type="button"
              disabled={isEarlyBirdSoldOut || isEarlyBirdPending}
              onClick={() => {
                if (isEarlyBirdSoldOut || isEarlyBirdPending) {
                  return;
                }
                setEarlyBirdError(null);
                setIsEarlyBirdPopoverOpen((current) => !current);
              }}
              className={`px-4 py-3 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors duration-300 ${
                isEarlyBirdSoldOut
                  ? "cursor-not-allowed border border-[rgba(122,132,153,0.26)] bg-[rgba(122,132,153,0.14)] text-[rgba(255,255,255,0.52)]"
                  : isEarlyBirdPending
                    ? "cursor-not-allowed border border-[rgba(122,132,153,0.26)] bg-transparent text-[var(--color-accent)] opacity-65"
                    : "cursor-pointer border border-[rgba(122,132,153,0.3)] bg-transparent text-[var(--color-accent)] hover:border-[var(--color-accent)] hover:bg-[rgba(223,197,106,0.05)]"
              }`}
            >
              <span className="flex items-center justify-center gap-2 whitespace-nowrap">
                <Ticket className="h-4 w-4" />
                {isEarlyBirdSoldOut ? "Sold Out" : "Early Bird"}
              </span>
            </button>

            {isEarlyBirdPopoverOpen && !isEarlyBirdSoldOut ? (
              <div
                ref={earlyBirdPopoverRef}
                className="absolute bottom-[calc(100%+12px)] border border-[var(--color-accent)] right-0 z-30 w-[270px] rounded-[4px] bg-[rgba(19,26,39,0.97)] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.48)]"
              >
                <div className="absolute bottom-[-6px] right-[18px] h-[10px] w-[10px] rotate-45 border-b border-r border-[rgba(122,132,153,0.3)] bg-[rgba(19,26,39,0.97)]" />

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-display text-[0.95rem] uppercase tracking-[0.05em] text-[var(--color-accent)]">
                      Early Bird Checkout
                    </h4>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-dim)]">
                      {remainingEarlyBirdCapacity} tickets remaining
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEarlyBirdPopoverOpen(false)}
                    className="cursor-pointer text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-dim)] transition-colors duration-300 hover:text-[var(--color-accent)]"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-4 border-y border-[rgba(122,132,153,0.22)] py-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[12px] uppercase tracking-[0.14em] text-[var(--color-text-dim)]">
                      Quantity
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setEarlyBirdQuantity((current) =>
                            Math.max(current - 1, 1),
                          )
                        }
                        disabled={earlyBirdQuantity <= 1 || isEarlyBirdPending}
                        className="flex h-9 w-9 items-center justify-center border border-[rgba(122,132,153,0.3)] text-[var(--color-accent)] transition-colors duration-300 hover:border-[var(--color-accent)] hover:bg-[rgba(223,197,106,0.05)] disabled:cursor-not-allowed disabled:border-[rgba(122,132,153,0.2)] disabled:text-[rgba(255,255,255,0.35)]"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-[2ch] text-center font-display text-3xl leading-none text-white">
                        {earlyBirdQuantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setEarlyBirdQuantity((current) =>
                            Math.min(current + 1, remainingEarlyBirdCapacity),
                          )
                        }
                        disabled={
                          earlyBirdQuantity >= remainingEarlyBirdCapacity ||
                          isEarlyBirdPending
                        }
                        className="flex h-9 w-9 items-center justify-center border border-[rgba(122,132,153,0.3)] text-[var(--color-accent)] transition-colors duration-300 hover:border-[var(--color-accent)] hover:bg-[rgba(223,197,106,0.05)] disabled:cursor-not-allowed disabled:border-[rgba(122,132,153,0.2)] disabled:text-[rgba(255,255,255,0.35)]"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {availableCoupons.length > 0 ? (
                    <div className="mt-4 grid gap-2">
                      <p className="text-[12px] uppercase tracking-[0.14em] text-[var(--color-text-dim)]">
                        Coupon
                      </p>
                      <div className="grid gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedCouponId("")}
                          disabled={isEarlyBirdPending}
                          className={`border px-3 py-2 text-left text-sm transition-colors ${
                            selectedCouponId === ""
                              ? "border-[var(--color-accent)] bg-[rgba(223,197,106,0.1)] text-[var(--color-accent)]"
                              : "border-[rgba(122,132,153,0.24)] bg-[rgba(255,255,255,0.03)] text-white hover:border-[rgba(223,197,106,0.35)]"
                          } disabled:cursor-not-allowed disabled:opacity-70`}
                        >
                          No coupon
                        </button>
                        {availableCoupons.map((coupon) => (
                          <button
                            key={coupon.id}
                            type="button"
                            onClick={() => setSelectedCouponId(coupon.id)}
                            disabled={isEarlyBirdPending}
                            className={`border px-3 py-2 text-left transition-colors ${
                              selectedCouponId === coupon.id
                                ? "border-[var(--color-accent)] bg-[rgba(223,197,106,0.1)] text-[var(--color-accent)]"
                                : "border-[rgba(122,132,153,0.24)] bg-[rgba(255,255,255,0.03)] text-white hover:border-[rgba(223,197,106,0.35)]"
                            } disabled:cursor-not-allowed disabled:opacity-70`}
                          >
                            <span className="block text-sm font-semibold">
                              {coupon.discount_percent}% off
                            </span>
                            <span className="mt-1 block text-[11px] text-[var(--color-text-dim)]">
                              Max EUR {(coupon.max_discount_cents / 100).toFixed(2)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {earlyBirdDiscountCents > 0 ? (
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-[12px] uppercase tracking-[0.14em] text-[var(--color-text-dim)]">
                        Discount
                      </span>
                      <span className="text-sm font-semibold text-emerald-300">
                        -EUR {(earlyBirdDiscountCents / 100).toFixed(2)}
                      </span>
                    </div>
                  ) : null}

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-[12px] uppercase tracking-[0.14em] text-[var(--color-text-dim)]">
                      Total
                    </span>
                    <span className="font-display text-[1.4rem] leading-none text-[var(--color-accent)]">
                      €{earlyBirdTotalPrice.toFixed(2)}
                    </span>
                  </div>
                </div>

                {earlyBirdError ? (
                  <p className="mt-3 text-[12px] leading-5 text-[#f3b2b2]">
                    {earlyBirdError}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={() => void handleEarlyBirdCheckout()}
                  disabled={
                    isEarlyBirdPending || remainingEarlyBirdCapacity < 1
                  }
                  className={`mt-4 w-full px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] transition-all duration-300 ${
                    isEarlyBirdPending
                      ? "cursor-wait bg-[#f0d575] text-[var(--color-bg-primary)] shadow-[0_10px_20px_rgba(223,197,106,0.14)]"
                      : "cursor-pointer bg-[var(--color-accent)] text-[var(--color-bg-primary)] hover:-translate-y-0.5 hover:bg-[#f0d575] hover:shadow-[0_10px_20px_rgba(223,197,106,0.14)]"
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    Continue to Checkout
                    {isSubmittingEarlyBirdForThisMovie ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : null}
                  </span>
                </button>
              </div>
            ) : null}
          </div>

          <div className="relative sm:justify-self-start">
            <div className="group/info relative">
              <button
                type="button"
                aria-label="How Early Bird works"
                className="flex h-9 w-9 cursor-help items-center justify-center rounded-full cursor-pointer bg-[rgba(19,26,39,0.9)] text-[var(--color-text-dim)] transition-all duration-300 hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus-visible:border-[var(--color-accent)] focus-visible:text-[var(--color-accent)] focus-visible:outline-none"
              >
                <CircleAlert className="h-4.5 w-4.5" />
              </button>

              <div className="pointer-events-none absolute bottom-[calc(100%+12px)] right-0 z-30 w-[290px] translate-y-2 rounded-[4px] border border-[rgba(122,132,153,0.3)] bg-[rgba(19,26,39,0.96)] p-5 opacity-0 shadow-[0_18px_40px_rgba(0,0,0,0.45)] transition-all duration-300 group-hover/info:translate-y-0 group-hover/info:opacity-100 group-focus-within/info:translate-y-0 group-focus-within/info:opacity-100">
                <div className="absolute bottom-[-6px] right-[11px] h-[10px] w-[10px] rotate-45 border-b border-r border-[rgba(122,132,153,0.3)] bg-[rgba(19,26,39,0.96)]" />
                <h4 className="font-display text-[0.9rem] uppercase tracking-[0.06em] text-[var(--color-accent)]">
                  Early Bird Advantage
                </h4>
                <p className="mt-3 text-[13px] leading-6 text-white/92">
                  Buying early does more than reserve your place. Strong{" "}
                  <span className="font-medium text-[var(--color-accent)]">
                    Early Bird demand
                  </span>{" "}
                  can help push this film ahead when the campaign resolves.
                </p>
                <p className="mt-3 border-t border-[rgba(122,132,153,0.22)] pt-3 text-[12px] leading-5 text-[var(--color-text-dim)]">
                  If this film does not win, your ticket still applies to the
                  winning screening and stays refundable on request.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
