import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Calendar,
  Check,
  Clock3,
  LoaderCircle,
  MapPin,
  Minus,
  Plus,
  Ticket,
} from "lucide-react";
import { ShareMenu } from "@/components/ShareMenu";
import { env } from "@/config/env";
import type { ScreeningRead } from "@/lib/api/screenings";
import { tmdbImageUrl } from "@/lib/images";

export type ScreeningCardVariant =
  | "confirmed"
  | "almost"
  | "ending"
  | "default";

type ScreeningCardProps = {
  screening: ScreeningRead;
  variant: ScreeningCardVariant;
  label: string;
  subtitle: string;
  progressPercentage: number;
  ticketsLeftToConfirm: number;
  deadlineLabel?: string | null;
  priceLabel: string;
  isProcessing: boolean;
  onBuy: (quantity: number) => Promise<void>;
  onView?: () => void;
  showStatusChrome?: boolean;
  constrainedWidth?: boolean;
};

function variantStyles(variant: ScreeningCardVariant) {
  if (variant === "confirmed") {
    return {
      borderColor: "rgba(74, 222, 128, 0.35)",
      hoverBorderColor: "rgba(74, 222, 128, 0.75)",
      badgeBackground: "rgba(16,185,129,0.18)",
      badgeBorder: "rgba(74,222,128,0.45)",
      badgeColor: "#86efac",
      progressBackground: "#34d399",
      progressShadow: "0 0 10px rgba(74,222,128,0.7)",
      buttonBackground: "#DFC56A",
      buttonForeground: "#131A27",
      buttonBorder: "rgba(223,197,106,0.45)",
      accentColor: "#86efac",
      sectionGlow: "rgba(74,222,128,0.06)",
    };
  }

  if (variant === "ending") {
    return {
      borderColor: "rgba(248, 113, 113, 0.28)",
      hoverBorderColor: "rgba(248, 113, 113, 0.62)",
      badgeBackground: "rgba(239,68,68,0.18)",
      badgeBorder: "rgba(248,113,113,0.42)",
      badgeColor: "#fca5a5",
      progressBackground: "#f87171",
      progressShadow: "none",
      buttonBackground: "#DFC56A",
      buttonForeground: "#131A27",
      buttonBorder: "rgba(223,197,106,0.45)",
      accentColor: "#f87171",
      sectionGlow: "rgba(248,113,113,0.04)",
    };
  }

  return {
    borderColor: "rgba(223,197,106,0.3)",
    hoverBorderColor: "rgba(223,197,106,0.75)",
    badgeBackground: "rgba(19,26,39,0.82)",
    badgeBorder: "rgba(223,197,106,0.35)",
    badgeColor: "#DFC56A",
    progressBackground: "#DFC56A",
    progressShadow:
      variant === "almost" ? undefined : "0 0 10px rgba(223,197,106,0.45)",
    buttonBackground: "#DFC56A",
    buttonForeground: "#131A27",
    buttonBorder: "rgba(223,197,106,0.45)",
    accentColor: "#DFC56A",
    sectionGlow: "rgba(223,197,106,0.04)",
  };
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

export function ScreeningCard({
  screening,
  variant,
  label,
  subtitle,
  progressPercentage,
  ticketsLeftToConfirm,
  deadlineLabel,
  priceLabel,
  isProcessing,
  onBuy,
  onView,
  showStatusChrome = true,
  constrainedWidth = true,
}: ScreeningCardProps) {
  const styles = variantStyles(variant);
  const isConfirmed = screening.status === "confirmed";
  const progressAccent = showStatusChrome ? styles.progressBackground : "#DFC56A";
  const progressShadow = showStatusChrome ? styles.progressShadow : "0 0 10px rgba(223,197,106,0.45)";
  const useStripedProgress = showStatusChrome && variant === "almost";
  const labelAccent = showStatusChrome ? styles.accentColor : "#DFC56A";
  const effectiveCapacity = screening.max_tickets || screening.hall_capacity;
  const remainingCapacity = Math.max(effectiveCapacity - screening.tickets_sold, 0);
  const isSoldOut = remainingCapacity <= 0;
  const [isCheckoutPopoverOpen, setIsCheckoutPopoverOpen] = useState(false);
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const checkoutPopoverRef = useRef<HTMLDivElement | null>(null);
  const totalPrice = ((screening.ticket_price_cents * ticketQuantity) / 100).toFixed(2);
  const screeningShareTitle = `${screening.movie_title} on Kinora`;
  const screeningShareText = `Help ${screening.movie_title} reach the screen at ${screening.cinema_name} on Kinora.`;

  useEffect(() => {
    if (!isCheckoutPopoverOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (
        checkoutPopoverRef.current &&
        !checkoutPopoverRef.current.contains(event.target as Node)
      ) {
        setIsCheckoutPopoverOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isCheckoutPopoverOpen]);

  useEffect(() => {
    if (!isCheckoutPopoverOpen) {
      setTicketQuantity(1);
      setCheckoutError(null);
      return;
    }

    setTicketQuantity((current) =>
      Math.min(Math.max(current, 1), Math.max(remainingCapacity, 1)),
    );
  }, [isCheckoutPopoverOpen, remainingCapacity]);

  async function handleCheckout() {
    try {
      setCheckoutError(null);
      await onBuy(ticketQuantity);
      setIsCheckoutPopoverOpen(false);
    } catch (error) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : "Checkout could not be started.",
      );
    }
  }

  return (
    <article
      role={onView ? "button" : undefined}
      tabIndex={onView ? 0 : undefined}
      className={`group relative flex cursor-default flex-col rounded-sm p-6 transition-all duration-500 ${
        constrainedWidth ? "w-[310px] flex-shrink-0" : "w-full max-w-[310px]"
      } ${showStatusChrome ? "border hover:shadow-[0_0_40px_rgba(223,197,106,0.14)]" : "border border-transparent shadow-none"} ${
        onView ? "cursor-pointer" : "cursor-default"
      }`}
      style={{
        backgroundColor: "#1b2231",
        borderColor: showStatusChrome ? styles.borderColor : "transparent",
        boxShadow: showStatusChrome ? `0 0 20px ${styles.sectionGlow}` : "none",
      }}
      onClick={onView}
      onKeyDown={
        onView
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onView();
              }
            }
          : undefined
      }
      onMouseEnter={
        showStatusChrome
          ? (event) => {
              event.currentTarget.style.borderColor = styles.hoverBorderColor;
            }
          : undefined
      }
      onMouseLeave={
        showStatusChrome
          ? (event) => {
              event.currentTarget.style.borderColor = styles.borderColor;
            }
          : undefined
      }
    >
      <ShareMenu
        title={screeningShareTitle}
        text={screeningShareText}
        path={`${env.shareBaseUrl}/share/screenings/${screening.id}`}
        align="right"
        variant="compact"
        className="absolute right-3 top-3 z-20"
      />

      {showStatusChrome ? (
        <div className="mb-6 flex items-start justify-between gap-3 pr-8">
          <span
            className="flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest"
            style={{
              backgroundColor: styles.badgeBackground,
              borderColor: styles.badgeBorder,
              color: styles.badgeColor,
            }}
          >
            {isConfirmed ? <Check className="h-3 w-3" /> : null}
            {label}
          </span>
          <div className="flex items-start gap-2">
            {deadlineLabel ? (
              <span className="flex items-center gap-1.5 text-right text-[10px] uppercase tracking-widest text-[var(--color-text-dim)]">
                <Clock3
                  className="h-3 w-3 flex-shrink-0"
                  style={{ color: styles.accentColor }}
                />
                {deadlineLabel}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className="relative mb-7 w-full overflow-hidden rounded-sm border"
        style={{
          aspectRatio: "3 / 4",
          backgroundColor: "rgba(19,26,39,0.55)",
          borderColor: "rgba(255,255,255,0.06)",
        }}
      >
        {screening.movie_poster_url ? (
          <img
            src={tmdbImageUrl(screening.movie_poster_url, "w342")}
            alt={screening.movie_title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-center text-sm text-[var(--color-text-dim)]">
            Poster unavailable
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(19,26,39,0.96)] via-[rgba(19,26,39,0.12)] to-transparent" />
        {onView ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onView();
            }}
            className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 translate-y-2 cursor-pointer items-center justify-center gap-2 whitespace-nowrap border border-[rgba(223,197,106,0.38)] bg-[rgba(12,16,24,0.82)] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-accent)] opacity-0 backdrop-blur-sm transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 hover:bg-[rgba(223,197,106,0.12)]"
          >
            View Screening
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div className="mb-5 flex flex-1 flex-col">
        <div className="mb-2 flex items-start justify-between gap-3">
          <h3 className="font-heading text-[1.75rem] leading-tight text-white transition-colors duration-300 group-hover:text-[var(--color-accent)]">
            {screening.movie_title}
          </h3>
          {screening.movie_release_year ? (
            <span className="mt-1 text-xs font-mono text-[var(--color-text-dim)]">
              {screening.movie_release_year}
            </span>
          ) : null}
        </div>

        <p className="mb-1 flex items-center gap-1.5 text-xs text-[var(--color-text-dim)]">
          <MapPin className="h-3 w-3" />
          {screening.cinema_name}
          <span className="text-[rgba(122,132,153,0.6)]">•</span>
          {screening.location_name ?? screening.city_name}
        </p>

        <p className="mb-4 flex items-center gap-1.5 text-sm font-medium text-white">
          <Calendar className="h-3.5 w-3.5 text-[var(--color-accent)]" />
          {formatSlot(screening.starts_at)}
        </p>

        <div
          className="mt-auto rounded border p-4"
          style={{
            backgroundColor: "rgba(19,26,39,0.5)",
            borderColor: "rgba(255,255,255,0.05)",
          }}
        >
          <div className="mb-2 flex items-end justify-between gap-3">
            <span
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: labelAccent }}
            >
              {subtitle}
            </span>
            <span className="text-xs font-mono text-white">
              {screening.tickets_sold}
              <span className="text-[var(--color-text-dim)]">
                {" "}
                / {screening.min_tickets_to_confirm}
              </span>
            </span>
          </div>

          <div className="relative h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className={
                useStripedProgress
                  ? "absolute inset-y-0 left-0 rounded-full transition-all duration-700 [background-image:linear-gradient(45deg,rgba(255,255,255,.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.15)_50%,rgba(255,255,255,.15)_75%,transparent_75%,transparent)] [background-size:1rem_1rem] [animation:progressStripes_1s_linear_infinite]"
                  : "absolute inset-y-0 left-0 rounded-full transition-all duration-700"
              }
              style={{
                width: `${Math.max(0, Math.min(progressPercentage, 100))}%`,
                backgroundColor: progressAccent,
                boxShadow: progressShadow,
              }}
            />
          </div>
        </div>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            if (isSoldOut || isProcessing) {
              return;
            }
            setCheckoutError(null);
            setIsCheckoutPopoverOpen((current) => !current);
          }}
          disabled={isSoldOut || isProcessing}
          className="flex w-full cursor-pointer items-center justify-between border py-3.5 pl-6 pr-5 text-xs font-bold uppercase tracking-[0.15em] transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-80"
          style={{
            backgroundColor: styles.buttonBackground,
            borderColor: styles.buttonBorder,
            color: styles.buttonForeground,
          }}
        >
          <span className="flex items-center gap-2">
            <Ticket className="h-3.5 w-3.5" />
            {isSoldOut ? "Sold Out" : "Buy Ticket"}
          </span>
          <span>{priceLabel}</span>
        </button>

        {isCheckoutPopoverOpen && !isSoldOut ? (
          <div
            ref={checkoutPopoverRef}
            onClick={(event) => event.stopPropagation()}
            className="absolute bottom-[calc(100%+12px)] right-0 z-30 w-[270px] rounded-[4px] border border-[var(--color-accent)] bg-[rgba(19,26,39,0.97)] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.48)]"
          >
            <div className="absolute bottom-[-6px] right-[18px] h-[10px] w-[10px] rotate-45 border-b border-r border-[rgba(122,132,153,0.3)] bg-[rgba(19,26,39,0.97)]" />

            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-display text-[0.95rem] uppercase tracking-[0.05em] text-[var(--color-accent)]">
                  Ticket Checkout
                </h4>
                <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-dim)]">
                  {remainingCapacity} tickets remaining
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCheckoutPopoverOpen(false)}
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
                      setTicketQuantity((current) => Math.max(current - 1, 1))
                    }
                    disabled={ticketQuantity <= 1 || isProcessing}
                    className="flex h-9 w-9 items-center justify-center border border-[rgba(122,132,153,0.3)] text-[var(--color-accent)] transition-colors duration-300 hover:border-[var(--color-accent)] hover:bg-[rgba(223,197,106,0.05)] disabled:cursor-not-allowed disabled:border-[rgba(122,132,153,0.2)] disabled:text-[rgba(255,255,255,0.35)]"
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
                        Math.min(current + 1, remainingCapacity),
                      )
                    }
                    disabled={ticketQuantity >= remainingCapacity || isProcessing}
                    className="flex h-9 w-9 items-center justify-center border border-[rgba(122,132,153,0.3)] text-[var(--color-accent)] transition-colors duration-300 hover:border-[var(--color-accent)] hover:bg-[rgba(223,197,106,0.05)] disabled:cursor-not-allowed disabled:border-[rgba(122,132,153,0.2)] disabled:text-[rgba(255,255,255,0.35)]"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
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
              disabled={isProcessing || remainingCapacity < 1}
              className={`mt-4 w-full px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] transition-all duration-300 ${
                isProcessing
                  ? "cursor-wait bg-[#f0d575] text-[var(--color-bg-primary)] shadow-[0_10px_20px_rgba(223,197,106,0.14)]"
                  : "cursor-pointer bg-[var(--color-accent)] text-[var(--color-bg-primary)] hover:-translate-y-0.5 hover:bg-[#f0d575] hover:shadow-[0_10px_20px_rgba(223,197,106,0.14)]"
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                Continue to Checkout
                {isProcessing ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : null}
              </span>
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
