import type { TicketValidationResponse } from "@/lib/api/validator";

export type ValidationPhase =
  | "idle"
  | "scanning"
  | "validating"
  | "result"
  | "redeeming"
  | "redeemed";

export type CameraState =
  | "idle"
  | "requesting"
  | "ready"
  | "stopped"
  | "blocked"
  | "unavailable"
  | "error";

export type ScanOutcome = "redeemable" | "blocked" | "redeemed" | "invalid";

export type RecentScanItem = {
  id: string;
  token: string;
  tokenLabel: string;
  movieTitle: string | null;
  status: ScanOutcome;
  detail: string;
  timestamp: string;
  admissionId: string | null;
};

export type ActiveValidation = {
  token: string;
  result: TicketValidationResponse;
};
