import {
  Camera,
  CameraOff,
  Keyboard,
  LoaderCircle,
  Play,
  Square,
} from "lucide-react";
import { ValidatorStatusBadge } from "@/features/validator/components/ValidatorStatusBadge";
import type { CameraState, ValidationPhase } from "@/features/validator/types";
import { cn } from "@/utils/cn";

type ValidatorScannerPanelProps = {
  scannerId: string;
  phase: ValidationPhase;
  cameraState: CameraState;
  cameraStatusLabel: string;
  cameraError: string | null;
  apiError: string | null;
  showManualEntry: boolean;
  manualToken: string;
  isBusy: boolean;
  disableStart: boolean;
  onManualTokenChange: (value: string) => void;
  onToggleManualEntry: () => void;
  onManualSubmit: () => void;
  onStartScanner: () => void;
  onStopScanner: () => void;
};

function getCameraTone(cameraState: CameraState) {
  if (cameraState === "ready") {
    return "green" as const;
  }

  if (cameraState === "blocked" || cameraState === "error") {
    return "red" as const;
  }

  return "slate" as const;
}

export function ValidatorScannerPanel({
  scannerId,
  phase,
  cameraState,
  cameraStatusLabel,
  cameraError,
  apiError,
  showManualEntry,
  manualToken,
  isBusy,
  disableStart,
  onManualTokenChange,
  onToggleManualEntry,
  onManualSubmit,
  onStartScanner,
  onStopScanner,
}: ValidatorScannerPanelProps) {
  const isScanning = phase === "scanning";
  const isValidating = phase === "validating";
  const isReviewing = phase === "result" || phase === "redeeming" || phase === "redeemed";
  const isCameraUnavailable =
    cameraState === "blocked" || cameraState === "unavailable" || cameraState === "error";

  return (
    <section className="relative overflow-hidden border border-[rgba(223,197,106,0.2)] bg-[linear-gradient(180deg,rgba(27,34,49,0.96)_0%,rgba(19,26,39,0.98)_100%)] p-2.5 shadow-[0_20px_48px_rgba(3,7,18,0.32)] sm:p-5 sm:shadow-[0_30px_70px_rgba(3,7,18,0.38)]">
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(223,197,106,0.65)] to-transparent" />

      <div className="mb-2 flex items-center justify-between gap-3 border-b border-[rgba(223,197,106,0.12)] pb-2.5 sm:mb-4 sm:pb-4">
        <div>
          <p className="text-[9px] uppercase tracking-[0.18em] text-[rgba(223,197,106,0.72)] sm:text-[11px] sm:tracking-[0.28em]">
            Scanner
          </p>
          <h2 className="mt-1 font-heading text-lg text-white sm:mt-2 sm:text-2xl">
            Camera-first validation
          </h2>
        </div>

        <ValidatorStatusBadge label={cameraStatusLabel} tone={getCameraTone(cameraState)} />
      </div>

      <div className="relative overflow-hidden border border-[rgba(223,197,106,0.18)] bg-[radial-gradient(circle_at_top,rgba(223,197,106,0.12),rgba(19,26,39,0.04)_36%),linear-gradient(180deg,rgba(6,10,18,0.96),rgba(9,13,22,0.98))]">
        <div
          id={scannerId}
          className="relative h-[min(48svh,320px)] min-h-[220px] w-full bg-transparent sm:h-auto sm:min-h-[380px]"
        />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              "relative h-[170px] w-[170px] rounded-[22px] border transition-colors sm:h-[250px] sm:w-[250px] sm:rounded-[28px]",
              isReviewing
                ? "border-[rgba(122,132,153,0.18)]"
                : "border-[rgba(223,197,106,0.58)]",
            )}
          >
            <div className="absolute left-3 top-3 h-7 w-7 border-l-2 border-t-2 border-[var(--color-accent)]" />
            <div className="absolute right-3 top-3 h-7 w-7 border-r-2 border-t-2 border-[var(--color-accent)]" />
            <div className="absolute bottom-3 left-3 h-7 w-7 border-b-2 border-l-2 border-[var(--color-accent)]" />
            <div className="absolute bottom-3 right-3 h-7 w-7 border-b-2 border-r-2 border-[var(--color-accent)]" />
            <div className="absolute left-6 right-6 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-[rgba(223,197,106,0.75)] to-transparent" />
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[rgba(19,26,39,0.96)] to-transparent sm:h-32" />

        <div className="absolute inset-x-0 bottom-0 z-10 p-2 sm:p-5">
          <div className="rounded-lg border border-[rgba(223,197,106,0.14)] bg-[rgba(8,12,20,0.84)] px-2.5 py-2 backdrop-blur-md sm:rounded-2xl sm:px-4 sm:py-3">
            <div className="flex items-start gap-3">
              {isValidating ? (
                <LoaderCircle className="mt-0.5 h-4 w-4 animate-spin text-[var(--color-accent)]" />
              ) : isCameraUnavailable ? (
                <CameraOff className="mt-0.5 h-4 w-4 text-rose-300" />
              ) : (
                <Camera className="mt-0.5 h-4 w-4 text-[var(--color-accent)]" />
              )}
              <div>
                <p className="text-sm leading-5 text-white">
                  {isValidating
                    ? "Ticket scanned. Checking admission status..."
                    : isReviewing
                      ? "Scanner is paused while you review the result."
                      : isScanning
                        ? "Point the camera at the QR code inside the frame."
                        : "Start the camera to begin scanning tickets."}
                </p>
                <p className="mt-1 hidden text-xs text-[var(--color-text-dim)] sm:block">
                  Manual entry is always available if the camera is blocked or the QR is damaged.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:flex sm:flex-wrap sm:gap-3">
        <button
          type="button"
          onClick={onStartScanner}
          disabled={isBusy || isScanning || disableStart}
          className="inline-flex min-h-10 items-center justify-center gap-2 border border-[var(--color-accent)] px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)] disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-11 sm:min-w-[150px] sm:px-4 sm:py-3 sm:text-xs sm:tracking-[0.2em]"
        >
          <Play className="h-4 w-4" />
          Start scanning
        </button>

        <button
          type="button"
          onClick={onStopScanner}
          disabled={isBusy || (!isScanning && cameraState !== "ready")}
          className="inline-flex min-h-10 items-center justify-center gap-2 border border-[rgba(122,132,153,0.35)] px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(226,232,240,0.84)] transition-colors hover:border-white hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-11 sm:min-w-[150px] sm:px-4 sm:py-3 sm:text-xs sm:tracking-[0.2em]"
        >
          <Square className="h-4 w-4" />
          Stop scanner
        </button>
      </div>

      {cameraError ? (
        <div className="mt-4 border border-[rgba(248,113,113,0.24)] bg-[rgba(127,29,29,0.2)] px-4 py-3 text-sm text-rose-200">
          {cameraError}
        </div>
      ) : null}

      {apiError ? (
        <div className="mt-4 border border-[rgba(248,113,113,0.24)] bg-[rgba(127,29,29,0.2)] px-4 py-3 text-sm text-rose-200">
          {apiError}
        </div>
      ) : null}

      <div className="mt-3 border-t border-[rgba(223,197,106,0.12)] pt-3 sm:mt-5 sm:pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[rgba(223,197,106,0.72)] sm:text-[11px] sm:tracking-[0.28em]">
              Manual fallback
            </p>
            <p className="mt-2 hidden text-sm text-[var(--color-text-dim)] sm:block">
              Paste the QR contents or the manual validation code printed on the ticket PDF.
            </p>
          </div>

          <button
            type="button"
            onClick={onToggleManualEntry}
            className="inline-flex items-center gap-2 border border-[rgba(223,197,106,0.22)] px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-[var(--color-accent)] transition-colors hover:border-[var(--color-accent)] hover:bg-[rgba(223,197,106,0.08)] sm:px-4 sm:text-[11px] sm:tracking-[0.24em]"
          >
            <Keyboard className="h-4 w-4" />
            {showManualEntry ? "Hide input" : "Manual entry"}
          </button>
        </div>

        {showManualEntry ? (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={manualToken}
              onChange={(event) => onManualTokenChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onManualSubmit();
                }
              }}
              placeholder="Paste QR contents or manual validation code"
              className="min-w-0 flex-1 border border-[rgba(223,197,106,0.24)] bg-[rgba(12,18,28,0.94)] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-accent)]"
            />
            <button
              type="button"
              onClick={onManualSubmit}
              disabled={isBusy || manualToken.trim().length === 0}
              className="min-h-11 border border-[var(--color-accent)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)] disabled:cursor-not-allowed disabled:opacity-45 sm:tracking-[0.2em]"
            >
              Validate ticket
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
