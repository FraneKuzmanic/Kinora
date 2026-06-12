import { History } from "lucide-react";
import { ValidatorStatusBadge } from "@/features/validator/components/ValidatorStatusBadge";
import type { RecentScanItem, ScanOutcome } from "@/features/validator/types";

type ValidatorRecentScansProps = {
  scans: RecentScanItem[];
};

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("hr-HR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function getBadgeTone(status: ScanOutcome) {
  if (status === "redeemable" || status === "redeemed") {
    return "green" as const;
  }

  if (status === "blocked") {
    return "gold" as const;
  }

  return "red" as const;
}

function getStatusLabel(status: ScanOutcome) {
  if (status === "redeemable") {
    return "Ready";
  }

  if (status === "redeemed") {
    return "Redeemed";
  }

  if (status === "blocked") {
    return "Blocked";
  }

  return "Invalid";
}

export function ValidatorRecentScans({ scans }: ValidatorRecentScansProps) {
  return (
    <section className="border border-[rgba(223,197,106,0.18)] bg-[rgba(19,26,39,0.84)] p-3 shadow-[0_18px_42px_rgba(3,7,18,0.2)] sm:p-5 sm:shadow-[0_24px_60px_rgba(3,7,18,0.24)]">
      <div className="mb-3 flex items-center justify-between gap-4 border-b border-[rgba(223,197,106,0.12)] pb-3 sm:mb-5 sm:pb-4">
        <div>
          <p className="text-[9px] uppercase tracking-[0.18em] text-[rgba(223,197,106,0.72)] sm:text-[11px] sm:tracking-[0.28em]">
            Session activity
          </p>
          <h2 className="mt-1 font-heading text-lg text-white sm:mt-2 sm:text-2xl">Recent scans</h2>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(223,197,106,0.18)] bg-[rgba(223,197,106,0.08)] text-[var(--color-accent)] sm:h-11 sm:w-11">
          <History className="h-5 w-5" />
        </div>
      </div>

      {scans.length === 0 ? (
        <div className="border border-dashed border-[rgba(223,197,106,0.18)] bg-[rgba(8,12,20,0.4)] px-4 py-4 text-center text-sm text-[var(--color-text-dim)] sm:py-8">
          No tickets scanned yet in this session.
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {scans.slice(0, 5).map((scan) => (
            <div
              key={scan.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border border-[rgba(223,197,106,0.12)] bg-[rgba(8,12,20,0.46)] px-3 py-3 sm:gap-3 sm:px-4 sm:py-4 md:grid-cols-[minmax(0,1.5fr)_auto_auto]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {scan.movieTitle ?? scan.tokenLabel}
                </p>
                <p className="mt-1 truncate text-xs text-[var(--color-text-dim)]">
                  {scan.admissionId ? `Admission ${scan.admissionId.slice(0, 8)}` : scan.tokenLabel}
                </p>
              </div>

              <div className="flex items-center">
                <ValidatorStatusBadge
                  label={getStatusLabel(scan.status)}
                  tone={getBadgeTone(scan.status)}
                />
              </div>

              <div className="col-span-2 text-left md:col-span-1 md:text-right">
                <p className="text-xs text-white">{formatTimestamp(scan.timestamp)}</p>
                <p className="mt-1 text-xs text-[var(--color-text-dim)]">{scan.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
