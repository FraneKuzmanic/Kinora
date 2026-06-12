import type { AdmissionRead } from "@/lib/api/tickets";

export type TicketBucket = "active" | "pending" | "refund" | "past";

export function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatTicketDate(value: string | null | undefined) {
  if (!value) {
    return "TBA";
  }

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

export function formatTicketDateLabel(admission: AdmissionRead) {
  if (admission.starts_at) {
    return formatTicketDate(admission.starts_at);
  }

  if (admission.campaign_slot_starts_at) {
    return `Proposed: ${formatTicketDate(admission.campaign_slot_starts_at)}`;
  }

  if (admission.campaign_voting_ends_at) {
    return `Voting ends ${formatTicketDate(admission.campaign_voting_ends_at)}`;
  }

  return "Awaiting schedule";
}

export function deriveTicketBucket(admission: AdmissionRead): TicketBucket {
  if (
    admission.status === "used" ||
    admission.status === "refunded" ||
    admission.status === "void"
  ) {
    return "past";
  }

  if (admission.refund_eligible) {
    return "refund";
  }

  if (
    admission.type === "campaign_earlybird" &&
    admission.screening_id === null
  ) {
    return "pending";
  }

  if (
    admission.screening_status &&
    admission.screening_status !== "confirmed"
  ) {
    return "pending";
  }

  if (admission.status === "pending_outcome" || admission.status === "lost_no_refund") {
    return "pending";
  }

  return "active";
}

export function getTicketTypeLabel(admission: AdmissionRead) {
  return admission.type === "campaign_earlybird"
    ? "Early Bird"
    : "Screening Ticket";
}

export function getTicketStatusLabel(admission: AdmissionRead) {
  const bucket = deriveTicketBucket(admission);

  if (bucket === "refund") {
    return "Refund Available";
  }

  if (bucket === "pending") {
    return "Pending Outcome";
  }

  if (admission.status === "used") {
    return "Redeemed";
  }

  if (admission.status === "refunded") {
    return "Refunded";
  }

  return "Active";
}

export function getTicketAccent(admission: AdmissionRead) {
  const bucket = deriveTicketBucket(admission);

  if (bucket === "refund") {
    return {
      border: "rgba(248,113,113,0.24)",
      rail: "#f87171",
      subtle: "rgba(248,113,113,0.08)",
      text: "#f87171",
    };
  }

  if (bucket === "pending") {
    return {
      border: "rgba(255,255,255,0.1)",
      rail: "#7a8499",
      subtle: "rgba(255,255,255,0.03)",
      text: "#7a8499",
    };
  }

  if (admission.status === "used") {
    return {
      border: "rgba(74,222,128,0.24)",
      rail: "#4ade80",
      subtle: "rgba(74,222,128,0.08)",
      text: "#4ade80",
    };
  }

  return {
    border: "rgba(223,197,106,0.24)",
    rail: "#dfc56a",
    subtle: "rgba(223,197,106,0.08)",
    text: "#dfc56a",
  };
}

export function getTicketNote(admission: AdmissionRead) {
  const bucket = deriveTicketBucket(admission);

  if (bucket === "refund") {
    const winningFilm = admission.resolved_movie_title
      ? ` Valid for ${admission.resolved_movie_title}.`
      : "";
    return `Your selected film did not win. You can still use this ticket or request a refund.${winningFilm}`;
  }

  if (bucket === "pending") {
    if (admission.type === "campaign_earlybird" && admission.screening_id === null) {
      return "Waiting for campaign outcome. If your film is selected, this becomes your valid admission.";
    }

    return "This ticket is purchased, but the screening still needs to reach its confirmation threshold.";
  }

  if (admission.status === "used") {
    return admission.redeemed_at
      ? `Validated at cinema entry on ${formatTicketDate(admission.redeemed_at)}.`
      : "Validated at cinema entry.";
  }

  if (admission.status === "refunded") {
    return "Refund completed to the original payment method.";
  }

  if (admission.type === "campaign_earlybird") {
    return "Your Early Bird admission is now valid for cinema entry.";
  }

  return "Ready for cinema entry.";
}

export function getTicketLocation(admission: AdmissionRead) {
  return [admission.cinema_name, admission.city_name]
    .filter(Boolean)
    .join(", ");
}
