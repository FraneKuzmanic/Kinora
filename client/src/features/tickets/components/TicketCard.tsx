import {
  Download,
  ExternalLink,
  Info,
  MapPin,
  Ticket,
  Undo2,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { AdmissionRead } from "@/lib/api/tickets";
import { tmdbImageUrl } from "@/lib/images";
import {
  deriveTicketBucket,
  formatMoney,
  formatTicketDateLabel,
  getTicketAccent,
  getTicketLocation,
  getTicketNote,
  getTicketStatusLabel,
  getTicketTypeLabel,
} from "@/features/tickets/lib/tickets";

type TicketCardProps = {
  admission: AdmissionRead;
  isRefunding: boolean;
  isDownloading: boolean;
  onViewTicket: (admission: AdmissionRead) => void;
  onDownloadPdf: (admission: AdmissionRead) => Promise<void>;
  onRequestRefund: (admission: AdmissionRead) => Promise<void>;
};

function TicketNotchDivider({ color }: { color: string }) {
  return (
    <div
      className="relative z-20 h-px w-full flex-shrink-0 border-t-2 border-dashed sm:h-auto sm:w-px sm:border-l-2 sm:border-t-0"
      style={{ borderColor: color }}
    >
      <div
        className="hidden sm:block"
        style={{
          position: "absolute",
          top: "-12px",
          left: "-12px",
          width: "24px",
          height: "24px",
          backgroundColor: "#131A27",
          borderBottom: `1px solid ${color}`,
          borderRight: `1px solid ${color}`,
          borderRadius: "50%",
          transform: "rotate(45deg)",
        }}
      />
      <div
        className="hidden sm:block"
        style={{
          position: "absolute",
          bottom: "-12px",
          left: "-12px",
          width: "24px",
          height: "24px",
          backgroundColor: "#131A27",
          borderTop: `1px solid ${color}`,
          borderLeft: `1px solid ${color}`,
          borderRadius: "50%",
          transform: "rotate(45deg)",
        }}
      />
    </div>
  );
}

export function TicketCard({
  admission,
  isRefunding,
  isDownloading,
  onViewTicket,
  onDownloadPdf,
  onRequestRefund,
}: TicketCardProps) {
  const accent = getTicketAccent(admission);
  const bucket = deriveTicketBucket(admission);
  const showViewActions =
    bucket !== "pending" &&
    admission.status !== "refunded" &&
    admission.status !== "void";
  const posterUrl =
    admission.resolved_movie_poster_url ??
    admission.selected_movie_poster_url ??
    admission.movie_poster_url;

  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-sm shadow-[0_0_20px_rgba(0,0,0,0.5)] transition-all duration-300 hover:shadow-[0_0_30px_rgba(223,197,106,0.1)] sm:flex-row"
      style={{
        border: `1px solid ${accent.border}`,
        backgroundColor: "#1b2231",
      }}
    >
      <div className="flex min-w-0 flex-1 gap-5 p-5">
        <div
          className="absolute bottom-0 left-0 top-0 w-1 rounded-l-sm"
          style={{ backgroundColor: accent.rail }}
        />

        <div className="relative h-36 w-24 flex-shrink-0 overflow-hidden rounded shadow-md border border-white/10">
          {posterUrl ? (
            <img
              src={tmdbImageUrl(posterUrl, "w185")}
              alt={admission.movie_title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
              style={
                bucket === "refund" ? { filter: "grayscale(70%)" } : undefined
              }
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[rgba(255,255,255,0.04)] text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-dim)]">
              No Poster
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between py-1 pr-2">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 rounded-sm border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] uppercase tracking-widest text-white">
                <Ticket className="h-2.5 w-2.5" />
                {getTicketTypeLabel(admission)}
              </span>
              <div className="group/info relative">
                <button
                  type="button"
                  className="flex h-3 w-3 cursor-pointer items-center justify-center  text-[var(--color-text-dim)] transition-colors hover:text-white focus:text-white focus:outline-none"
                  aria-label="Show ticket status details"
                >
                  <Info className="h-6 w-6" />
                </button>
                <div className="pointer-events-none absolute left-0 top-full z-30 mt-2 w-64 translate-y-1 rounded-sm border border-[rgba(223,197,106,0.18)] bg-[rgba(19,26,39,0.96)] px-3 py-3 text-[11px] leading-relaxed text-[var(--color-text-dim)] opacity-0 shadow-[0_18px_36px_rgba(0,0,0,0.32)] transition-all duration-200 group-hover/info:translate-y-0 group-hover/info:opacity-100 group-focus-within/info:translate-y-0 group-focus-within/info:opacity-100">
                  {getTicketNote(admission)}
                </div>
              </div>
            </div>

            <h3
              className="max-w-full truncate font-heading text-2xl leading-tight text-white"
              title={admission.movie_title}
            >
              {admission.movie_title}
            </h3>

            <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-[var(--color-text-dim)]">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              {getTicketLocation(admission) || "Cinema details pending"}
            </p>

            <p className="mt-2 text-sm font-medium text-[var(--color-accent)]">
              {formatTicketDateLabel(admission)}
            </p>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-3">
              <span className="font-mono text-xs text-white/92">
                {formatMoney(admission.total_price_cents)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        <TicketNotchDivider color={accent.border} />
      </div>

      <div
        className="relative flex w-full flex-row items-center justify-between overflow-hidden p-5 sm:w-44 sm:flex-shrink-0 sm:flex-col"
        style={{ backgroundColor: accent.subtle }}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(#131A27 40%, transparent 40%)",
            backgroundSize: "8px 8px",
          }}
        />

        <div className="relative z-10 text-left sm:text-center">
          <span className="block text-[9px] uppercase tracking-widest text-[var(--color-text-dim)]">
            Admit
          </span>
          <span className="font-display text-3xl leading-none tracking-wider text-white">
            {admission.quantity}
            <span className="text-lg text-[var(--color-text-dim)]">x</span>
          </span>
        </div>

        <div className="relative z-10 flex flex-row gap-4 sm:w-full sm:flex-col sm:gap-3">
          {showViewActions ? (
            <button
              type="button"
              onClick={() => onViewTicket(admission)}
              className="cursor-pointer whitespace-nowrap bg-[var(--color-accent)] px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--color-bg-primary)] transition-colors hover:bg-white sm:w-full"
            >
              View Ticket
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="cursor-not-allowed whitespace-nowrap border border-white/10 bg-white/5 px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-dim)] sm:w-full"
            >
              Not Ready
            </button>
          )}

          <button
            type="button"
            onClick={() => onDownloadPdf(admission)}
            disabled={isDownloading}
            className="flex cursor-pointer items-center justify-center gap-1.5 text-[10px] uppercase tracking-widest text-[var(--color-text-dim)] underline decoration-[rgba(122,132,153,0.3)] underline-offset-4 transition-colors hover:text-white disabled:cursor-wait disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" />
            PDF
          </button>

          {bucket === "pending" && admission.type === "campaign_earlybird" ? (
            <Link
              to={
                admission.campaign_id
                  ? `/campaigns/${admission.campaign_id}`
                  : "/campaigns"
              }
              className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-widest text-[var(--color-accent)] transition-colors hover:text-white"
            >
              View Campaign
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : null}

          {bucket === "pending" &&
          admission.type === "screening_ticket" &&
          admission.screening_id ? (
            <Link
              to={`/screenings/${admission.screening_id}`}
              className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-widest text-[var(--color-accent)] transition-colors hover:text-white"
            >
              View Screening
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : null}

          {bucket === "refund" ? (
            <button
              type="button"
              onClick={() => onRequestRefund(admission)}
              disabled={isRefunding}
              className="flex cursor-pointer items-center justify-center gap-1.5 rounded-sm border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors disabled:cursor-wait disabled:opacity-60"
              style={{
                borderColor: accent.text,
                color: accent.text,
                backgroundColor: "transparent",
              }}
            >
              <Undo2 className="h-3.5 w-3.5" />
              {isRefunding ? "Requesting" : "Refund"}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
