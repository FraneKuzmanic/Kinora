import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  MapPin,
  Minus,
  Plus,
  Ticket,
  X,
} from "lucide-react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ShareMenu } from "@/components/ShareMenu";
import { env } from "@/config/env";
import { useAuth } from "@/features/auth/auth-context";
import { useScreeningDetail } from "@/features/screenings/queries/use-screening-detail";
import { getMyLoyaltyWallet } from "@/lib/api/loyalty";
import { createScreeningCheckoutSession } from "@/lib/api/screenings";
import { tmdbImageUrl } from "@/lib/images";

function formatSlot(value: string) {
  const date = new Date(value);
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

function getDecisionDeadline(
  startsAt: string,
  decisionDaysBeforeStart: number,
) {
  const startsTimestamp = new Date(startsAt).getTime();
  if (!Number.isFinite(startsTimestamp)) {
    return Number.NaN;
  }

  return startsTimestamp - decisionDaysBeforeStart * 24 * 60 * 60 * 1000;
}

function formatCountdown(targetTimestamp: number, now: number) {
  if (!Number.isFinite(targetTimestamp)) {
    return "TBA";
  }

  const difference = Math.max(targetTimestamp - now, 0);
  const totalSeconds = Math.floor(difference / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours.toString().padStart(2, "0")}h ${minutes
      .toString()
      .padStart(2, "0")}m`;
  }

  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function formatPrice(priceCents: number) {
  return `$${(priceCents / 100).toFixed(2)}`;
}

function ScreeningDetailLoadingState() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="relative h-20 w-20">
        <div className="absolute inset-0 rounded-full border border-[rgba(223,197,106,0.18)]" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-r-[var(--color-accent)] border-t-[var(--color-accent)]" />
        <div className="absolute inset-4 rounded-full border border-[rgba(223,197,106,0.24)]" />
        <div className="absolute inset-[26px] rounded-full bg-[rgba(223,197,106,0.16)] shadow-[0_0_24px_rgba(223,197,106,0.38)]" />
      </div>
    </div>
  );
}

export function ScreeningDetailPage() {
  const { screeningId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, isAuthenticated } = useAuth();
  const {
    data: screening,
    isLoading,
    isError,
  } = useScreeningDetail(screeningId);
  const [now, setNow] = useState(() => Date.now());
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [selectedCouponId, setSelectedCouponId] = useState("");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const loyaltyQuery = useQuery({
    queryKey: ["loyalty", "me", session?.access_token],
    enabled: Boolean(session?.access_token),
    queryFn: () => getMyLoyaltyWallet(session?.access_token as string),
  });
  const screeningPurchaseSucceeded =
    searchParams.get("purchase") === "screening-success";
  const screeningPurchasedQuantity = searchParams.get("quantity") ?? "1";

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const screeningCheckoutMutation = useMutation({
    mutationFn: async ({
      quantity,
      couponId,
    }: {
      quantity: number;
      couponId: string | null;
    }) => {
      if (!screeningId || !session?.access_token) {
        throw new Error("Login is required to buy tickets.");
      }

      return createScreeningCheckoutSession(
        screeningId,
        quantity,
        session.access_token,
        couponId,
      );
    },
    onSuccess: (checkout) => {
      window.location.assign(checkout.checkout_url);
    },
  });

  const effectiveCapacity = screening
    ? screening.max_tickets || screening.hall_capacity
    : 0;
  const remainingCapacity = screening
    ? Math.max(effectiveCapacity - screening.tickets_sold, 0)
    : 0;
  const isSoldOut = remainingCapacity <= 0;
  const availableCoupons = loyaltyQuery.data?.coupons ?? [];
  const selectedCoupon =
    availableCoupons.find((coupon) => coupon.id === selectedCouponId) ?? null;
  const subtotalCents = screening ? screening.ticket_price_cents * ticketQuantity : 0;
  const discountCents = selectedCoupon
    ? Math.min(
        Math.floor((subtotalCents * selectedCoupon.discount_percent) / 100),
        selectedCoupon.max_discount_cents,
      )
    : 0;
  const totalCents = Math.max(subtotalCents - discountCents, 0);
  const totalPrice = (totalCents / 100).toFixed(2);
  const progressPercentage = screening
    ? Math.min(
        (screening.tickets_sold /
          Math.max(screening.min_tickets_to_confirm, 1)) *
          100,
        100,
      )
    : 0;
  const screeningShareTitle = screening
    ? `${screening.movie_title} on Kinora`
    : "Kinora screening";
  const screeningShareText = screening
    ? `Help ${screening.movie_title} reach the screen at ${screening.cinema_name} on Kinora.`
    : "Help this screening reach the screen on Kinora.";

  const detailTone = useMemo(() => {
    if (screening?.status === "confirmed") {
      return {
        accent: "#86efac",
        border: "rgba(74,222,128,0.28)",
        badgeBg: "rgba(16,185,129,0.16)",
        badgeColor: "#86efac",
        badgeBorder: "rgba(134,239,172,0.52)",
        badgeChipBg: "rgba(134,239,172,0.16)",
        badgeGlow: "rgba(74,222,128,0.28)",
      };
    }

    return {
      accent: "#DFC56A",
      border: "rgba(223,197,106,0.22)",
      badgeBg: "rgba(223,197,106,0.12)",
      badgeColor: "#DFC56A",
      badgeBorder: "rgba(223,197,106,0.52)",
      badgeChipBg: "rgba(223,197,106,0.16)",
      badgeGlow: "rgba(223,197,106,0.26)",
    };
  }, [screening?.status]);

  function dismissPurchaseSuccess() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("purchase");
    nextParams.delete("quantity");
    nextParams.delete("order_id");
    nextParams.delete("screening_id");
    setSearchParams(nextParams, { replace: true });
  }

  const deadlineLabel = screening
    ? screening.status === "confirmed"
      ? "Confirmed Screening"
      : formatCountdown(
          getDecisionDeadline(
            screening.starts_at,
            screening.decision_days_before_start,
          ),
          now,
        )
    : "TBA";

  async function handleCheckout() {
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

    try {
      setCheckoutError(null);
      await screeningCheckoutMutation.mutateAsync({
        quantity: ticketQuantity,
        couponId: selectedCouponId || null,
      });
    } catch (error) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : "Checkout could not be started.",
      );
    }
  }

  return (
    <section className="relative min-h-screen overflow-hidden pb-24">
      <div className="relative z-10 mx-auto max-w-[1320px] px-[5vw]">
        <header className="flex flex-col gap-6 border-b border-[rgba(122,132,153,0.3)] py-12 md:flex-row md:items-center md:justify-between">
          <button
            type="button"
            onClick={() => navigate("/screenings")}
            className="group flex w-fit cursor-pointer items-center gap-3 text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-dim)] transition-colors duration-300 hover:text-[var(--color-accent)]"
          >
            <span className="flex items-center gap-2 transition-[filter] duration-300 group-hover:drop-shadow-[0_0_10px_rgba(223,197,106,0.55)]">
              <ArrowLeft className="h-4 w-4" />
              <span>Screenings</span>
            </span>
            <span>/</span>
            <span className="text-[var(--color-accent)]">Screening Detail</span>
          </button>
        </header>

        {screeningPurchaseSucceeded ? (
          <div className="mt-8 border border-[rgba(223,197,106,0.32)] bg-[linear-gradient(135deg,rgba(223,197,106,0.12),rgba(27,34,49,0.72))] px-5 py-4 text-white shadow-[0_18px_36px_rgba(0,0,0,0.22)]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-[var(--color-accent)]" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
                    Ticket Purchase Confirmed
                  </p>
                  <p className="mt-1 text-sm leading-6 text-white/92">
                    {screeningPurchasedQuantity} screening{" "}
                    {screeningPurchasedQuantity === "1"
                      ? "ticket was"
                      : "tickets were"}{" "}
                    purchased successfully.
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
          </div>
        ) : null}

        {isLoading ? <ScreeningDetailLoadingState /> : null}

        {isError ? (
          <div className="mt-12 rounded border border-[rgba(223,197,106,0.2)] bg-[rgba(27,34,49,0.55)] p-6 text-sm text-[var(--color-text-dim)]">
            Could not load this screening.
          </div>
        ) : null}

        {screening ? (
          <div className="grid items-start gap-10 py-12 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="relative self-start overflow-hidden rounded-sm border border-[rgba(255,255,255,0.08)] bg-[rgba(19,26,39,0.6)] shadow-[0_0_30px_rgba(0,0,0,0.28)]">
              <div className="absolute right-4 top-4 z-10">
                <span
                  className="inline-flex items-center gap-2 rounded-full border px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] shadow-[0_14px_30px_rgba(0,0,0,0.42)] backdrop-blur-md"
                  style={{
                    borderColor: detailTone.badgeBorder,
                    backgroundColor: "rgba(8,12,20,0.94)",
                    boxShadow: `0 14px 30px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 18px ${detailTone.badgeGlow}`,
                    color: "#f8fafc",
                  }}
                >
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-1"
                    style={{
                      backgroundColor: detailTone.badgeChipBg,
                      color: detailTone.badgeColor,
                    }}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: detailTone.badgeColor,
                        boxShadow: `0 0 12px ${detailTone.badgeColor}`,
                      }}
                    />
                    {screening.status === "confirmed" ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <Clock3 className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <span className="pr-1 text-[11px] tracking-[0.16em] text-white">
                    {screening.status === "confirmed" ? "Confirmed" : "Selling"}
                  </span>
                </span>
              </div>
              {screening.movie_poster_url ? (
                <img
                  src={tmdbImageUrl(screening.movie_poster_url, "w500")}
                  alt={screening.movie_title}
                  loading="eager"
                  decoding="async"
                  className="aspect-[3/4] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[3/4] items-center justify-center text-sm text-[var(--color-text-dim)]">
                  Poster unavailable
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[rgba(19,26,39,0.96)] via-[rgba(19,26,39,0.18)] to-transparent" />
            </div>

            <div className="flex flex-col gap-8">
              <div>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <span
                    className="rounded-sm px-3 py-1 text-[10px] uppercase tracking-[0.18em]"
                    style={{
                      backgroundColor: detailTone.badgeBg,
                      color: detailTone.badgeColor,
                    }}
                  >
                    {deadlineLabel}
                  </span>
                  <ShareMenu
                    title={screeningShareTitle}
                    text={screeningShareText}
                    path={
                      screeningId
                        ? `${env.shareBaseUrl}/share/screenings/${screeningId}`
                        : undefined
                    }
                    align="left"
                  />
                </div>

                <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                  <h1 className="font-display text-[4rem] uppercase leading-[0.9] text-white sm:text-[5.5rem]">
                    {screening.movie_title}
                  </h1>
                  <span className="pb-2 font-mono text-sm tracking-[0.18em] text-[var(--color-text-dim)] sm:text-base">
                    {screening.movie_release_year ?? "Year TBA"}
                  </span>
                </div>

                <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--color-text-dim)] sm:text-lg">
                  {screening.movie_overview?.trim() ||
                    "A full description for this film is not available yet."}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
                <div className="min-w-0">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[rgba(122,132,153,0.65)]">
                    Cinema
                  </span>
                  <span className="mt-1 block text-base font-medium text-white">
                    {screening.cinema_name}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[rgba(122,132,153,0.65)]">
                    Location
                  </span>
                  <span className="mt-1 flex items-center gap-2 text-base font-medium text-white">
                    {screening.location_name ?? screening.city_name}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[rgba(122,132,153,0.65)]">
                    Date
                  </span>
                  <span className="mt-1 flex items-center gap-2 whitespace-nowrap text-base font-medium text-white">
                    {formatSlot(screening.starts_at)}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[rgba(122,132,153,0.65)]">
                    Hall
                  </span>
                  <span className="mt-1 block text-base font-medium text-white">
                    {screening.hall_name}
                  </span>
                </div>
              </div>

              <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-sm border border-[rgba(223,197,106,0.16)] bg-[rgba(27,34,49,0.55)] p-6">
                  <div className="mb-3 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-dim)]">
                        Threshold Progress
                      </p>
                      <p className="mt-2 font-display text-4xl tracking-[0.04em] text-white">
                        {screening.tickets_sold}
                        <span className="text-2xl text-[var(--color-text-dim)]">
                          {" "}
                          / {screening.min_tickets_to_confirm}
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-dim)]">
                        Status
                      </p>
                      <p
                        className="mt-2 text-sm font-semibold uppercase tracking-[0.14em]"
                        style={{ color: detailTone.accent }}
                      >
                        {screening.status === "confirmed"
                          ? "Goal Reached"
                          : `${Math.max(
                              screening.min_tickets_to_confirm -
                                screening.tickets_sold,
                              0,
                            )} left to confirm`}
                      </p>
                    </div>
                  </div>

                  <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                      style={{
                        width: `${progressPercentage}%`,
                        backgroundColor: detailTone.accent,
                        boxShadow:
                          screening.status === "confirmed"
                            ? "0 0 10px rgba(74,222,128,0.7)"
                            : "0 0 10px rgba(223,197,106,0.45)",
                      }}
                    />
                  </div>

                  <p className="mt-4 text-sm leading-6 text-[var(--color-text-dim)]">
                    {screening.status === "confirmed"
                      ? "This screening is locked in and guaranteed to play."
                      : "Every ticket purchased here counts toward confirming this screening."}
                  </p>

                </div>

                <div className="flex h-full flex-col rounded-sm border border-[rgba(223,197,106,0.22)] bg-[rgba(19,26,39,0.75)] p-5">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-dim)]">
                    Ticket Checkout
                  </p>
                  <p className="mt-2 font-display text-[2.6rem] leading-none text-[var(--color-accent)]">
                    {formatPrice(screening.ticket_price_cents)}
                  </p>
                  <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-dim)]">
                    {remainingCapacity} tickets remaining
                  </p>

                  <div className="mt-4 grid gap-4 border-y border-[rgba(122,132,153,0.22)] py-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[12px] uppercase tracking-[0.14em] text-[var(--color-text-dim)]">
                        Quantity
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setTicketQuantity((current) =>
                              Math.max(current - 1, 1),
                            )
                          }
                          disabled={
                            ticketQuantity <= 1 ||
                            screeningCheckoutMutation.isPending
                          }
                          className="flex h-9 w-9 cursor-pointer items-center justify-center border border-[rgba(122,132,153,0.3)] text-[var(--color-accent)] transition-colors hover:border-[var(--color-accent)] hover:bg-[rgba(223,197,106,0.05)] disabled:cursor-not-allowed disabled:text-[rgba(255,255,255,0.35)]"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="min-w-[2ch] text-center font-display text-3xl leading-none text-white">
                          {ticketQuantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setTicketQuantity((current) =>
                              Math.min(
                                current + 1,
                                Math.max(remainingCapacity, 1),
                              ),
                            )
                          }
                          disabled={
                            ticketQuantity >= remainingCapacity ||
                            screeningCheckoutMutation.isPending ||
                            isSoldOut
                          }
                          className="flex h-9 w-9 cursor-pointer items-center justify-center border border-[rgba(122,132,153,0.3)] text-[var(--color-accent)] transition-colors hover:border-[var(--color-accent)] hover:bg-[rgba(223,197,106,0.05)] disabled:cursor-not-allowed disabled:text-[rgba(255,255,255,0.35)]"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {availableCoupons.length > 0 ? (
                      <div className="grid gap-2">
                        <p className="text-[12px] uppercase tracking-[0.14em] text-[var(--color-text-dim)]">
                          Coupon
                        </p>
                        <div className="grid gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedCouponId("")}
                            disabled={screeningCheckoutMutation.isPending}
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
                              disabled={screeningCheckoutMutation.isPending}
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
                                Max {formatPrice(coupon.max_discount_cents)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {discountCents > 0 ? (
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] uppercase tracking-[0.14em] text-[var(--color-text-dim)]">
                          Discount
                        </span>
                        <span className="text-sm font-semibold text-emerald-300">
                          -{formatPrice(discountCents)}
                        </span>
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between">
                      <span className="text-[12px] uppercase tracking-[0.14em] text-[var(--color-text-dim)]">
                        Total
                      </span>
                      <span className="font-display text-[1.4rem] leading-none text-[var(--color-accent)]">
                        ${totalPrice}
                      </span>
                    </div>
                  </div>

                  {checkoutError ? (
                    <p className="mt-3 text-[12px] leading-5 text-[#f3b2b2]">
                      {checkoutError}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void handleCheckout()}
                    disabled={screeningCheckoutMutation.isPending || isSoldOut}
                    className="mt-auto flex w-full cursor-pointer items-center justify-center gap-2 bg-[var(--color-accent)] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-bg-primary)] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-75"
                  >
                    <Ticket className="h-4 w-4" />
                    {isSoldOut ? "Sold Out" : "Buy Ticket"}
                    {screeningCheckoutMutation.isPending ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : null}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
