import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  LoaderCircle,
  Mail,
  MailCheck,
  MapPin,
  MessageSquareText,
  Phone,
  Sparkles,
  Ticket,
  Users,
  X,
} from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/features/auth/auth-context";
import { useCinemas } from "@/features/cinemas/queries/use-cinemas";
import {
  listCinemaHalls,
  listCinemaLocations,
  type CinemaHallRead,
  type CinemaLocationRead,
  type CinemaRead,
} from "@/lib/api/cinemas";
import {
  acceptPrivateBookingCheckoutSession,
  cancelPrivateBooking,
  createPrivateBooking,
  listPrivateBookings,
  type PrivateBookingCreate,
  type PrivateBookingRead,
  type PrivateBookingStatus,
} from "@/lib/api/private-bookings";
import { ApiError } from "@/lib/api/client";

type NoticeState = {
  kind: "success" | "error";
  message: string;
} | null;

type RequestTab = "action" | "pending" | "confirmed" | "past";

type EventTypeOption = {
  value: string;
  label: string;
  hint: string;
};

const EVENT_TYPES: EventTypeOption[] = [
  {
    value: "private_screening",
    label: "Private Screening",
    hint: "A dedicated showing for your guests.",
  },
  {
    value: "birthday",
    label: "Birthday",
    hint: "Celebrate with a private cinema room.",
  },
  {
    value: "team_event",
    label: "Team Event",
    hint: "Company gatherings, launches, or socials.",
  },
  {
    value: "special_occasion",
    label: "Special Occasion",
    hint: "Anything tailored and memorable.",
  },
];

const inputClassName =
  "w-full rounded-sm border border-[rgba(255,255,255,0.08)] bg-[rgba(27,34,49,0.42)] px-4 py-3 text-sm text-white outline-none transition-all duration-300 placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-accent)] focus:bg-[rgba(27,34,49,0.78)] focus:shadow-[0_0_15px_rgba(223,197,106,0.1)]";

const selectClassName = `${inputClassName} appearance-none bg-[url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23DFC56A%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E")] bg-[length:1rem_auto] bg-[position:right_1rem_center] bg-no-repeat pr-10`;

const panelClassName =
  "overflow-hidden rounded-sm border border-[rgba(255,255,255,0.05)] bg-[linear-gradient(145deg,rgba(27,34,49,0.7)_0%,rgba(27,34,49,0.3)_100%)] shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-md";

const primaryButtonClassName =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-sm bg-[var(--color-accent)] px-6 py-4 text-sm font-bold uppercase tracking-[0.16em] text-[var(--color-bg-primary)] transition-all duration-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-70";

const secondaryButtonClassName =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-sm border border-[rgba(223,197,106,0.28)] bg-[rgba(19,26,39,0.42)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)] transition-colors duration-300 hover:bg-[rgba(223,197,106,0.08)] disabled:cursor-not-allowed disabled:opacity-60";

function formatDateTime(value: string | null) {
  if (!value) {
    return "Flexible";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Flexible";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatMoney(amountCents: number | null, currency: string) {
  if (amountCents === null) {
    return "Quote pending";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong.";
}

function formatEventType(value: string | null) {
  if (!value) {
    return "Private booking";
  }

  const match = EVENT_TYPES.find((option) => option.value === value);
  if (match) {
    return match.label;
  }

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char: string) => char.toUpperCase());
}

function toIsoValue(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString();
}

function statusLabel(status: PrivateBookingStatus) {
  switch (status) {
    case "submitted":
      return "Submitted";
    case "in_review":
      return "In Review";
    case "offered":
      return "Offer Ready";
    case "accepted":
      return "Payment Pending";
    case "paid":
      return "Paid";
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function statusClasses(status: PrivateBookingStatus) {
  switch (status) {
    case "offered":
    case "accepted":
      return "border-[rgba(223,197,106,0.3)] bg-[rgba(223,197,106,0.08)] text-[var(--color-accent)]";
    case "paid":
      return "border-[rgba(74,222,128,0.3)] bg-[rgba(74,222,128,0.1)] text-emerald-300";
    case "rejected":
      return "border-[rgba(248,113,113,0.28)] bg-[rgba(248,113,113,0.1)] text-red-200";
    case "cancelled":
      return "border-[rgba(122,132,153,0.22)] bg-[rgba(122,132,153,0.08)] text-[var(--color-text-dim)]";
    default:
      return "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-[var(--color-text-dim)]";
  }
}

function groupStatuses(tab: RequestTab) {
  if (tab === "action") {
    return new Set<PrivateBookingStatus>(["offered", "accepted"]);
  }

  if (tab === "pending") {
    return new Set<PrivateBookingStatus>(["submitted", "in_review"]);
  }

  if (tab === "confirmed") {
    return new Set<PrivateBookingStatus>(["paid"]);
  }

  return new Set<PrivateBookingStatus>(["rejected", "cancelled"]);
}

function getTabCount(bookings: PrivateBookingRead[], tab: RequestTab) {
  const statuses = groupStatuses(tab);
  return bookings.filter((booking) => statuses.has(booking.status)).length;
}

function tabForStatus(status: PrivateBookingStatus): RequestTab {
  if (status === "offered" || status === "accepted") {
    return "action";
  }

  if (status === "submitted" || status === "in_review") {
    return "pending";
  }

  if (status === "paid") {
    return "confirmed";
  }

  return "past";
}

function getCapacityRange(halls: CinemaHallRead[]) {
  if (halls.length === 0) {
    return "Quote provided after review";
  }

  const capacities = halls
    .map((hall) => hall.capacity)
    .sort((left, right) => left - right);
  const minimum = capacities[0];
  const maximum = capacities[capacities.length - 1];

  if (minimum === maximum) {
    return `${minimum} seats available`;
  }

  return `${minimum}-${maximum} seats`;
}

function isCancellable(status: PrivateBookingStatus) {
  return (
    status === "submitted" ||
    status === "in_review" ||
    status === "offered" ||
    status === "accepted"
  );
}

function getActionLabel(status: PrivateBookingStatus) {
  if (status === "accepted") {
    return "Complete Payment";
  }

  return "Accept and Pay";
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-[var(--color-text-dim)]">
      <div className="relative mr-4 h-14 w-14">
        <div className="absolute inset-0 rounded-full border border-[rgba(223,197,106,0.18)]" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-r-[var(--color-accent)] border-t-[var(--color-accent)]" />
        <div className="absolute inset-3 rounded-full border border-[rgba(223,197,106,0.24)]" />
        <div className="absolute inset-[18px] rounded-full bg-[rgba(223,197,106,0.16)] shadow-[0_0_24px_rgba(223,197,106,0.38)]" />
      </div>
      {label}
    </div>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <label className="ml-1 text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-dim)]">
      {children}
    </label>
  );
}

function SectionDivider() {
  return (
    <div className="relative border-t border-[rgba(255,255,255,0.05)]">
      <div className="absolute left-1/2 top-0 h-px w-14 -translate-x-1/2 bg-[var(--color-accent)]" />
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[rgba(255,255,255,0.05)] bg-[rgba(19,26,39,0.45)] px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-dim)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function VenuePanel({
  cinemas,
  selectedCinemaId,
  onSelectCinema,
  selectedCinema,
  locations,
  privateBookableHalls,
  locationsLoading,
  hallsLoading,
}: {
  cinemas: CinemaRead[];
  selectedCinemaId: string;
  onSelectCinema: (cinemaId: string) => void;
  selectedCinema: CinemaRead | null;
  locations: CinemaLocationRead[];
  privateBookableHalls: CinemaHallRead[];
  locationsLoading: boolean;
  hallsLoading: boolean;
}) {
  const hallsByLocation = useMemo(() => {
    const mapping = new Map<string, CinemaHallRead[]>();
    for (const hall of privateBookableHalls) {
      const existing = mapping.get(hall.location_id) ?? [];
      existing.push(hall);
      mapping.set(hall.location_id, existing);
    }
    return mapping;
  }, [privateBookableHalls]);

  const displayedLocations = locations.filter((location) =>
    hallsByLocation.has(location.id),
  );

  return (
    <div className="space-y-6 lg:pr-2">
      <div className={panelClassName}>
        <div className="border-b border-[rgba(255,255,255,0.05)] p-6">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--color-accent)]">
            Select Venue
          </p>
          <h2 className="mt-3 font-heading text-3xl text-white">
            Venue Details
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--color-text-dim)]">
            Choose the cinema first. We will show its private-booking locations,
            hall capacities, and service context before you send the request.
          </p>
        </div>

        <div className="space-y-6 p-6">
          <div className="space-y-2">
            <FieldLabel>Preferred Venue</FieldLabel>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--color-text-dim)]" />
              <select
                value={selectedCinemaId}
                onChange={(event) => onSelectCinema(event.target.value)}
                className={`${selectClassName} pl-10`}
              >
                {cinemas.map((cinema) => (
                  <option key={cinema.id} value={cinema.id}>
                    {cinema.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedCinema ? (
            <>
              <div className="relative overflow-hidden rounded-sm border border-[rgba(255,255,255,0.05)] bg-[rgba(19,26,39,0.45)] p-6">
                <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(223,197,106,0.35),transparent)]" />
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[rgba(223,197,106,0.18)] bg-[rgba(223,197,106,0.08)]">
                    {selectedCinema.logo_url ? (
                      <img
                        src={selectedCinema.logo_url}
                        alt={selectedCinema.name}
                        loading="lazy"
                        decoding="async"
                        className="h-9 w-9 object-contain"
                      />
                    ) : (
                      <Building2 className="h-6 w-6 text-[var(--color-accent)]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-heading text-2xl text-white">
                      {selectedCinema.name}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-[var(--color-text-dim)]">
                      {selectedCinema.description?.trim() ||
                        "Private bookings are reviewed by the cinema and returned with a tailored offer, hall assignment, and final quote."}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <SummaryStat
                    label="Locations"
                    value={`${displayedLocations.length || locations.length} available`}
                  />
                  <SummaryStat
                    label="Private Halls"
                    value={`${privateBookableHalls.length} halls`}
                  />
                  <SummaryStat
                    label="Capacity Range"
                    value={getCapacityRange(privateBookableHalls)}
                  />
                </div>

                <div className="mt-5 flex flex-wrap gap-4 text-xs text-[var(--color-text-dim)]">
                  {selectedCinema.website ? (
                    <a
                      href={selectedCinema.website}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 transition-colors duration-300 hover:text-[var(--color-accent)]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Website
                    </a>
                  ) : null}
                  {selectedCinema.email ? (
                    <span className="inline-flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                      {selectedCinema.email}
                    </span>
                  ) : null}
                  {selectedCinema.phone ? (
                    <span className="inline-flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                      {selectedCinema.phone}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="rounded-sm border border-[rgba(255,255,255,0.05)] bg-[rgba(27,34,49,0.3)] p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-accent)]">
                    Venue Context
                  </p>
                </div>

                {locationsLoading || hallsLoading ? (
                  <LoadingState label="Loading venue details." />
                ) : displayedLocations.length > 0 ? (
                  <div className="space-y-4">
                    {displayedLocations.map((location) => (
                      <div
                        key={location.id}
                        className="border border-[rgba(255,255,255,0.05)] bg-[rgba(19,26,39,0.45)] p-4"
                      >
                        <p className="text-sm font-medium text-white">
                          {location.location_name ??
                            location.city_name ??
                            "Cinema location"}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[var(--color-text-dim)]">
                          {[
                            location.address_line1,
                            location.postal_code,
                            location.city_name,
                          ]
                            .filter(Boolean)
                            .join(", ") || "Address unavailable"}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(hallsByLocation.get(location.id) ?? []).map(
                            (hall) => (
                              <span
                                key={hall.id}
                                className="inline-flex items-center gap-2 border border-[rgba(223,197,106,0.16)] bg-[rgba(223,197,106,0.06)] px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-white"
                              >
                                <Users className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                                {hall.name}
                                <span className="text-[var(--color-text-dim)]">
                                  {hall.capacity} seats
                                </span>
                              </span>
                            ),
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-sm border border-[rgba(248,113,113,0.18)] bg-[rgba(248,113,113,0.06)] p-4 text-sm leading-6 text-red-100/80">
                    This cinema currently has no halls enabled for private
                    booking.
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RequestFormCard({
  formState,
  setFormState,
  locations,
  privateBookableHalls,
  isAuthenticated,
  isSubmitting,
  onSubmit,
}: {
  formState: {
    cinemaId: string;
    preferredLocationId: string;
    eventType: string;
    groupSize: string;
    preferredStartAt: string;
    preferredEndAt: string;
    notes: string;
  };
  setFormState: React.Dispatch<
    React.SetStateAction<{
      cinemaId: string;
      preferredLocationId: string;
      eventType: string;
      groupSize: string;
      preferredStartAt: string;
      preferredEndAt: string;
      notes: string;
    }>
  >;
  locations: CinemaLocationRead[];
  privateBookableHalls: CinemaHallRead[];
  isAuthenticated: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
}) {
  const privateBookingLocationIds = useMemo(
    () => new Set(privateBookableHalls.map((hall) => hall.location_id)),
    [privateBookableHalls],
  );
  const locationOptions = useMemo(
    () =>
      locations.filter((location) =>
        privateBookingLocationIds.has(location.id),
      ),
    [locations, privateBookingLocationIds],
  );
  const selectedEventType = EVENT_TYPES.find(
    (option) => option.value === formState.eventType,
  );
  const hasPrivateBookableHalls = privateBookableHalls.length > 0;
  const submitButtonLabel = !hasPrivateBookableHalls
    ? "No Private Booking Halls"
    : isAuthenticated
      ? "Submit Booking Request"
      : "Sign In to Request";

  return (
    <div className={`${panelClassName} relative overflow-hidden p-8`}>
      <div className="absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(90deg,transparent,rgba(223,197,106,0.3),transparent)]" />

      <div className="mb-8">
        <h2 className="font-heading text-3xl text-white">Booking Request</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--color-text-dim)]">
          Share your preferred timing, guest count, and occasion. The cinema
          will review the request and return a tailored offer if it works for
          their venue.
        </p>
      </div>

      <div className="space-y-8">
        <section className="space-y-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="font-heading text-lg italic text-[var(--color-accent)]">
              01.
            </span>
            <h3 className="text-sm uppercase tracking-[0.15em] text-white">
              Event Details
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Event Type *</FieldLabel>
              <select
                value={formState.eventType}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    eventType: event.target.value,
                  }))
                }
                className={selectClassName}
              >
                <option value="">Select occasion</option>
                {EVENT_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {selectedEventType ? (
                <p className="text-xs leading-5 text-[var(--color-text-dim)]">
                  {selectedEventType.hint}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Estimated Guests *</FieldLabel>
              <input
                type="number"
                min={1}
                max={500}
                value={formState.groupSize}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    groupSize: event.target.value,
                  }))
                }
                placeholder="e.g. 50"
                className={inputClassName}
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <FieldLabel>Preferred Location</FieldLabel>
              <select
                value={formState.preferredLocationId}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    preferredLocationId: event.target.value,
                  }))
                }
                className={selectClassName}
                disabled={locationOptions.length === 0}
              >
                <option value="">
                  Let the cinema suggest the best location
                </option>
                {locationOptions.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.location_name ?? location.city_name ?? "Location"}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <SectionDivider />

        <section className="space-y-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="font-heading text-lg italic text-[var(--color-accent)]">
              02.
            </span>
            <h3 className="text-sm uppercase tracking-[0.15em] text-white">
              Proposed Timing
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Preferred Start *</FieldLabel>
              <input
                type="datetime-local"
                value={formState.preferredStartAt}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    preferredStartAt: event.target.value,
                  }))
                }
                className={inputClassName}
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Preferred End *</FieldLabel>
              <input
                type="datetime-local"
                value={formState.preferredEndAt}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    preferredEndAt: event.target.value,
                  }))
                }
                className={inputClassName}
              />
            </div>
          </div>
        </section>

        <SectionDivider />

        <section className="space-y-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="font-heading text-lg italic text-[var(--color-accent)]">
              03.
            </span>
            <h3 className="text-sm uppercase tracking-[0.15em] text-white">
              Details & Preferences
            </h3>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Notes / Special Requests</FieldLabel>
            <textarea
              rows={5}
              value={formState.notes}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="Tell the cinema about your preferred film, catering, technical setup, or any special requests."
              className={`${inputClassName} resize-none`}
            />
          </div>
        </section>

        <div className="mt-6 border-t border-[rgba(255,255,255,0.05)] pt-6">
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting || !hasPrivateBookableHalls}
            className={`${primaryButtonClassName} w-full`}
          >
            {isSubmitting ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Sending Request
              </>
            ) : (
              <>
                {submitButtonLabel}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          {!hasPrivateBookableHalls ? (
            <p className="mt-4 text-center text-[11px] leading-5 text-red-100/80">
              This cinema currently has no halls enabled for private booking.
              Choose another cinema or ask the cinema to enable a hall first.
            </p>
          ) : (
            <p className="mt-4 text-center text-[11px] leading-5 text-[var(--color-text-dim)]">
              No payment is taken at this stage. The cinema reviews your request
              first and sends back a tailored proposal if available.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function RequestCard({
  booking,
  cinemaName,
  offeredLocationName,
  offeredHallName,
  isAccepting,
  isCancelling,
  isHighlighted,
  onAccept,
  onCancel,
}: {
  booking: PrivateBookingRead;
  cinemaName: string;
  offeredLocationName: string | null;
  offeredHallName: string | null;
  isAccepting: boolean;
  isCancelling: boolean;
  isHighlighted: boolean;
  onAccept: () => void;
  onCancel: () => void;
}) {
  const needsAction =
    booking.status === "offered" || booking.status === "accepted";
  const showCancel = isCancellable(booking.status);

  return (
    <article
      className={`${panelClassName} relative overflow-hidden ${
        isHighlighted
          ? "ring-1 ring-[rgba(223,197,106,0.42)] shadow-[0_22px_60px_rgba(223,197,106,0.14)]"
          : ""
      }`}
    >
      <div
        className={`absolute inset-y-0 left-0 w-1 ${
          needsAction
            ? "bg-[var(--color-accent)]"
            : booking.status === "paid"
              ? "bg-emerald-400"
              : "bg-[rgba(255,255,255,0.18)]"
        }`}
      />

      <div className="flex flex-col md:flex-row">
        <div className="border-b border-[rgba(255,255,255,0.05)] bg-[rgba(19,26,39,0.38)] p-6 md:w-[34%] md:border-b-0 md:border-r">
          <div className="flex items-start justify-between gap-4">
            <span
              className={`border px-3 py-1 text-[10px] uppercase tracking-[0.2em] ${statusClasses(booking.status)}`}
            >
              {statusLabel(booking.status)}
            </span>
            <span className="font-mono text-[10px] text-[var(--color-text-dim)]">
              {booking.id.slice(0, 8)}
            </span>
          </div>

          <h3 className="mt-5 font-heading text-2xl text-white">
            {formatEventType(booking.event_type)}
          </h3>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-[var(--color-text-dim)]">
            <MapPin className="h-3.5 w-3.5 text-[var(--color-accent)]" />
            {cinemaName}
          </p>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.05)] pb-2">
              <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-dim)]">
                Guests
              </span>
              <span className="text-sm font-medium text-white">
                {booking.group_size}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.05)] pb-2">
              <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-dim)]">
                Requested Start
              </span>
              <span className="text-right text-sm font-medium text-white">
                {formatDateTime(booking.preferred_start_at)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-dim)]">
                Requested End
              </span>
              <span className="text-right text-sm font-medium text-white">
                {formatDateTime(booking.preferred_end_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-between bg-[rgba(27,34,49,0.16)] p-6">
          <div>
            <div className="mb-4 grid gap-3 text-sm text-[var(--color-text-dim)] sm:grid-cols-2 xl:grid-cols-4">
              <RequestDetail
                icon={<CalendarClock className="h-4 w-4" />}
                label="Offered Start"
                value={formatDateTime(booking.offered_start_at)}
              />
              <RequestDetail
                icon={<CalendarClock className="h-4 w-4" />}
                label="Offered End"
                value={formatDateTime(booking.offered_end_at)}
              />
              <RequestDetail
                icon={<Building2 className="h-4 w-4" />}
                label="Location"
                value={offeredLocationName ?? "Venue assigned on offer"}
              />
              <RequestDetail
                icon={<Ticket className="h-4 w-4" />}
                label="Quote"
                value={formatMoney(
                  booking.quoted_price_cents,
                  booking.currency,
                )}
              />
            </div>

            {offeredHallName ? (
              <div className="mb-4 rounded-sm border border-[rgba(223,197,106,0.18)] bg-[rgba(19,26,39,0.48)] px-4 py-3 text-sm text-white">
                Assigned hall:{" "}
                <span className="text-[var(--color-accent)]">
                  {offeredHallName}
                </span>
              </div>
            ) : null}

            {booking.status === "offered" ? (
              <div className="mb-4 flex gap-3 rounded-sm border border-[rgba(223,197,106,0.26)] bg-[rgba(223,197,106,0.08)] p-4 text-sm leading-6 text-white/90">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[var(--color-accent)]" />
                <p>
                  The cinema responded with an offer. Review the details and
                  continue to payment if the proposal works for you.
                </p>
              </div>
            ) : null}

            {booking.status === "rejected" ? (
              <div className="mb-4 flex gap-3 rounded-sm border border-red-400/25 bg-red-400/10 p-4 text-sm leading-6 text-red-100">
                <X className="mt-1 h-4 w-4 shrink-0" />
                <p>
                  The cinema reviewed this request and cannot host it this time.
                </p>
              </div>
            ) : null}

            {booking.cinema_response_message ? (
              <div className="flex gap-3 rounded-sm border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4 text-sm leading-6 text-[var(--color-text-dim)]">
                <MessageSquareText className="mt-1 h-4 w-4 shrink-0 text-[var(--color-accent)]" />
                <p>{booking.cinema_response_message}</p>
              </div>
            ) : null}

            {!booking.cinema_response_message &&
            booking.status === "submitted" ? (
              <div className="flex gap-3 rounded-sm border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4 text-sm leading-6 text-[var(--color-text-dim)]">
                <MailCheck className="mt-1 h-4 w-4 shrink-0 text-[var(--color-accent)]" />
                <p>
                  Your request has been sent. The cinema will review
                  availability and respond with an offer or rejection.
                </p>
              </div>
            ) : null}

            {!booking.cinema_response_message &&
            booking.status === "in_review" ? (
              <div className="flex gap-3 rounded-sm border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4 text-sm leading-6 text-[var(--color-text-dim)]">
                <LoaderCircle className="mt-1 h-4 w-4 shrink-0 text-[var(--color-accent)]" />
                <p>
                  The cinema is reviewing your request and preparing the best
                  possible hall and timing option.
                </p>
              </div>
            ) : null}

            {booking.notes ? (
              <p className="mt-4 text-xs leading-5 text-[var(--color-text-dim)]">
                Your note: {booking.notes}
              </p>
            ) : null}
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-[rgba(255,255,255,0.05)] pt-4 sm:flex-row sm:items-center sm:justify-end">
            {showCancel ? (
              <button
                type="button"
                onClick={onCancel}
                disabled={isCancelling}
                className={secondaryButtonClassName}
              >
                {isCancelling ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Cancelling
                  </>
                ) : (
                  "Cancel Request"
                )}
              </button>
            ) : null}

            {needsAction ? (
              <button
                type="button"
                onClick={onAccept}
                disabled={isAccepting}
                className={primaryButtonClassName}
              >
                {isAccepting ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Opening Checkout
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    {getActionLabel(booking.status)}
                  </>
                )}
              </button>
            ) : booking.status === "paid" ? (
              <div className="inline-flex items-center gap-2 rounded-sm border border-[rgba(74,222,128,0.28)] bg-[rgba(74,222,128,0.12)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                <CheckCircle2 className="h-4 w-4" />
                Booking Confirmed
              </div>
            ) : (
              <span className="border border-[rgba(223,197,106,0.14)] px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-dim)]">
                No action needed
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function RequestDetail({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-2">
      <span className="mt-0.5 text-[var(--color-accent)]">{icon}</span>
      <span>
        <span className="block text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-dim)]">
          {label}
        </span>
        <span className="mt-1 block text-white">{value}</span>
      </span>
    </div>
  );
}

export function PrivateBookingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = useConfirmDialog();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { session, isAuthenticated, isLoading } = useAuth();
  const token = session?.access_token ?? null;
  const [notice, setNotice] = useState<NoticeState>(null);
  const [activeTab, setActiveTab] = useState<RequestTab>("action");
  const { data: cinemas = [], isLoading: cinemasLoading } = useCinemas();
  const activeCinemas = useMemo(
    () => cinemas.filter((cinema) => cinema.is_active),
    [cinemas],
  );
  const [formState, setFormState] = useState({
    cinemaId: "",
    preferredLocationId: "",
    eventType: "",
    groupSize: "",
    preferredStartAt: "",
    preferredEndAt: "",
    notes: "",
  });
  const selectedCinemaId = formState.cinemaId;
  const privateBookingPurchaseSucceeded =
    searchParams.get("purchase") === "private-booking-success";
  const emailLinkSource = searchParams.get("source") === "email";
  const emailLinkedBookingId = searchParams.get("booking_id");

  useEffect(() => {
    if (!formState.cinemaId && activeCinemas.length > 0) {
      setFormState((current) => ({
        ...current,
        cinemaId: activeCinemas[0].id,
      }));
    }
  }, [activeCinemas, formState.cinemaId]);

  const selectedCinema = useMemo(
    () =>
      activeCinemas.find((cinema) => cinema.id === selectedCinemaId) ?? null,
    [activeCinemas, selectedCinemaId],
  );

  const locationsQuery = useQuery({
    queryKey: ["private-booking-locations", selectedCinemaId],
    enabled: Boolean(selectedCinemaId),
    queryFn: () => listCinemaLocations(selectedCinemaId),
    staleTime: 5 * 60 * 1000,
  });

  const hallsQuery = useQuery({
    queryKey: ["private-booking-halls", selectedCinemaId],
    enabled: Boolean(selectedCinemaId),
    queryFn: () => listCinemaHalls(selectedCinemaId),
    staleTime: 5 * 60 * 1000,
  });

  const locations = locationsQuery.data ?? [];
  const privateBookableHalls = useMemo(
    () => (hallsQuery.data ?? []).filter((hall) => hall.allow_private_booking),
    [hallsQuery.data],
  );

  useEffect(() => {
    if (
      formState.preferredLocationId &&
      !locations.some(
        (location) => location.id === formState.preferredLocationId,
      )
    ) {
      setFormState((current) => ({
        ...current,
        preferredLocationId: "",
      }));
    }
  }, [formState.preferredLocationId, locations]);

  const bookingsQuery = useQuery({
    queryKey: ["private-bookings", token],
    enabled: Boolean(token),
    queryFn: () => listPrivateBookings(token as string),
    refetchInterval: 30 * 1000,
  });

  const bookings = useMemo(
    () =>
      [...(bookingsQuery.data ?? [])].sort((left, right) =>
        right.created_at.localeCompare(left.created_at),
      ),
    [bookingsQuery.data],
  );
  const offeredResponseCount = useMemo(
    () => bookings.filter((booking) => booking.status === "offered").length,
    [bookings],
  );
  const rejectedResponseCount = useMemo(
    () => bookings.filter((booking) => booking.status === "rejected").length,
    [bookings],
  );
  const responseCount = offeredResponseCount + rejectedResponseCount;

  const distinctBookingCinemaIds = useMemo(
    () => [...new Set(bookings.map((booking) => booking.cinema_id))],
    [bookings],
  );

  const bookingVenueQueries = useQueries({
    queries: distinctBookingCinemaIds.map((cinemaId) => ({
      queryKey: ["private-booking-booking-venues", cinemaId],
      queryFn: async () => ({
        cinemaId,
        locations: await listCinemaLocations(cinemaId),
        halls: await listCinemaHalls(cinemaId),
      }),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const bookingVenueMap = useMemo(() => {
    const mapping = new Map<
      string,
      { locations: CinemaLocationRead[]; halls: CinemaHallRead[] }
    >();

    for (const query of bookingVenueQueries) {
      if (query.data) {
        mapping.set(query.data.cinemaId, {
          locations: query.data.locations,
          halls: query.data.halls,
        });
      }
    }

    return mapping;
  }, [bookingVenueQueries]);

  const filteredBookings = useMemo(() => {
    const statuses = groupStatuses(activeTab);
    const visibleBookings = bookings.filter((booking) =>
      statuses.has(booking.status),
    );

    if (!emailLinkedBookingId) {
      return visibleBookings;
    }

    return [...visibleBookings].sort((left, right) => {
      if (left.id === emailLinkedBookingId) {
        return -1;
      }
      if (right.id === emailLinkedBookingId) {
        return 1;
      }
      return 0;
    });
  }, [activeTab, bookings, emailLinkedBookingId]);

  useEffect(() => {
    if (!emailLinkSource || !emailLinkedBookingId || bookings.length === 0) {
      return;
    }

    const targetBooking = bookings.find(
      (booking) => booking.id === emailLinkedBookingId,
    );
    if (!targetBooking) {
      return;
    }

    setActiveTab(tabForStatus(targetBooking.status));
  }, [bookings, emailLinkedBookingId, emailLinkSource]);

  const createMutation = useMutation({
    mutationFn: async (payload: PrivateBookingCreate) => {
      if (!token) {
        throw new Error(
          "Login is required to submit a private booking request.",
        );
      }

      return createPrivateBooking(payload, token);
    },
    onSuccess: async () => {
      setNotice({
        kind: "success",
        message:
          "Your private booking request was submitted. A cinema admin will review it and send an offer or reject the request.",
      });
      setActiveTab("pending");
      setFormState((current) => ({
        ...current,
        eventType: "",
        groupSize: "",
        preferredStartAt: "",
        preferredEndAt: "",
        notes: "",
      }));
      await queryClient.invalidateQueries({
        queryKey: ["private-bookings", token],
      });
    },
    onError: (error) => {
      setNotice({
        kind: "error",
        message: getErrorMessage(error),
      });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      if (!token) {
        throw new Error("Login is required to accept a private booking offer.");
      }

      return acceptPrivateBookingCheckoutSession(bookingId, token);
    },
    onSuccess: (checkout) => {
      window.location.assign(checkout.checkout_url);
    },
    onError: (error) => {
      setNotice({
        kind: "error",
        message: getErrorMessage(error),
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      if (!token) {
        throw new Error("Login is required to cancel a request.");
      }

      return cancelPrivateBooking(bookingId, token);
    },
    onSuccess: async () => {
      setNotice({
        kind: "success",
        message: "Your private booking request was cancelled.",
      });
      await queryClient.invalidateQueries({
        queryKey: ["private-bookings", token],
      });
    },
    onError: (error) => {
      setNotice({
        kind: "error",
        message: getErrorMessage(error),
      });
    },
  });

  function dismissPurchaseSuccess() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("purchase");
    nextParams.delete("booking_id");
    nextParams.delete("order_id");
    setSearchParams(nextParams, { replace: true });
  }

  function dismissEmailBookingBanner() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("source");
    nextParams.delete("booking_id");
    setSearchParams(nextParams, { replace: true });
  }

  function handleSubmitRequest() {
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

    if (!selectedCinemaId) {
      setNotice({
        kind: "error",
        message: "Please select a cinema before submitting the request.",
      });
      return;
    }

    if (
      !formState.eventType ||
      !formState.groupSize ||
      !formState.preferredStartAt ||
      !formState.preferredEndAt
    ) {
      setNotice({
        kind: "error",
        message:
          "Please complete the event type, guest count, and preferred timing fields.",
      });
      return;
    }

    createMutation.mutate({
      cinema_id: selectedCinemaId,
      preferred_location_id: formState.preferredLocationId || undefined,
      preferred_start_at: toIsoValue(formState.preferredStartAt),
      preferred_end_at: toIsoValue(formState.preferredEndAt),
      group_size: Number(formState.groupSize),
      event_type: formState.eventType,
      notes: formState.notes.trim() || undefined,
    });
  }

  if (isLoading) {
    return <LoadingState label="Checking your account." />;
  }

  return (
    <section className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(223,197,106,0.1),transparent_34rem)] px-4 pb-24 pt-10 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <section className="relative pb-16 text-center sm:px-2">
          <div className="pointer-events-none absolute left-1/2 top-0 h-[360px] w-[calc(100vw-2rem)] max-w-[780px] -translate-x-1/2 rounded-full bg-[rgba(223,197,106,0.05)] blur-[120px]" />
          <div className="relative z-10 mx-auto max-w-4xl">
            <h1 className="font-heading text-4xl leading-[1.04] text-white min-[380px]:text-5xl md:text-6xl lg:text-7xl">
              Cinema{" "}
              <span className=" text-[rgba(223,197,106,0.92)]">Booking</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg font-light leading-relaxed text-[var(--color-text-dim)]">
              Request a private cinema experience for screenings, birthdays,
              team events, or special occasions.
            </p>
          </div>
        </section>

        {privateBookingPurchaseSucceeded ? (
          <div className="mb-8 border border-[rgba(223,197,106,0.3)] bg-[linear-gradient(135deg,rgba(223,197,106,0.12),rgba(27,34,49,0.72))] px-5 py-4 shadow-[0_18px_36px_rgba(0,0,0,0.22)]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-[var(--color-accent)]" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
                    Private Booking Confirmed
                  </p>
                  <p className="mt-1 text-sm leading-6 text-white/92">
                    Your private booking payment was received successfully.
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

        {emailLinkSource ? (
          <div className="mb-8 border border-[rgba(223,197,106,0.22)] bg-[rgba(223,197,106,0.08)] px-5 py-4 shadow-[0_18px_36px_rgba(0,0,0,0.18)]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <MailCheck className="mt-0.5 h-5 w-5 text-[var(--color-accent)]" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
                    Email Link Opened
                  </p>
                  <p className="mt-1 text-sm leading-6 text-white/92">
                    Review the highlighted request below and use{" "}
                    <span className="text-[var(--color-accent)]">
                      Cancel Request
                    </span>{" "}
                    if you still want to cancel it.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={dismissEmailBookingBanner}
                className="cursor-pointer text-[var(--color-text-dim)] transition-colors duration-300 hover:text-[var(--color-accent)]"
                aria-label="Dismiss email link message"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        {notice ? (
          <div
            className={`mb-8 border px-5 py-4 text-sm ${
              notice.kind === "success"
                ? "border-[rgba(74,222,128,0.3)] bg-[rgba(74,222,128,0.12)] text-emerald-100"
                : "border-red-400/30 bg-red-400/10 text-red-100"
            }`}
          >
            {notice.message}
          </div>
        ) : null}

        {isAuthenticated && responseCount > 0 ? (
          <div className="mb-8 border border-[rgba(223,197,106,0.28)] bg-[rgba(223,197,106,0.08)] px-5 py-4 shadow-[0_18px_36px_rgba(0,0,0,0.18)]">
            <div className="flex items-start gap-3">
              <MailCheck className="mt-0.5 h-5 w-5 text-[var(--color-accent)]" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
                  Cinema responded
                </p>
                <p className="mt-1 text-sm leading-6 text-white/92">
                  {offeredResponseCount > 0
                    ? `${offeredResponseCount} offer${offeredResponseCount === 1 ? "" : "s"} ready`
                    : "No active offers"}
                  {rejectedResponseCount > 0
                    ? ` · ${rejectedResponseCount} rejected request${rejectedResponseCount === 1 ? "" : "s"}`
                    : ""}
                  . Review the updated requests below.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <section className="relative z-10 mb-24">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              {cinemasLoading ? (
                <LoadingState label="Loading cinemas." />
              ) : (
                <VenuePanel
                  cinemas={activeCinemas}
                  selectedCinemaId={selectedCinemaId}
                  onSelectCinema={(cinemaId) =>
                    setFormState((current) => ({
                      ...current,
                      cinemaId,
                      preferredLocationId: "",
                    }))
                  }
                  selectedCinema={selectedCinema}
                  locations={locations}
                  privateBookableHalls={privateBookableHalls}
                  locationsLoading={locationsQuery.isLoading}
                  hallsLoading={hallsQuery.isLoading}
                />
              )}
            </div>

            <div className="lg:col-span-7">
              <RequestFormCard
                formState={formState}
                setFormState={setFormState}
                locations={locations}
                privateBookableHalls={privateBookableHalls}
                isAuthenticated={isAuthenticated}
                isSubmitting={createMutation.isPending}
                onSubmit={handleSubmitRequest}
              />
            </div>
          </div>
        </section>

        <div className="mb-20">
          <div className="h-px w-full bg-[linear-gradient(90deg,transparent,rgba(223,197,106,0.4),transparent)] opacity-40" />
        </div>

        <section className="space-y-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="font-heading text-3xl text-white md:text-4xl">
                Your Requests
              </h2>
              <p className="mt-2 text-sm text-[var(--color-text-dim)]">
                Track cinema responses, accept offers, and return to payment if
                a proposal is ready.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: "action", label: "Action Required" },
                  { id: "pending", label: "Pending" },
                  { id: "confirmed", label: "Confirmed" },
                  { id: "past", label: "Past" },
                ] as const
              ).map((tab) => {
                const count = getTabCount(bookings, tab.id);

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`cursor-pointer border-b-2 px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] transition-colors duration-300 ${
                      activeTab === tab.id
                        ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                        : "border-transparent text-[var(--color-text-dim)] hover:text-white"
                    }`}
                  >
                    {tab.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {!isAuthenticated ? (
            <div className={`${panelClassName} p-8`}>
              <MailCheck className="h-8 w-8 text-[var(--color-accent)]" />
              <h3 className="mt-4 text-xl font-semibold text-white">
                Sign in to manage requests
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--color-text-dim)]">
                Your request history, cinema offers, and payment actions appear
                here once you are signed in.
              </p>
              <button
                type="button"
                onClick={() =>
                  navigate("/login", { state: { from: location } })
                }
                className={`${primaryButtonClassName} mt-6`}
              >
                Sign In
              </button>
            </div>
          ) : bookingsQuery.isLoading ? (
            <LoadingState label="Loading private booking requests." />
          ) : filteredBookings.length === 0 ? (
            <div className={`${panelClassName} p-8`}>
              <MailCheck className="h-8 w-8 text-[var(--color-accent)]" />
              <h3 className="mt-4 text-xl font-semibold text-white">
                No requests in this category
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--color-text-dim)]">
                Requests you submit here will appear below once they match this
                status group.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredBookings.map((booking) => {
                const cinemaName =
                  activeCinemas.find(
                    (cinema) => cinema.id === booking.cinema_id,
                  )?.name ?? "Selected cinema";
                const venueData = bookingVenueMap.get(booking.cinema_id);
                const offeredLocationName =
                  venueData?.locations.find(
                    (location) => location.id === booking.offered_location_id,
                  )?.location_name ??
                  venueData?.locations.find(
                    (location) => location.id === booking.offered_location_id,
                  )?.city_name ??
                  null;
                const offeredHallName =
                  venueData?.halls.find(
                    (hall) => hall.id === booking.offered_hall_id,
                  )?.name ?? null;

                return (
                  <RequestCard
                    key={booking.id}
                    booking={booking}
                    cinemaName={cinemaName}
                    offeredLocationName={offeredLocationName}
                    offeredHallName={offeredHallName}
                    isAccepting={
                      acceptMutation.isPending &&
                      acceptMutation.variables === booking.id
                    }
                    isCancelling={
                      cancelMutation.isPending &&
                      cancelMutation.variables === booking.id
                    }
                    isHighlighted={booking.id === emailLinkedBookingId}
                    onAccept={() => acceptMutation.mutate(booking.id)}
                    onCancel={async () => {
                      const confirmed = await confirm({
                        title: "Cancel request?",
                        message: "Cancel this private booking request?",
                        confirmLabel: "Cancel request",
                      });
                      if (confirmed) {
                        cancelMutation.mutate(booking.id);
                      }
                    }}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
