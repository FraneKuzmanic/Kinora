import { useEffect } from "react";
import { Download, X } from "lucide-react";
import type { AdmissionRead } from "@/lib/api/tickets";
import {
  formatTicketDate,
  formatTicketDateLabel,
  getTicketTypeLabel,
} from "@/features/tickets/lib/tickets";
import { TicketQrCode } from "@/features/tickets/components/TicketQrCode";

type TicketPreviewModalProps = {
  admission: AdmissionRead | null;
  isOpen: boolean;
  isDownloading: boolean;
  onClose: () => void;
  onDownload: (admission: AdmissionRead) => Promise<void>;
};

export function TicketPreviewModal({
  admission,
  isOpen,
  isDownloading,
  onClose,
  onDownload,
}: TicketPreviewModalProps) {
  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !admission) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-[rgba(19,26,39,0.95)] backdrop-blur-md"
        onClick={onClose}
      />

      <div className="relative w-full max-w-sm overflow-hidden rounded-sm border border-[rgba(223,197,106,0.4)] bg-[var(--color-bg-main)] shadow-[0_0_50px_rgba(0,0,0,0.8)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 cursor-pointer p-2 text-[var(--color-text-dim)] transition-colors hover:text-white"
          aria-label="Close ticket preview"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="overflow-hidden border-b border-dashed border-[rgba(223,197,106,0.24)] bg-gradient-to-b from-white/5 to-transparent px-6 pb-6 pt-8 text-center">
          <p className="mb-2 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-accent)]">
            Kinora Admission
          </p>
          <h2 className="font-heading text-3xl leading-tight text-white">
            {admission.resolved_movie_title ?? admission.movie_title}
          </h2>
          <p className="mt-2 text-xs text-[var(--color-text-dim)]">
            {formatTicketDateLabel(admission)}
          </p>
        </div>

        <div className="relative flex flex-col items-center justify-center bg-white/[0.02] px-8 py-8">
          <div className="absolute left-4 top-4 h-4 w-4 border-l border-t border-[rgba(223,197,106,0.3)]" />
          <div className="absolute right-4 top-4 h-4 w-4 border-r border-t border-[rgba(223,197,106,0.3)]" />
          <div className="absolute bottom-4 left-4 h-4 w-4 border-b border-l border-[rgba(223,197,106,0.3)]" />
          <div className="absolute bottom-4 right-4 h-4 w-4 border-b border-r border-[rgba(223,197,106,0.3)]" />

          <TicketQrCode value={admission.qr_token} />
        </div>

        <div className="border-t border-dashed border-[rgba(223,197,106,0.24)] bg-black/20 px-6 py-5 text-xs">
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <p className="mb-1 text-[9px] uppercase tracking-widest text-[var(--color-text-dim)]">
                Location
              </p>
              <p className="font-medium text-white">
                {[admission.cinema_name, admission.city_name]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
            <div className="text-right">
              <p className="mb-1 text-[9px] uppercase tracking-widest text-[var(--color-text-dim)]">
                Order #
              </p>
              <p className="font-mono tracking-wider text-white">
                {admission.order_id.slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-4">
            <div>
              <p className="mb-1 text-[9px] uppercase tracking-widest text-[var(--color-text-dim)]">
                Ticket Type
              </p>
              <p className="text-white">{getTicketTypeLabel(admission)}</p>
            </div>
            <div className="text-right">
              <p className="mb-1 text-[9px] uppercase tracking-widest text-[var(--color-text-dim)]">
                Time
              </p>
              <p className="text-white">
                {formatTicketDate(admission.starts_at ?? admission.campaign_slot_starts_at)}
              </p>
            </div>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <p className="mb-1 text-[9px] uppercase tracking-widest text-[var(--color-text-dim)]">
                Admit
              </p>
              <p className="font-display text-3xl leading-none tracking-wider text-[var(--color-accent)]">
                {admission.quantity}
                <span className="text-lg text-[var(--color-text-dim)]">x</span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => onDownload(admission)}
              disabled={isDownloading}
              className="flex cursor-pointer items-center gap-1.5 text-[var(--color-text-dim)] underline decoration-[rgba(122,132,153,0.3)] underline-offset-4 transition-colors hover:text-white disabled:cursor-wait disabled:opacity-60"
            >
              <Download className="h-3.5 w-3.5" />
              {isDownloading ? "Preparing PDF" : "Save PDF"}
            </button>
          </div>
        </div>

        <div className="bg-[var(--color-accent)] py-2 text-center">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-bg-primary)]">
            Present at cinema entry
          </p>
        </div>
      </div>
    </div>
  );
}
