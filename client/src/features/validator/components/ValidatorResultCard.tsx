import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Ticket,
  XCircle,
} from "lucide-react";
import type { TicketValidationResponse } from "@/lib/api/validator";
import { ValidatorStatusBadge } from "@/features/validator/components/ValidatorStatusBadge";
import type { ValidationPhase } from "@/features/validator/types";
import { cn } from "@/utils/cn";

type ValidatorResultCardProps = {
  result: TicketValidationResponse;
  phase: ValidationPhase;
  apiError: string | null;
  onRedeem: () => void;
  onBackToScanner: () => void;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "Unavailable";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("hr-HR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatAdmissionType(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getResultPresentation(result: TicketValidationResponse, phase: ValidationPhase) {
  if (phase === "redeemed") {
    return {
      title: "Ticket redeemed",
      description: "Entry confirmed. Send the validator back to the scanner for the next guest.",
      tone: "green" as const,
      icon: CheckCircle2,
      borderClass: "border-[rgba(74,222,128,0.32)]",
      panelClass: "bg-[rgba(10,26,18,0.78)]",
    };
  }

  if (!result.valid) {
    return {
      title: "Invalid or unknown ticket",
      description: result.reason ?? "This QR token did not match an admission.",
      tone: "red" as const,
      icon: XCircle,
      borderClass: "border-[rgba(248,113,113,0.28)]",
      panelClass: "bg-[rgba(44,14,20,0.7)]",
    };
  }

  if (result.redeemable) {
    return {
      title: "Valid and redeemable",
      description: "Admission checks out. Redeem only after the guest is confirmed at entry.",
      tone: "green" as const,
      icon: CheckCircle2,
      borderClass: "border-[rgba(74,222,128,0.28)]",
      panelClass: "bg-[rgba(12,30,22,0.72)]",
    };
  }

  if (result.reason === "Admission already redeemed") {
    return {
      title: "Already redeemed",
      description: "This ticket has already been used. Review the redemption time before allowing entry.",
      tone: "gold" as const,
      icon: AlertTriangle,
      borderClass: "border-[rgba(223,197,106,0.32)]",
      panelClass: "bg-[rgba(47,36,12,0.74)]",
    };
  }

  return {
    title: "Valid but not redeemable",
    description: result.reason ?? "This admission exists, but it cannot be redeemed right now.",
    tone: "red" as const,
    icon: Clock3,
    borderClass: "border-[rgba(248,113,113,0.24)]",
    panelClass: "bg-[rgba(44,14,20,0.62)]",
  };
}

function DetailItem({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 border border-[rgba(223,197,106,0.12)] bg-[rgba(8,12,20,0.48)] p-2.5 sm:p-3", className)}>
      <p className="text-[9px] uppercase tracking-[0.12em] text-[var(--color-text-dim)] sm:text-[10px] sm:tracking-[0.24em]">
        {label}
      </p>
      <p className="mt-1.5 break-words text-sm text-white sm:mt-2">{value}</p>
    </div>
  );
}

export function ValidatorResultCard({
  result,
  phase,
  apiError,
  onRedeem,
  onBackToScanner,
}: ValidatorResultCardProps) {
  const presentation = getResultPresentation(result, phase);
  const Icon = presentation.icon;
  const isRedeemActionVisible = result.redeemable && phase === "result";
  const isRedeemPending = phase === "redeeming";

  return (
    <section
      className={cn(
        "h-full border bg-[linear-gradient(180deg,rgba(27,34,49,0.96)_0%,rgba(19,26,39,0.98)_100%)] p-3 shadow-[0_20px_50px_rgba(3,7,18,0.28)] sm:p-5 sm:shadow-[0_24px_60px_rgba(3,7,18,0.32)]",
        presentation.borderClass,
      )}
    >
      <div className="mb-3 flex flex-col items-start justify-between gap-2 sm:mb-5 sm:flex-row sm:gap-4">
        <div>
          <p className="text-[9px] uppercase tracking-[0.18em] text-[rgba(223,197,106,0.72)] sm:text-[11px] sm:tracking-[0.28em]">
            Validation result
          </p>
          <h2 className="mt-1 font-heading text-lg text-white sm:mt-2 sm:text-2xl">
            Review before redeeming
          </h2>
        </div>
        <ValidatorStatusBadge
          label={presentation.title}
          tone={presentation.tone}
          className="max-w-full"
        />
      </div>

      <div className={cn("border p-3 sm:p-4", presentation.borderClass, presentation.panelClass)}>
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 h-6 w-6 shrink-0 text-current" />
          <div>
            <p className="text-base font-semibold text-white sm:text-lg">{presentation.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-[rgba(255,255,255,0.82)]">
              {presentation.description}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3">
        <DetailItem
          label="Movie"
          value={result.movie_title ?? "Unknown title"}
          className="col-span-2 sm:col-span-1"
        />
        <DetailItem label="Start time" value={formatDateTime(result.starts_at)} />
        <DetailItem
          label="Admission type"
          value={formatAdmissionType(result.admission_type)}
          className="hidden sm:block"
        />
        <DetailItem
          label="Quantity"
          value={result.quantity != null ? String(result.quantity) : "Unknown"}
          className="hidden sm:block"
        />
        <DetailItem
          label="Current status"
          value={result.admission_status ?? (result.valid ? "Valid" : "Invalid")}
        />
        <DetailItem
          label="Redeemed at"
          value={result.redeemed_at ? formatDateTime(result.redeemed_at) : "Not redeemed"}
        />
      </div>

      {result.reason ? (
        <div className="mt-3 border border-[rgba(223,197,106,0.16)] bg-[rgba(223,197,106,0.08)] px-3 py-2.5 text-sm text-[rgba(255,255,255,0.84)] sm:mt-4 sm:px-4 sm:py-3">
          <span className="font-medium text-[var(--color-accent)]">Reason:</span> {result.reason}
        </div>
      ) : null}

      {apiError ? (
        <div className="mt-4 border border-[rgba(248,113,113,0.28)] bg-[rgba(127,29,29,0.18)] px-4 py-3 text-sm text-rose-200">
          {apiError}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:mt-6 sm:flex-row sm:gap-3">
        {isRedeemActionVisible ? (
          <button
            type="button"
            onClick={onRedeem}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 border border-[var(--color-accent)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)] sm:tracking-[0.22em]"
          >
            <Ticket className="h-4 w-4" />
            Redeem ticket
          </button>
        ) : null}

        {isRedeemPending ? (
          <button
            type="button"
            disabled
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 border border-[rgba(223,197,106,0.26)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[rgba(255,255,255,0.7)] sm:tracking-[0.22em]"
          >
            Redeeming...
          </button>
        ) : null}

        <button
          type="button"
          onClick={onBackToScanner}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 border border-[rgba(122,132,153,0.35)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[rgba(226,232,240,0.9)] transition-colors hover:border-white hover:text-white sm:tracking-[0.22em]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to scanner
        </button>
      </div>
    </section>
  );
}
