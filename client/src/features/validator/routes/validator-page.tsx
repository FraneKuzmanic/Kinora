import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { AlertTriangle, CheckCircle2, ScanLine, Ticket, XCircle } from "lucide-react";
import {
  normalizeQr,
  redeemTicket,
  validateTicket,
  type DeviceInfo,
  type TicketValidationResponse,
} from "@/lib/api/validator";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/features/auth/auth-context";
import { ValidatorRecentScans } from "@/features/validator/components/ValidatorRecentScans";
import { ValidatorResultCard } from "@/features/validator/components/ValidatorResultCard";
import { ValidatorScannerPanel } from "@/features/validator/components/ValidatorScannerPanel";
import { ValidatorStatusBadge } from "@/features/validator/components/ValidatorStatusBadge";
import type {
  ActiveValidation,
  CameraState,
  RecentScanItem,
  ScanOutcome,
  ValidationPhase,
} from "@/features/validator/types";
import { cn } from "@/utils/cn";

const SCANNER_ID = "kinora-validator-scanner";

function makeDeviceInfo(cameraLabel: string): DeviceInfo {
  return {
    source: "browser-camera",
    userAgent: navigator.userAgent,
    cameraLabel,
    appVersion: "validator-web",
  };
}

function getCameraStatusLabel(cameraState: CameraState) {
  if (cameraState === "ready") {
    return "Camera ready";
  }

  if (cameraState === "requesting") {
    return "Requesting camera";
  }

  if (cameraState === "stopped") {
    return "Scanner paused";
  }

  if (cameraState === "blocked") {
    return "Permission blocked";
  }

  if (cameraState === "unavailable") {
    return "Camera unavailable";
  }

  if (cameraState === "error") {
    return "Scanner error";
  }

  return "Ready when needed";
}

function buildScanDetail(result: TicketValidationResponse, status: ScanOutcome) {
  if (status === "redeemable") {
    return "Validated";
  }

  if (status === "redeemed") {
    return "Redeemed";
  }

  if (status === "blocked") {
    return result.reason ?? "Not redeemable";
  }

  return result.reason ?? "Admission not found";
}

function shortenToken(token: string) {
  if (token.length <= 14) {
    return token;
  }

  return `${token.slice(0, 8)}...${token.slice(-4)}`;
}

function getValidatorErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.message) {
    return error.message;
  }

  if (error instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(error.message)) {
    return "Could not reach the validator API. Check the connection and try again.";
  }

  return fallback;
}

function getOutcome(result: TicketValidationResponse, phase: ValidationPhase): ScanOutcome {
  if (phase === "redeemed") {
    return "redeemed";
  }

  if (!result.valid) {
    return "invalid";
  }

  if (result.redeemable) {
    return "redeemable";
  }

  return "blocked";
}

function getMobileResultSummary(
  result: TicketValidationResponse,
  phase: ValidationPhase,
) {
  if (phase === "redeeming") {
    return {
      label: "Redeeming ticket",
      detail: "Hold on before scanning the next guest.",
      tone: "gold" as const,
      Icon: Ticket,
    };
  }

  const outcome = getOutcome(result, phase);

  if (outcome === "redeemed") {
    return {
      label: "Ticket redeemed",
      detail: "Entry confirmed. Ready for the next scan.",
      tone: "green" as const,
      Icon: CheckCircle2,
    };
  }

  if (outcome === "redeemable") {
    return {
      label: "Valid ticket",
      detail: result.movie_title ?? "Redeem or scan the next ticket.",
      tone: "green" as const,
      Icon: CheckCircle2,
    };
  }

  if (outcome === "invalid") {
    return {
      label: "Invalid ticket",
      detail: result.reason ?? "This QR code is not valid.",
      tone: "red" as const,
      Icon: XCircle,
    };
  }

  return {
    label: "Not redeemable",
    detail: result.reason ?? "Review before allowing entry.",
    tone: "red" as const,
    Icon: AlertTriangle,
  };
}

export function ValidatorPage() {
  const { session } = useAuth();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScannerRunningRef = useRef(false);
  const isProcessingRef = useRef(false);
  const cameraLabelRef = useRef("");
  const mountedRef = useRef(true);
  const cameraStateRef = useRef<CameraState>("idle");
  const pendingStartPromiseRef = useRef<Promise<null> | null>(null);
  const scannerLifecycleIdRef = useRef(0);

  const [phase, setPhase] = useState<ValidationPhase>("idle");
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [activeValidation, setActiveValidation] = useState<ActiveValidation | null>(null);
  const [recentScans, setRecentScans] = useState<RecentScanItem[]>([]);

  const buildRequestPayload = useCallback(
    () => ({
      device_info: makeDeviceInfo(cameraLabelRef.current),
    }),
    [],
  );

  const upsertRecentScan = useCallback(
    (token: string, result: TicketValidationResponse, resultPhase: ValidationPhase) => {
      const status = getOutcome(result, resultPhase);
      const timestamp = new Date().toISOString();

      setRecentScans((current) => {
        const nextItem: RecentScanItem = {
          id: result.admission_id ?? `${token}:${timestamp}`,
          token,
          tokenLabel: shortenToken(token),
          movieTitle: result.movie_title,
          status,
          detail: buildScanDetail(result, status),
          timestamp,
          admissionId: result.admission_id,
        };

        const remaining = current.filter((item) => item.token !== token);
        return [nextItem, ...remaining].slice(0, 8);
      });
    },
    [],
  );

  const stopScanner = useCallback(async () => {
    scannerLifecycleIdRef.current += 1;
    const activeLifecycleId = scannerLifecycleIdRef.current;
    const pendingStartPromise = pendingStartPromiseRef.current;

    if (pendingStartPromise) {
      await pendingStartPromise.catch(() => undefined);
    }

    const scanner = scannerRef.current;
    if (!scanner) {
      if (
        mountedRef.current &&
        (cameraStateRef.current === "requesting" || cameraStateRef.current === "ready")
      ) {
        setCameraState("stopped");
      }
      return;
    }

    try {
      const scannerState = scanner.getState();
      if (
        scannerState === Html5QrcodeScannerState.SCANNING ||
        scannerState === Html5QrcodeScannerState.PAUSED
      ) {
        await scanner.stop();
      } else if (scannerState === Html5QrcodeScannerState.NOT_STARTED) {
        scanner.clear();
      }
    } catch {
      // Ignore cleanup issues from the scanner library.
    } finally {
      if (scannerLifecycleIdRef.current === activeLifecycleId) {
        isScannerRunningRef.current = false;
        scannerRef.current = null;
        pendingStartPromiseRef.current = null;
      }
      if (mountedRef.current && scannerLifecycleIdRef.current === activeLifecycleId) {
        setCameraState("stopped");
      }
    }
  }, []);

  const validateMutation = useMutation({
    mutationFn: async (token: string) => {
      if (!session?.access_token) {
        throw new Error("Missing auth session.");
      }

      return validateTicket(token, session.access_token, buildRequestPayload());
    },
    onSuccess: (result, token) => {
      if (!mountedRef.current) {
        return;
      }

      setActiveValidation({ token, result });
      setPhase("result");
      isProcessingRef.current = false;
      upsertRecentScan(token, result, "result");
    },
    onError: (error) => {
      if (!mountedRef.current) {
        return;
      }

      setApiError(
        getValidatorErrorMessage(error, "Validation failed. Please try again."),
      );
      setPhase("idle");
      isProcessingRef.current = false;
    },
  });

  const redeemMutation = useMutation({
    mutationFn: async ({ token }: { token: string }) => {
      if (!session?.access_token) {
        throw new Error("Missing auth session.");
      }

      return redeemTicket(token, session.access_token, buildRequestPayload());
    },
    onSuccess: (redemption, variables) => {
      if (!mountedRef.current) {
        return;
      }

      setPhase("redeemed");
      setApiError(null);
      setActiveValidation((current) => {
        if (!current || current.token !== variables.token) {
          return current;
        }

        const nextResult: TicketValidationResponse = {
          ...current.result,
          redeemable: false,
          redeemed_at: redemption.redeemed_at,
          redemption_id: redemption.redemption_id,
          reason: "Admission redeemed successfully",
        };

        upsertRecentScan(variables.token, nextResult, "redeemed");
        return {
          token: current.token,
          result: nextResult,
        };
      });
    },
    onError: (error) => {
      if (!mountedRef.current) {
        return;
      }

      setApiError(
        getValidatorErrorMessage(
          error,
          "Redemption failed. Please retry after re-checking the ticket.",
        ),
      );
      setPhase("result");
    },
  });

  const handleValidatedToken = useCallback(
    async (rawToken: string) => {
      if (isProcessingRef.current) {
        return;
      }

      const token = normalizeQr(rawToken);
      if (!token) {
        return;
      }

      isProcessingRef.current = true;
      setApiError(null);
      setCameraError(null);
      setManualToken(token);
      setPhase("validating");
      await stopScanner();
      validateMutation.mutate(token);
    },
    [stopScanner, validateMutation],
  );

  const startScanner = useCallback(async () => {
    if (
      phase === "validating" ||
      phase === "redeeming" ||
      isScannerRunningRef.current ||
      pendingStartPromiseRef.current
    ) {
      return;
    }

    const target = document.getElementById(SCANNER_ID);
    if (!target) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState("unavailable");
      setCameraError("This browser cannot access the camera. Use manual entry instead.");
      setShowManualEntry(true);
      return;
    }

    setApiError(null);
    setCameraError(null);
    setCameraState("requesting");
    setPhase("scanning");

    let lifecycleId = scannerLifecycleIdRef.current;
    let startPromise: Promise<null> | null = null;
    let scanner: Html5Qrcode | null = null;

    try {
      lifecycleId = scannerLifecycleIdRef.current + 1;
      scannerLifecycleIdRef.current = lifecycleId;
      const cameras = await Html5Qrcode.getCameras();
      const preferredCamera =
        cameras.find((camera) => /back|rear|environment/i.test(camera.label)) ?? cameras[0];

      if (!preferredCamera) {
        setCameraState("unavailable");
        setCameraError("No camera was detected on this device. Manual entry is still available.");
        setShowManualEntry(true);
        setPhase("idle");
        return;
      }

      cameraLabelRef.current = preferredCamera.label;
      scanner = new Html5Qrcode(SCANNER_ID);
      scannerRef.current = scanner;
      isScannerRunningRef.current = false;
      const isMobileViewport = window.innerWidth < 640;
      const qrboxSize = Math.min(
        isMobileViewport ? 220 : 260,
        Math.max(
          isMobileViewport ? 170 : 210,
          Math.floor(
            Math.min(window.innerWidth, window.innerHeight) *
              (isMobileViewport ? 0.5 : 0.62),
          ),
        ),
      );

      startPromise = scanner.start(
        { deviceId: { exact: preferredCamera.id } },
        { fps: 10, qrbox: { width: qrboxSize, height: qrboxSize } },
        (decodedText) => {
          void handleValidatedToken(decodedText);
        },
        undefined,
      );
      pendingStartPromiseRef.current = startPromise;

      await startPromise;

      if (scannerLifecycleIdRef.current !== lifecycleId || scannerRef.current !== scanner) {
        try {
          const scannerState = scanner.getState();
          if (
            scannerState === Html5QrcodeScannerState.SCANNING ||
            scannerState === Html5QrcodeScannerState.PAUSED
          ) {
            await scanner.stop();
          } else if (scannerState === Html5QrcodeScannerState.NOT_STARTED) {
            scanner.clear();
          }
        } catch {
          // Ignore cleanup races for stale scanner instances.
        }
        return;
      }

      isScannerRunningRef.current = true;
      if (mountedRef.current) {
        setCameraState("ready");
      }
    } catch (error) {
      const isStaleStart =
        scannerLifecycleIdRef.current !== lifecycleId ||
        (scanner !== null && scannerRef.current !== scanner);

      if (scanner !== null && scannerRef.current === scanner) {
        scannerRef.current = null;
      }
      isScannerRunningRef.current = false;

      const isAbortError =
        error instanceof DOMException
          ? error.name === "AbortError"
          : error instanceof Error && /abort/i.test(error.message);

      if (isAbortError || !mountedRef.current || phase === "idle" || isStaleStart) {
        if (mountedRef.current) {
          setCameraState("stopped");
        }
        return;
      }

      const message =
        error instanceof Error && /permission|denied|notallowed/i.test(error.message)
          ? "Camera permission was blocked. Allow camera access or use manual entry."
          : "Camera could not start on this device. You can continue with manual entry.";

      setCameraState(
        error instanceof Error && /permission|denied|notallowed/i.test(error.message)
          ? "blocked"
          : "error",
      );
      setCameraError(message);
      setShowManualEntry(true);
      setPhase("idle");
    } finally {
      if (pendingStartPromiseRef.current === startPromise) {
        pendingStartPromiseRef.current = null;
      }
    }
  }, [handleValidatedToken, phase]);

  useEffect(() => {
    cameraStateRef.current = cameraState;
  }, [cameraState]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void stopScanner();
    };
  }, [stopScanner]);

  const handleManualSubmit = useCallback(() => {
    const token = manualToken.trim();
    if (!token) {
      return;
    }

    void handleValidatedToken(token);
  }, [handleValidatedToken, manualToken]);

  const handleRedeem = useCallback(() => {
    if (!activeValidation) {
      return;
    }

    setApiError(null);
    setPhase("redeeming");
    redeemMutation.mutate({ token: activeValidation.token });
  }, [activeValidation, redeemMutation]);

  const handleBackToScanner = useCallback(() => {
    setActiveValidation(null);
    setApiError(null);
    setManualToken("");
    isProcessingRef.current = false;
    void startScanner();
  }, [startScanner]);

  const activeResult = activeValidation?.result ?? null;
  const mobileResultSummary = activeResult
    ? getMobileResultSummary(activeResult, phase)
    : null;
  const isMobileRedeemActionVisible =
    Boolean(activeResult?.redeemable) && phase === "result";
  const isRedeeming = phase === "redeeming";
  const scannerReadinessLabel =
    phase === "validating"
      ? "Validation in progress"
      : phase === "redeeming"
        ? "Redemption in progress"
        : activeResult
          ? "Review required"
          : "Ready for next guest";

  return (
    <section
      className={cn(
        "relative isolate min-h-[calc(100svh-5rem)] overflow-hidden px-2 pb-8 pt-2 sm:px-6 sm:pb-14 sm:pt-6 lg:px-10",
        activeResult ? "pb-36 sm:pb-14" : null,
      )}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(223,197,106,0.12),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.08),transparent_24%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-[rgba(223,197,106,0.06)] to-transparent" />

      <div className="mx-auto max-w-7xl">
        <header className="relative overflow-hidden border border-[rgba(223,197,106,0.18)] bg-[linear-gradient(180deg,rgba(27,34,49,0.94)_0%,rgba(19,26,39,0.98)_100%)] px-3 py-3 shadow-[0_20px_50px_rgba(3,7,18,0.26)] sm:border-[rgba(223,197,106,0.22)] sm:px-7 sm:py-8 sm:shadow-[0_30px_80px_rgba(3,7,18,0.34)]">
          <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 translate-x-1/4 -translate-y-1/4 rounded-full bg-[rgba(223,197,106,0.08)] blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-32 w-32 -translate-x-1/4 translate-y-1/4 rounded-full bg-[rgba(59,130,246,0.08)] blur-3xl" />

          <div className="relative flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[9px] uppercase tracking-[0.18em] text-[rgba(223,197,106,0.72)] sm:text-[11px] sm:tracking-[0.32em]">
                Kinora validator workspace
              </p>
              <h1 className="mt-1 font-display text-2xl uppercase tracking-[0.08em] text-white sm:mt-3 sm:text-5xl sm:tracking-[0.12em]">
                Validate Tickets
              </h1>
              <p className="mt-3 hidden max-w-xl text-sm leading-relaxed text-[var(--color-text-dim)] sm:mt-4 sm:block sm:text-base">
                Scan a ticket, confirm the admission state, and redeem only when the guest is ready
                to enter.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 sm:gap-3">
              <ValidatorStatusBadge label={scannerReadinessLabel} tone="gold" />
              <ValidatorStatusBadge
                label={getCameraStatusLabel(cameraState)}
                tone={cameraState === "ready" ? "green" : cameraState === "blocked" ? "red" : "slate"}
              />
            </div>
          </div>
        </header>

        <section className="mt-3 grid gap-3 sm:mt-6 sm:gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <ValidatorScannerPanel
            scannerId={SCANNER_ID}
            phase={phase}
            cameraState={cameraState}
            cameraStatusLabel={getCameraStatusLabel(cameraState)}
            cameraError={cameraError}
            apiError={apiError}
            showManualEntry={showManualEntry}
            manualToken={manualToken}
            isBusy={validateMutation.isPending || redeemMutation.isPending}
            disableStart={Boolean(activeResult)}
            onManualTokenChange={setManualToken}
            onToggleManualEntry={() => setShowManualEntry((current) => !current)}
            onManualSubmit={handleManualSubmit}
            onStartScanner={() => {
              void startScanner();
            }}
            onStopScanner={() => {
              setPhase("idle");
              void stopScanner();
            }}
          />

          {activeResult ? (
            <ValidatorResultCard
              result={activeResult}
              phase={phase}
              apiError={apiError}
              onRedeem={handleRedeem}
              onBackToScanner={handleBackToScanner}
            />
          ) : (
            <section className="hidden border border-[rgba(223,197,106,0.16)] bg-[linear-gradient(180deg,rgba(27,34,49,0.96)_0%,rgba(19,26,39,0.98)_100%)] p-4 shadow-[0_24px_60px_rgba(3,7,18,0.24)] sm:block sm:p-5">
              <div className="mb-5 flex items-start gap-4 border-b border-[rgba(223,197,106,0.12)] pb-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(223,197,106,0.18)] bg-[rgba(223,197,106,0.08)] text-[var(--color-accent)]">
                  <ScanLine className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[rgba(223,197,106,0.72)]">
                    Waiting for scan
                  </p>
                  <h2 className="mt-2 font-heading text-2xl text-white">Next ticket preview</h2>
                </div>
              </div>

              <p className="text-sm text-[var(--color-text-dim)]">
                Start the scanner or paste the manual validation code from the ticket PDF. The
                result and redeem action will appear here.
              </p>
            </section>
          )}
        </section>

        <div className="mt-3 sm:mt-6">
          <ValidatorRecentScans scans={recentScans} />
        </div>
      </div>

      {activeResult && mobileResultSummary ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[rgba(223,197,106,0.24)] bg-[rgba(8,12,20,0.96)] px-3 py-3 shadow-[0_-18px_40px_rgba(3,7,18,0.42)] backdrop-blur-xl sm:hidden">
          <div className="mx-auto max-w-md pb-[env(safe-area-inset-bottom)]">
            <div className="mb-3 flex items-center gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border",
                  mobileResultSummary.tone === "green"
                    ? "border-[rgba(74,222,128,0.34)] bg-[rgba(74,222,128,0.12)] text-emerald-300"
                    : mobileResultSummary.tone === "red"
                      ? "border-[rgba(248,113,113,0.34)] bg-[rgba(127,29,29,0.24)] text-rose-300"
                      : "border-[rgba(223,197,106,0.34)] bg-[rgba(223,197,106,0.12)] text-[var(--color-accent)]",
                )}
              >
                <mobileResultSummary.Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">
                  {mobileResultSummary.label}
                </p>
                <p className="mt-0.5 truncate text-sm text-white/85">
                  {mobileResultSummary.detail}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {isMobileRedeemActionVisible || isRedeeming ? (
                <button
                  type="button"
                  onClick={handleRedeem}
                  disabled={isRedeeming}
                  className="inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--color-accent)] bg-[var(--color-accent)] px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-bg-primary)] transition-colors hover:bg-white disabled:cursor-wait disabled:opacity-70"
                >
                  <Ticket className="h-4 w-4" />
                  {isRedeeming ? "Redeeming" : "Redeem"}
                </button>
              ) : null}

              <button
                type="button"
                onClick={handleBackToScanner}
                disabled={isRedeeming}
                className={cn(
                  "inline-flex min-h-11 items-center justify-center border px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors disabled:cursor-wait disabled:opacity-60",
                  isMobileRedeemActionVisible || isRedeeming
                    ? "border-[rgba(122,132,153,0.42)] text-white hover:border-white"
                    : "col-span-2 border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-bg-primary)] hover:bg-white",
                )}
              >
                Scan next
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
