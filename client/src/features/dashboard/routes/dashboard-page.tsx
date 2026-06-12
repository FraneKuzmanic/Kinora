import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarClock,
  CheckCircle2,
  LoaderCircle,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Ticket,
  Upload,
  XCircle,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import type { RootLayoutOutletContext } from "@/app/routes/root-layout";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { cn } from "@/utils/cn";
import {
  addCampaignMovie,
  cancelCampaign,
  createCampaign,
  getCampaign,
  publishCampaign,
  removeCampaignMovie,
  resolveCampaign,
  searchCampaigns,
  updateCampaign,
  type CampaignCreate,
  type CampaignDetailRead,
  type CampaignRead,
} from "@/lib/api/campaigns";
import {
  createCinemaHall,
  createCinemaLocation,
  createCinemaValidator,
  deleteCinemaHall,
  deleteCinemaLocation,
  getMyCinema,
  listCinemaHalls,
  listCinemaLocations,
  listCinemaValidators,
  revokeCinemaValidator,
  updateCinema,
  updateCinemaHall,
  updateCinemaLocation,
  uploadCinemaLogo,
  type CinemaHallRead,
  type CinemaLocationRead,
  type CinemaRead,
  type CinemaUpdate,
} from "@/lib/api/cinemas";
import { useMovieCatalog } from "@/features/movies/queries/use-movie-catalog";
import type { MovieRead } from "@/lib/api/movies";
import {
  cancelPrivateBooking,
  listPrivateBookings,
  reviewPrivateBooking,
  type PrivateBookingRead,
} from "@/lib/api/private-bookings";
import {
  cancelScreening,
  confirmScreening,
  openScreeningSales,
  searchScreenings,
  type ScreeningRead,
} from "@/lib/api/screenings";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { syncTmdbMovie } from "@/lib/api/admin";
import {
  getCinemaRecommendations,
  type FilmScoreRead,
} from "@/lib/api/predictions";
import { tmdbImageUrl } from "@/lib/images";

type AdminTab =
  | "campaigns"
  | "validators"
  | "profile"
  | "locations"
  | "bookings";

type Notice = {
  tone: "success" | "error";
  text: string;
} | null;

type CampaignMutationVariables = {
  action: "create" | "create-with-movies" | "update" | "publish" | "resolve" | "cancel" | "add-movie" | "remove-movie";
  campaignId?: string;
  payload?:
    | CampaignCreate
    | Partial<CampaignCreate>
    | { movie_id: string; sort_order?: number }
    | { campaign: CampaignCreate; movieIds: string[] };
  campaignMovieId?: string;
};

type ScreeningMutationVariables = {
  action: "open-sales" | "confirm" | "cancel";
  screeningId: string;
  reason?: string;
};

type ValidatorMutationVariables = {
  action: "create" | "revoke";
  validatorUserId?: string;
  payload?: { email: string; password: string; display_name?: string };
};

type LocationMutationVariables = {
  action: "create" | "update" | "delete";
  locationId?: string;
  payload?: Record<string, unknown>;
};

type HallMutationVariables = {
  action: "create" | "update" | "delete";
  locationId: string;
  hallId?: string;
  payload?: Record<string, unknown>;
};

type BookingMutationVariables = {
  action: "review" | "cancel";
  bookingId: string;
  payload?: Record<string, unknown>;
  reason?: string;
};

type BookingReviewMode = "offer" | "reject";

type LooseMutation<TVariables> = {
  isPending: boolean;
  mutate: (variables: TVariables) => void;
  mutateAsync: (variables: TVariables) => Promise<unknown>;
};

const tabs: Array<{ id: AdminTab; label: string; icon: ReactNode }> = [
  { id: "campaigns", label: "Campaigns", icon: <CalendarClock className="h-4 w-4" /> },
  { id: "validators", label: "Validators", icon: <ShieldCheck className="h-4 w-4" /> },
  { id: "profile", label: "Cinema Profile", icon: <Building2 className="h-4 w-4" /> },
  { id: "locations", label: "Locations & Halls", icon: <MapPin className="h-4 w-4" /> },
  { id: "bookings", label: "Private Bookings", icon: <Ticket className="h-4 w-4" /> },
];

const panelClassName =
  "border border-[rgba(223,197,106,0.18)] bg-[rgba(27,34,49,0.78)] shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-md";

const inputClassName =
  "min-w-0 w-full border border-[rgba(223,197,106,0.22)] bg-[rgba(19,26,39,0.76)] px-3 py-3 text-sm text-white outline-none transition-colors placeholder:text-[var(--color-text-dim)] focus:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60";

const buttonClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 border px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 sm:text-[11px] sm:tracking-[0.22em]";

function isDesktopWorkspaceViewport() {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const { dashboardMobileTab, setDashboardMobileTab } =
    useOutletContext<RootLayoutOutletContext>();
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const [activeTab, setActiveTab] = useState<AdminTab>("campaigns");
  const [notice, setNotice] = useState<Notice>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const cinemaQuery = useQuery({
    queryKey: ["admin", "cinema", token],
    enabled: Boolean(token),
    queryFn: () => getMyCinema(token as string),
  });

  const cinemaId = cinemaQuery.data?.id;

  const locationsQuery = useQuery({
    queryKey: ["admin", "cinema", cinemaId, "locations"],
    enabled: Boolean(cinemaId),
    queryFn: () => listCinemaLocations(cinemaId as string),
  });

  const hallsQuery = useQuery({
    queryKey: ["admin", "cinema", cinemaId, "halls"],
    enabled: Boolean(cinemaId),
    queryFn: () => listCinemaHalls(cinemaId as string),
  });

  const validatorsQuery = useQuery({
    queryKey: ["admin", "cinema", cinemaId, "validators"],
    enabled: Boolean(cinemaId && token),
    queryFn: () => listCinemaValidators(cinemaId as string, token as string),
  });

  const campaignsQuery = useQuery({
    queryKey: ["admin", "cinema", cinemaId, "campaigns"],
    enabled: Boolean(cinemaId),
    queryFn: () => searchCampaigns({ cinema_id: cinemaId as string }),
  });

  const selectedCampaignQuery = useQuery({
    queryKey: ["admin", "campaign", selectedCampaignId, token],
    enabled: Boolean(selectedCampaignId && token),
    queryFn: () => getCampaign(selectedCampaignId as string, token as string),
  });

  const screeningsQuery = useQuery({
    queryKey: ["admin", "cinema", cinemaId, "screenings"],
    enabled: Boolean(cinemaId),
    queryFn: () => searchScreenings({ cinema_id: cinemaId as string }),
  });

  const bookingsQuery = useQuery({
    queryKey: ["admin", "private-bookings", token],
    enabled: Boolean(token),
    queryFn: () => listPrivateBookings(token as string),
    refetchInterval: 30 * 1000,
  });

  const { data: movies = [] } = useMovieCatalog();

  const cinema = cinemaQuery.data ?? null;
  const locations = locationsQuery.data ?? [];
  const halls = hallsQuery.data ?? [];
  const validators = validatorsQuery.data ?? [];
  const campaigns = campaignsQuery.data ?? [];
  const selectedCampaign = selectedCampaignQuery.data ?? null;
  const screenings = screeningsQuery.data ?? [];
  const bookings = bookingsQuery.data ?? [];
  const newBookingRequestCount = useMemo(
    () => bookings.filter((booking) => booking.status === "submitted").length,
    [bookings],
  );

  const movieOptions = useMemo(
    () => [...movies].sort((left, right) => left.title.localeCompare(right.title)),
    [movies],
  );

  const campaignOptions = useMemo(
    () => [...campaigns].sort((left, right) => right.slot_starts_at.localeCompare(left.slot_starts_at)),
    [campaigns],
  );

  const campaignScreenings = useMemo(
    () => selectedCampaignId ? screenings.filter((screening) => screening.campaign_id === selectedCampaignId) : [],
    [screenings, selectedCampaignId],
  );

  const hallsByLocation = useMemo(() => {
    const grouped = new Map<string, CinemaHallRead[]>();
    for (const hall of halls) {
      const current = grouped.get(hall.location_id) ?? [];
      current.push(hall);
      grouped.set(hall.location_id, current);
    }
    return grouped;
  }, [halls]);

  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking.id === selectedBookingId) ?? null,
    [bookings, selectedBookingId],
  );

  useEffect(() => {
    if (
      !selectedCampaignId &&
      !isCreatingCampaign &&
      campaigns.length > 0 &&
      isDesktopWorkspaceViewport()
    ) {
      setSelectedCampaignId(campaigns[0].id);
    }
  }, [campaigns, selectedCampaignId, isCreatingCampaign]);

  useEffect(() => {
    if (!selectedBookingId && bookings.length > 0 && isDesktopWorkspaceViewport()) {
      setSelectedBookingId(bookings[0].id);
    }
  }, [bookings, selectedBookingId]);

  useEffect(() => {
    setActiveTab(dashboardMobileTab);
  }, [dashboardMobileTab]);

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timeoutId = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const invalidateCinemaWorkspace = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "cinema"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "private-bookings"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "campaign"] }),
    ]);
  };

  const cinemaMutation = useMutation({
    mutationFn: async (payload: CinemaUpdate) => {
      if (!cinemaId || !token) {
        throw new Error("Cinema session is not ready.");
      }
      return updateCinema(cinemaId, payload, token);
    },
    onSuccess: async () => {
      await invalidateCinemaWorkspace();
      setNotice({ tone: "success", text: "Cinema profile updated." });
    },
    onError: (error) => setNotice({ tone: "error", text: getErrorMessage(error) }),
  });

  const cinemaLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!cinemaId || !token) {
        throw new Error("Cinema session is not ready.");
      }
      return uploadCinemaLogo(cinemaId, file, token);
    },
    onSuccess: async () => {
      await invalidateCinemaWorkspace();
      setNotice({ tone: "success", text: "Cinema logo uploaded." });
    },
    onError: (error) => setNotice({ tone: "error", text: getErrorMessage(error) }),
  });

  const campaignMutation = useMutation({
    mutationFn: async ({
      action,
      campaignId,
      payload,
      campaignMovieId,
    }: {
      action: "create" | "create-with-movies" | "update" | "publish" | "resolve" | "cancel" | "add-movie" | "remove-movie";
      campaignId?: string;
      payload?:
        | CampaignCreate
        | Partial<CampaignCreate>
        | { movie_id: string; sort_order?: number }
        | { campaign: CampaignCreate; movieIds: string[] };
      campaignMovieId?: string;
    }) => {
      if (!token) {
        throw new Error("Cinema session is not ready.");
      }
      if (action === "create") {
        return createCampaign(payload as CampaignCreate, token);
      }
      if (action === "create-with-movies") {
        const createPayload = payload as { campaign: CampaignCreate; movieIds: string[] };
        const campaign = await createCampaign(createPayload.campaign, token);
        for (const [index, movieId] of createPayload.movieIds.entries()) {
          await addCampaignMovie(campaign.id, { movie_id: movieId, sort_order: index + 1 }, token);
        }
        return campaign;
      }
      if (!campaignId) {
        throw new Error("Select a campaign first.");
      }
      if (action === "update") {
        return updateCampaign(campaignId, payload as Partial<CampaignCreate>, token);
      }
      if (action === "publish") {
        return publishCampaign(campaignId, token);
      }
      if (action === "resolve") {
        return resolveCampaign(campaignId, token);
      }
      if (action === "cancel") {
        return cancelCampaign(campaignId, token);
      }
      if (action === "add-movie") {
        return addCampaignMovie(campaignId, payload as { movie_id: string; sort_order?: number }, token);
      }
      if (action === "remove-movie" && campaignMovieId) {
        await removeCampaignMovie(campaignId, campaignMovieId, token);
        return null;
      }
      throw new Error("Invalid campaign action.");
    },
    onSuccess: async (result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "cinema", cinemaId, "campaigns"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "campaign"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "cinema", cinemaId, "screenings"] }),
      ]);
      if ((variables.action === "create" || variables.action === "create-with-movies") && result && "id" in result) {
        setSelectedCampaignId(result.id);
        setIsCreatingCampaign(false);
      }
      setNotice({ tone: "success", text: campaignSuccessMessage(variables.action) });
    },
    onError: (error) => setNotice({ tone: "error", text: getErrorMessage(error) }),
  });

  const screeningMutation = useMutation({
    mutationFn: async ({
      action,
      screeningId,
      reason,
    }: {
      action: "open-sales" | "confirm" | "cancel";
      screeningId: string;
      reason?: string;
    }) => {
      if (!token) {
        throw new Error("Cinema session is not ready.");
      }
      if (action === "open-sales") {
        return openScreeningSales(screeningId, token);
      }
      if (action === "confirm") {
        return confirmScreening(screeningId, token);
      }
      return cancelScreening(screeningId, token, reason);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "cinema", cinemaId, "screenings"] });
      setNotice({ tone: "success", text: "Screening updated." });
    },
    onError: (error) => setNotice({ tone: "error", text: getErrorMessage(error) }),
  });

  const validatorMutation = useMutation({
    mutationFn: async ({
      action,
      validatorUserId,
      payload,
    }: {
      action: "create" | "revoke";
      validatorUserId?: string;
      payload?: { email: string; password: string; display_name?: string };
    }) => {
      if (!cinemaId || !token) {
        throw new Error("Cinema session is not ready.");
      }
      if (action === "create") {
        return createCinemaValidator(cinemaId, payload as { email: string; password: string; display_name?: string }, token);
      }
      if (!validatorUserId) {
        throw new Error("Select a validator first.");
      }
      return revokeCinemaValidator(cinemaId, validatorUserId, token);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "cinema", cinemaId, "validators"] });
      setNotice({ tone: "success", text: "Validator permissions updated." });
    },
    onError: (error) => setNotice({ tone: "error", text: getErrorMessage(error) }),
  });

  const locationMutation = useMutation({
    mutationFn: async ({
      action,
      locationId,
      payload,
    }: {
      action: "create" | "update" | "delete";
      locationId?: string;
      payload?: Record<string, unknown>;
    }) => {
      if (!cinemaId || !token) {
        throw new Error("Cinema session is not ready.");
      }
      if (action === "create") {
        return createCinemaLocation(cinemaId, payload as never, token);
      }
      if (!locationId) {
        throw new Error("Select a location first.");
      }
      if (action === "update") {
        return updateCinemaLocation(cinemaId, locationId, payload as never, token);
      }
      await deleteCinemaLocation(cinemaId, locationId, token);
      return null;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "cinema", cinemaId, "locations"] });
      setNotice({ tone: "success", text: "Location updated." });
    },
    onError: (error) => setNotice({ tone: "error", text: getErrorMessage(error) }),
  });

  const hallMutation = useMutation({
    mutationFn: async ({
      action,
      locationId,
      hallId,
      payload,
    }: {
      action: "create" | "update" | "delete";
      locationId: string;
      hallId?: string;
      payload?: Record<string, unknown>;
    }) => {
      if (!cinemaId || !token) {
        throw new Error("Cinema session is not ready.");
      }
      if (action === "create") {
        return createCinemaHall(cinemaId, locationId, payload as never, token);
      }
      if (!hallId) {
        throw new Error("Select a hall first.");
      }
      if (action === "update") {
        return updateCinemaHall(cinemaId, locationId, hallId, payload as never, token);
      }
      await deleteCinemaHall(cinemaId, locationId, hallId, token);
      return null;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "cinema", cinemaId, "halls"] });
      setNotice({ tone: "success", text: "Hall updated." });
    },
    onError: (error) => setNotice({ tone: "error", text: getErrorMessage(error) }),
  });

  const bookingMutation = useMutation({
    mutationFn: async ({
      action,
      bookingId,
      payload,
      reason,
    }: {
      action: "review" | "cancel";
      bookingId: string;
      payload?: Record<string, unknown>;
      reason?: string;
    }) => {
      if (!token) {
        throw new Error("Cinema session is not ready.");
      }
      if (action === "cancel") {
        return cancelPrivateBooking(bookingId, token, reason);
      }
      return reviewPrivateBooking(bookingId, payload as never, token);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "private-bookings", token] });
      setNotice({ tone: "success", text: "Private booking updated." });
    },
    onError: (error) => setNotice({ tone: "error", text: getErrorMessage(error) }),
  });

  const isLoading =
    cinemaQuery.isLoading ||
    locationsQuery.isLoading ||
    hallsQuery.isLoading ||
    campaignsQuery.isLoading;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(223,197,106,0.12),transparent_34rem),linear-gradient(180deg,rgba(19,26,39,0.98),rgba(11,16,26,1))] px-3 pb-16 pt-4 sm:px-6 sm:pt-8 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8">
        <section className="flex flex-col gap-5 border-b border-[rgba(223,197,106,0.16)] pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--color-accent)]">
              cinema workspace
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
              {cinema?.name ?? "Cinema dashboard"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--color-text-muted)]">
              Manage campaigns, validators, profile details, locations, halls, and private booking
              requests from one workspace.
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 lg:w-auto">
            <Metric label="Campaigns" value={campaigns.length} />
            <Metric label="Catalog" value={movieOptions.length} />
            <Metric label="Validators" value={validators.length} />
            <Metric
              label="Bookings"
              value={bookings.length}
              badge={newBookingRequestCount > 0 ? `${newBookingRequestCount} new` : undefined}
            />
          </div>
        </section>

        <div className="scrollbar-hide -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setDashboardMobileTab(tab.id);
              }}
              className={`${buttonClassName} shrink-0 ${
                activeTab === tab.id
                  ? "border-[rgba(223,197,106,0.44)] bg-[rgba(223,197,106,0.12)] text-[var(--color-accent)]"
                  : "border-[rgba(223,197,106,0.18)] text-[var(--color-text-dim)] hover:border-[rgba(223,197,106,0.32)] hover:text-white"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.id === "bookings" && newBookingRequestCount > 0 ? (
                <span className="ml-1 border border-[rgba(223,197,106,0.32)] bg-[rgba(223,197,106,0.14)] px-2 py-0.5 text-[10px] text-[var(--color-accent)]">
                  {newBookingRequestCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {notice ? (
          <div
            className={`border px-4 py-3 text-sm ${
              notice.tone === "success"
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                : "border-red-400/30 bg-red-400/10 text-red-100"
            }`}
          >
            {notice.text}
          </div>
        ) : null}

        {isLoading ? (
          <div className={`${panelClassName} flex items-center gap-3 p-6 text-sm text-[var(--color-text-muted)]`}>
            <LoaderCircle className="h-5 w-5 animate-spin text-[var(--color-accent)]" />
            Loading cinema workspace.
          </div>
        ) : null}

        {activeTab === "campaigns" ? (
          <CampaignsTab
            campaigns={campaignOptions}
            selectedCampaign={selectedCampaign}
            selectedCampaignId={selectedCampaignId}
            isCreatingCampaign={isCreatingCampaign}
            campaignScreenings={campaignScreenings}
            locations={locations}
            halls={halls}
            movieOptions={movieOptions}
            campaignMutation={campaignMutation}
            screeningMutation={screeningMutation}
            setSelectedCampaignId={setSelectedCampaignId}
            setIsCreatingCampaign={setIsCreatingCampaign}
            cinemaId={cinemaId}
            token={token}
          />
        ) : null}

        {activeTab === "validators" ? (
          <ValidatorsTab
            validators={validators}
            validatorMutation={validatorMutation}
          />
        ) : null}

        {activeTab === "profile" ? (
          <CinemaProfileTab
            cinema={cinema}
            cinemaMutation={cinemaMutation}
            cinemaLogoMutation={cinemaLogoMutation}
          />
        ) : null}

        {activeTab === "locations" ? (
          <LocationsTab
            locations={locations}
            hallsByLocation={hallsByLocation}
            locationMutation={locationMutation}
            hallMutation={hallMutation}
          />
        ) : null}

        {activeTab === "bookings" ? (
          <BookingsTab
            bookings={bookings}
            selectedBooking={selectedBooking}
            selectedBookingId={selectedBookingId}
            setSelectedBookingId={setSelectedBookingId}
            locations={locations}
            hallsByLocation={hallsByLocation}
            bookingMutation={bookingMutation}
            newRequestCount={newBookingRequestCount}
          />
        ) : null}
      </div>
    </div>
  );
}

function CampaignsTab({
  campaigns,
  selectedCampaign,
  selectedCampaignId,
  isCreatingCampaign,
  campaignScreenings,
  locations,
  halls,
  movieOptions,
  campaignMutation,
  screeningMutation,
  setSelectedCampaignId,
  setIsCreatingCampaign,
  cinemaId,
  token,
}: {
  campaigns: CampaignRead[];
  selectedCampaign: CampaignDetailRead | null;
  selectedCampaignId: string | null;
  isCreatingCampaign: boolean;
  campaignScreenings: ScreeningRead[];
  locations: CinemaLocationRead[];
  halls: CinemaHallRead[];
  movieOptions: MovieRead[];
  campaignMutation: LooseMutation<CampaignMutationVariables>;
  screeningMutation: LooseMutation<ScreeningMutationVariables>;
  setSelectedCampaignId: (id: string | null) => void;
  setIsCreatingCampaign: (value: boolean) => void;
  cinemaId: string | undefined;
  token: string | null;
}) {
  const confirm = useConfirmDialog();
  const [newMovieIds, setNewMovieIds] = useState<string[]>([]);
  const [movieSearch, setMovieSearch] = useState("");
  const [locationId, setLocationId] = useState<string>("");
  const [draftFormKey, setDraftFormKey] = useState(0);
  const isNewCampaign = isCreatingCampaign;
  const isDraft = isNewCampaign || selectedCampaign?.status === "draft";
  const activeCampaign = isNewCampaign ? null : selectedCampaign;
  const selectedMovieIds = isNewCampaign
    ? newMovieIds
    : activeCampaign?.movies.map((movie) => movie.movie_id) ?? [];
  const selectedHall = halls.find((hall) => hall.id === activeCampaign?.hall_id);
  const effectiveLocationId = locationId || selectedHall?.location_id || locations[0]?.id || "";
  const filteredHalls = halls.filter((hall) => hall.location_id === effectiveLocationId);
  const defaultHallId =
    activeCampaign && selectedHall?.location_id === effectiveLocationId
      ? activeCampaign.hall_id
      : filteredHalls[0]?.id ?? "";

  useEffect(() => {
    if (activeCampaign) {
      const hall = halls.find((item) => item.id === activeCampaign.hall_id);
      setLocationId(hall?.location_id ?? "");
    } else {
      setLocationId(locations[0]?.id ?? "");
    }
  }, [halls, locations, activeCampaign]);

  const handleAddMovie = (movieId: string) => {
    if (isNewCampaign) {
      setNewMovieIds((current) => current.includes(movieId) ? current : [...current, movieId]);
      return;
    }
    if (!activeCampaign || !isDraft) {
      return;
    }
    campaignMutation.mutate({
      action: "add-movie",
      campaignId: activeCampaign.id,
      payload: {
        movie_id: movieId,
        sort_order: activeCampaign.movies.length + 1,
      },
    });
  };

  const handleRemoveMovie = async (movieId: string) => {
    if (isNewCampaign) {
      setNewMovieIds((current) => current.filter((id) => id !== movieId));
      return;
    }
    const campaignMovie = activeCampaign?.movies.find((movie) => movie.movie_id === movieId);
    if (!activeCampaign || !campaignMovie || !isDraft) {
      return;
    }
    const confirmed = await confirm({
      title: "Remove movie?",
      message: "Remove this movie from the campaign?",
      confirmLabel: "Remove",
    });
    if (!confirmed) {
      return;
    }
    campaignMutation.mutate({
      action: "remove-movie",
      campaignId: activeCampaign.id,
      campaignMovieId: campaignMovie.id,
    });
  };

  const status = activeCampaign?.status ?? (isNewCampaign ? "draft" : null);
  const panelTitle = isNewCampaign ? "New campaign" : activeCampaign?.title ?? "Select a campaign";
  const isCampaignDetailOpen = isCreatingCampaign || Boolean(selectedCampaignId);
  const showAdvancedOpenByDefault = !isNewCampaign && Boolean(
    activeCampaign && (
      activeCampaign.max_tickets ||
      (activeCampaign.voting_duration_days && activeCampaign.voting_duration_days !== 7) ||
      (activeCampaign.decision_days_before_screening !== undefined && activeCampaign.decision_days_before_screening !== 7)
    ),
  );

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[18rem_1fr] lg:gap-6">
      <aside
        className={cn(
          "space-y-3",
          isCampaignDetailOpen ? "hidden lg:block" : "",
        )}
      >
        <button
          type="button"
          onClick={() => {
            setIsCreatingCampaign(true);
            setSelectedCampaignId(null);
            setNewMovieIds([]);
            setMovieSearch("");
            setDraftFormKey((current) => current + 1);
          }}
          className={`${buttonClassName} w-full border-[rgba(223,197,106,0.42)] bg-[rgba(223,197,106,0.12)] text-[var(--color-accent)] hover:bg-[rgba(223,197,106,0.2)] ${
            isCreatingCampaign ? "ring-1 ring-[var(--color-accent)]" : ""
          }`}
        >
          <Plus className="h-4 w-4" />
          New campaign
        </button>
        <Panel title="Campaigns" eyebrow={`${campaigns.length} total`}>
          <div className="max-h-[18rem] space-y-2 overflow-y-auto pr-1 sm:max-h-[28rem]">
            {campaigns.map((campaign) => (
              <button
                key={campaign.id}
                type="button"
                onClick={() => {
                  setIsCreatingCampaign(false);
                  setSelectedCampaignId(campaign.id);
                }}
                className={`w-full border p-3 text-left transition-colors ${
                  !isCreatingCampaign && selectedCampaignId === campaign.id
                    ? "border-[rgba(223,197,106,0.42)] bg-[rgba(223,197,106,0.09)]"
                    : "border-[rgba(223,197,106,0.14)] bg-[rgba(255,255,255,0.025)] hover:border-[rgba(223,197,106,0.28)]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{campaign.title}</p>
                    <p className="mt-1 truncate text-xs text-[var(--color-text-dim)]">
                      {campaign.hall_name} · {formatDateTime(campaign.slot_starts_at)}
                    </p>
                  </div>
                  <StatusBadge status={campaign.status} />
                </div>
              </button>
            ))}
            {campaigns.length === 0 ? <EmptyState text="No campaigns yet." /> : null}
          </div>
        </Panel>
      </aside>

      <div
        className={cn(
          "min-w-0 space-y-4",
          !isCampaignDetailOpen ? "hidden lg:block" : "",
        )}
      >
        <MobileWorkspaceBackButton
          label="Campaigns"
          onClick={() => {
            setIsCreatingCampaign(false);
            setSelectedCampaignId(null);
            setNewMovieIds([]);
            setMovieSearch("");
          }}
        />
        <Panel
          title={panelTitle}
          eyebrow={status ? undefined : "select or create"}
          headerExtra={
            <div className="flex flex-wrap items-center gap-2">
              {status ? <StatusBadge status={status} /> : null}
              {activeCampaign?.status === "draft" ? (
                <PrimaryButton
                  type="button"
                  disabled={campaignMutation.isPending || selectedMovieIds.length === 0}
                  onClick={() =>
                    campaignMutation.mutate({ action: "publish", campaignId: activeCampaign.id })
                  }
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Publish
                </PrimaryButton>
              ) : null}
              {activeCampaign?.status === "voting" ? (
                <PrimaryButton
                  type="button"
                  disabled={campaignMutation.isPending}
                  onClick={async () => {
                    if (
                      await confirm({
                        title: "Resolve campaign?",
                        message:
                          "Resolve this campaign and create the winning screening? This action cannot be undone.",
                        confirmLabel: "Resolve",
                      })
                    ) {
                      campaignMutation.mutate({ action: "resolve", campaignId: activeCampaign.id });
                    }
                  }}
                >
                  <BadgeCheck className="h-4 w-4" />
                  Resolve
                </PrimaryButton>
              ) : null}
              {activeCampaign?.status === "draft" || activeCampaign?.status === "voting" ? (
                <DangerButton
                  type="button"
                  disabled={campaignMutation.isPending}
                  onClick={async () => {
                    if (
                      await confirm({
                        title: "Cancel campaign?",
                        message: "Cancel this campaign? Voting and checkout for it will stop.",
                        confirmLabel: "Cancel campaign",
                      })
                    ) {
                      campaignMutation.mutate({ action: "cancel", campaignId: activeCampaign.id });
                    }
                  }}
                >
                  <XCircle className="h-4 w-4" />
                  Cancel
                </DangerButton>
              ) : null}
              <PrimaryButton
                type="submit"
                form="campaign-form"
                disabled={campaignMutation.isPending || !isDraft}
              >
                {isNewCampaign ? "Save draft" : "Save changes"}
              </PrimaryButton>
            </div>
          }
        >
          <form
            id="campaign-form"
            key={activeCampaign?.id ?? `new-campaign-${draftFormKey}`}
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              if (isNewCampaign) {
                campaignMutation.mutate({
                  action: "create-with-movies",
                  payload: {
                    campaign: readCampaignForm(formData),
                    movieIds: newMovieIds,
                  },
                });
                setNewMovieIds([]);
                setMovieSearch("");
                return;
              }
              if (activeCampaign) {
                campaignMutation.mutate({
                  action: "update",
                  campaignId: activeCampaign.id,
                  payload: readCampaignForm(formData),
                });
              }
            }}
          >
            <div className="grid min-w-0 gap-3 md:grid-cols-[1.4fr_1fr_0.9fr]">
              <LabeledField label="Title">
                <input name="title" className={inputClassName} defaultValue={activeCampaign?.title ?? ""} placeholder="Spring cult classics" required disabled={!isDraft} />
              </LabeledField>
              <LabeledField label="Location">
                <select name="location_id" className={inputClassName} value={effectiveLocationId} onChange={(event) => setLocationId(event.target.value)} disabled={!isDraft}>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {formatLocationLabel(location)}
                    </option>
                  ))}
                </select>
              </LabeledField>
              <LabeledField label="Hall">
                <select
                  key={`${activeCampaign?.id ?? "new"}-${effectiveLocationId}`}
                  name="hall_id"
                  className={inputClassName}
                  defaultValue={defaultHallId}
                  disabled={!isDraft}
                  required
                >
                  <option value="">Select hall</option>
                  {filteredHalls.map((hall) => (
                    <option key={hall.id} value={hall.id}>
                      {hall.name} ({hall.capacity})
                    </option>
                  ))}
                </select>
              </LabeledField>
            </div>

            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabeledField label="Slot starts">
                <input name="slot_starts_at" type="datetime-local" className={inputClassName} defaultValue={activeCampaign ? toLocalDateTimeValue(activeCampaign.slot_starts_at) : ""} disabled={!isDraft} required />
              </LabeledField>
              <LabeledField label="Slot ends">
                <input name="slot_ends_at" type="datetime-local" className={inputClassName} defaultValue={activeCampaign ? toLocalDateTimeValue(activeCampaign.slot_ends_at) : ""} disabled={!isDraft} required />
              </LabeledField>
              <LabeledField label="Minimum tickets">
                <input name="min_tickets_to_confirm" type="number" min={1} className={inputClassName} defaultValue={activeCampaign?.min_tickets_to_confirm ?? ""} disabled={!isDraft} required />
              </LabeledField>
              <LabeledField label="Ticket price (EUR)">
                <input name="ticket_price_eur" type="number" min={0} step="0.01" className={inputClassName} defaultValue={activeCampaign ? (activeCampaign.ticket_price_cents / 100).toFixed(2) : ""} disabled={!isDraft} required />
              </LabeledField>
            </div>

            <LabeledField label="Short description">
              <textarea name="description" className={`${inputClassName} min-h-16`} defaultValue={activeCampaign?.description ?? ""} placeholder="Short campaign note" disabled={!isDraft} />
            </LabeledField>

            <details
              className="border border-[rgba(223,197,106,0.14)] bg-[rgba(255,255,255,0.02)] px-3 py-2"
              open={showAdvancedOpenByDefault}
            >
              <summary className="cursor-pointer select-none text-[11px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
                Advanced settings
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <LabeledField label="Max tickets">
                  <input name="max_tickets" type="number" min={1} className={inputClassName} defaultValue={activeCampaign?.max_tickets ?? ""} disabled={!isDraft} />
                </LabeledField>
                <LabeledField label="Voting days">
                  <input name="voting_duration_days" type="number" min={1} defaultValue={activeCampaign?.voting_duration_days ?? 7} className={inputClassName} disabled={!isDraft} />
                </LabeledField>
                <LabeledField label="Decision days">
                  <input name="decision_days_before_screening" type="number" min={0} defaultValue={activeCampaign?.decision_days_before_screening ?? 7} className={inputClassName} disabled={!isDraft} />
                </LabeledField>
              </div>
            </details>

            <MoviePicker
              movies={movieOptions}
              selectedMovieIds={selectedMovieIds}
              selectedCampaign={activeCampaign}
              search={movieSearch}
              setSearch={setMovieSearch}
              onAdd={handleAddMovie}
              onRemove={handleRemoveMovie}
              disabled={!isDraft || campaignMutation.isPending}
              cinemaId={cinemaId}
              token={token}
            />
          </form>
        </Panel>

        {!isNewCampaign && activeCampaign ? (
          <Panel title="Campaign screenings" eyebrow="confirm below threshold">
            <div className="space-y-3">
              {campaignScreenings.map((screening) => (
                <ScreeningRow
                  key={screening.id}
                  screening={screening}
                  screeningMutation={screeningMutation}
                />
              ))}
              {campaignScreenings.length === 0 ? <EmptyState text="Screenings will appear after a campaign resolves." /> : null}
            </div>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 70
      ? "bg-green-500/20 text-green-400 border border-green-500/30"
      : score >= 40
        ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
        : "bg-red-500/20 text-red-400 border border-red-500/30";
  return (
    <span className={`px-1.5 py-0.5 text-[9px] font-semibold ${cls}`}>
      {score}
    </span>
  );
}

function MoviePicker({
  movies,
  selectedMovieIds,
  selectedCampaign,
  search,
  setSearch,
  onAdd,
  onRemove,
  disabled,
  cinemaId,
  token,
}: {
  movies: MovieRead[];
  selectedMovieIds: string[];
  selectedCampaign: CampaignDetailRead | null;
  search: string;
  setSearch: (value: string) => void;
  onAdd: (movieId: string) => void;
  onRemove: (movieId: string) => void;
  disabled: boolean;
  cinemaId: string | undefined;
  token: string | null;
}) {
  const queryClient = useQueryClient();
  const [syncingTmdbId, setSyncingTmdbId] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const recsQuery = useQuery({
    queryKey: ["admin", "cinema", cinemaId, "recommendations"],
    enabled: Boolean(cinemaId && token),
    queryFn: () => getCinemaRecommendations(cinemaId as string, token as string),
    staleTime: 5 * 60 * 1000,
  });
  const selectedSet = new Set(selectedMovieIds);
  const selectedMovies = selectedMovieIds.map((movieId) => {
    const catalogMovie = movies.find((movie) => movie.id === movieId);
    const campaignMovie = selectedCampaign?.movies.find((movie) => movie.movie_id === movieId);
    return {
      id: movieId,
      title: catalogMovie?.title ?? campaignMovie?.movie_title ?? "Selected movie",
      release_year: catalogMovie?.release_year ?? campaignMovie?.movie_release_year ?? null,
      vote_count: campaignMovie?.vote_count,
      ticket_count: campaignMovie?.ticket_count,
    };
  });
  const filteredMovies = movies
    .filter((movie) => !selectedSet.has(movie.id))
    .filter((movie) => {
      const normalizedSearch = search.trim().toLowerCase();
      if (!normalizedSearch) {
        return true;
      }
      return movie.title.toLowerCase().includes(normalizedSearch);
    })
    .slice(0, 10);

  async function handleRecommendationAdd(film: FilmScoreRead, catalogMovieId: string | null) {
    if (disabled) {
      return;
    }
    setSyncError(null);
    if (catalogMovieId) {
      onAdd(catalogMovieId);
      return;
    }
    if (!token) {
      setSyncError("Sign in again to import TMDB recommendations.");
      return;
    }
    setSyncingTmdbId(film.tmdb_id);
    try {
      const syncedMovie = await syncTmdbMovie(film.tmdb_id, token);
      queryClient.setQueryData<MovieRead[]>(["movies", "catalog"], (current = []) => {
        if (current.some((movie) => movie.id === syncedMovie.id)) {
          return current;
        }
        return [syncedMovie, ...current];
      });
      onAdd(syncedMovie.id);
      void queryClient.invalidateQueries({ queryKey: ["movies", "catalog"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "cinema", cinemaId, "recommendations"] });
    } catch (error) {
      setSyncError(error instanceof ApiError ? error.message : "Could not import that TMDB movie.");
    } finally {
      setSyncingTmdbId(null);
    }
  }

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-3">
        <div className="border border-[rgba(223,197,106,0.12)] bg-[rgba(255,255,255,0.025)] p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-accent)]">Recommended</p>
          {recsQuery.isLoading ? (
            <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-text-dim)]">
              <LoaderCircle className="h-3 w-3 animate-spin" />
              Loading recommendations…
            </div>
          ) : recsQuery.data && recsQuery.data.length > 0 ? (
            <div className="mt-3 space-y-2">
              {(recsQuery.data as FilmScoreRead[]).map((film) => {
                const catalogMovieId =
                  film.movie_id
                  ?? movies.find((m) => m.tmdb_id === film.tmdb_id)?.id
                  ?? movies.find((m) => m.title === film.title)?.id
                  ?? null;
                const alreadySelected = catalogMovieId ? selectedMovieIds.includes(catalogMovieId) : false;
                const isImporting = syncingTmdbId === film.tmdb_id;
                const needsImport = !catalogMovieId;
                return (
                  <button
                    key={film.tmdb_id}
                    type="button"
                    disabled={disabled || alreadySelected || isImporting || (needsImport && !token)}
                    onClick={() => {
                      void handleRecommendationAdd(film, catalogMovieId);
                    }}
                    title={film.reason}
                    className="flex w-full items-center gap-3 border border-[rgba(223,197,106,0.10)] bg-[rgba(19,26,39,0.5)] px-3 py-2 text-left text-sm text-white transition-colors hover:border-[rgba(223,197,106,0.28)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {film.poster_url ? (
                      <img
                        src={tmdbImageUrl(film.poster_url, "w185")}
                        alt={film.title}
                        loading="lazy"
                        decoding="async"
                        className="h-10 w-7 flex-shrink-0 object-cover"
                      />
                    ) : (
                      <div className="h-10 w-7 flex-shrink-0 bg-white/10" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-white">{film.title}</p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <ScoreBadge score={film.score} />
                        <span className="text-[9px] uppercase tracking-[0.15em] text-[var(--color-text-dim)]">
                          {film.confidence}
                        </span>
                      </div>
                    </div>
                    {isImporting ? (
                      <LoaderCircle className="h-3.5 w-3.5 flex-shrink-0 animate-spin text-[var(--color-accent)]" />
                    ) : alreadySelected ? null : catalogMovieId || needsImport ? (
                      <Plus className="h-3.5 w-3.5 flex-shrink-0 text-[var(--color-accent)]" />
                    ) : null}
                  </button>
                );
              })}
              {syncError ? (
                <p className="text-xs text-red-300">{syncError}</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-sm text-[var(--color-text-dim)]">
              No automated recommendations yet.
            </p>
          )}
        </div>
        <div className="border border-[rgba(223,197,106,0.12)] bg-[rgba(255,255,255,0.025)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Search className="h-4 w-4 text-[var(--color-accent)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={inputClassName}
              placeholder="Pick custom movies from catalog"
              disabled={disabled}
            />
          </div>
          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {filteredMovies.map((movie) => (
              <button
                key={movie.id}
                type="button"
                disabled={disabled}
                onClick={() => onAdd(movie.id)}
                className="flex w-full items-center justify-between gap-3 border border-[rgba(223,197,106,0.10)] bg-[rgba(19,26,39,0.5)] px-3 py-2 text-left text-sm text-white transition-colors hover:border-[rgba(223,197,106,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="min-w-0 break-words">{formatMovieLabel(movie.title, movie.release_year)}</span>
                <Plus className="h-4 w-4 text-[var(--color-accent)]" />
              </button>
            ))}
            {filteredMovies.length === 0 ? <EmptyState text="No catalog movies match this search." /> : null}
          </div>
        </div>
      </div>

      <div className="border border-[rgba(223,197,106,0.12)] bg-[rgba(255,255,255,0.025)] p-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-accent)]">
          Selected movies
        </p>
        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
          {selectedMovies.map((movie, index) => (
            <div key={movie.id} className="flex flex-col gap-3 border border-[rgba(223,197,106,0.10)] bg-[rgba(19,26,39,0.5)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">
                  {index + 1}. {formatMovieLabel(movie.title, movie.release_year)}
                </p>
                {movie.vote_count !== undefined ? (
                  <p className="mt-1 text-xs text-[var(--color-text-dim)]">
                    {movie.vote_count} votes · {movie.ticket_count ?? 0} early tickets
                  </p>
                ) : null}
              </div>
              <DangerButton type="button" disabled={disabled} onClick={() => onRemove(movie.id)}>
                Remove
              </DangerButton>
            </div>
          ))}
          {selectedMovies.length === 0 ? <EmptyState text="No movies selected yet." /> : null}
        </div>
      </div>
    </div>
  );
}

function ValidatorsTab({
  validators,
  validatorMutation,
}: {
  validators: Array<{ validator_user_id: string; display_name: string | null; email: string | null; is_active: boolean }>;
  validatorMutation: LooseMutation<ValidatorMutationVariables>;
}) {
  const confirm = useConfirmDialog();

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:gap-6">
      <Panel title="Grant validator access" eyebrow="create validator account">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            validatorMutation.mutate({
              action: "create",
              payload: {
                email: readRequiredString(formData, "email"),
                password: readRequiredString(formData, "password"),
                display_name: readOptionalString(formData, "display_name"),
              },
            });
            event.currentTarget.reset();
          }}
        >
          <LabeledField label="Email">
            <input name="email" type="email" className={inputClassName} required />
          </LabeledField>
          <LabeledField label="Password">
            <input name="password" type="password" minLength={8} className={inputClassName} required />
          </LabeledField>
          <LabeledField label="Display name">
            <input name="display_name" className={inputClassName} />
          </LabeledField>
          <PrimaryButton type="submit" disabled={validatorMutation.isPending}>
            <ShieldCheck className="h-4 w-4" />
            Grant access
          </PrimaryButton>
        </form>
      </Panel>

      <Panel title="Validators" eyebrow={`${validators.length} accounts`}>
        <div className="space-y-3">
          {validators.map((validator) => (
            <div key={validator.validator_user_id} className="flex flex-col gap-3 border border-[rgba(223,197,106,0.12)] bg-[rgba(255,255,255,0.025)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="break-words font-medium text-white">{validator.display_name ?? validator.email ?? "Validator"}</p>
                <p className="mt-1 break-all text-xs text-[var(--color-text-dim)]">{validator.email ?? validator.validator_user_id}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={validator.is_active ? "active" : "revoked"} />
                {validator.is_active ? (
                  <DangerButton
                    type="button"
                    disabled={validatorMutation.isPending}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: "Revoke access?",
                          message: "Revoke this validator's access?",
                          confirmLabel: "Revoke",
                        })
                      ) {
                        validatorMutation.mutate({
                          action: "revoke",
                          validatorUserId: validator.validator_user_id,
                        });
                      }
                    }}
                  >
                    Revoke
                  </DangerButton>
                ) : null}
              </div>
            </div>
          ))}
          {validators.length === 0 ? <EmptyState text="No validator permissions yet." /> : null}
        </div>
      </Panel>
    </div>
  );
}

function CinemaProfileTab({
  cinema,
  cinemaMutation,
  cinemaLogoMutation,
}: {
  cinema: CinemaRead | null;
  cinemaMutation: LooseMutation<CinemaUpdate>;
  cinemaLogoMutation: LooseMutation<File>;
}) {
  if (!cinema) {
    return <EmptyState text="Cinema profile is loading." />;
  }

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[1fr_0.7fr] lg:gap-6">
      <Panel title="Cinema information" eyebrow="public profile">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            cinemaMutation.mutate({
              name: readRequiredString(formData, "name"),
              description: readOptionalString(formData, "description"),
              website: readOptionalString(formData, "website"),
              email: readOptionalString(formData, "email"),
              phone: readOptionalString(formData, "phone"),
              is_active: formData.get("is_active") === "on",
            });
          }}
        >
          <LabeledField label="Name">
            <input name="name" className={inputClassName} defaultValue={cinema.name} required />
          </LabeledField>
          <LabeledField label="Description">
            <textarea name="description" className={`${inputClassName} min-h-32`} defaultValue={cinema.description ?? ""} />
          </LabeledField>
          <div className="grid gap-4 sm:grid-cols-2">
            <LabeledField label="Website">
              <input name="website" className={inputClassName} defaultValue={cinema.website ?? ""} />
            </LabeledField>
            <LabeledField label="Email">
              <input name="email" type="email" className={inputClassName} defaultValue={cinema.email ?? ""} />
            </LabeledField>
            <LabeledField label="Phone">
              <input name="phone" className={inputClassName} defaultValue={cinema.phone ?? ""} />
            </LabeledField>
            <label className="flex items-center gap-3 pt-8 text-sm text-[var(--color-text-muted)]">
              <input name="is_active" type="checkbox" defaultChecked={cinema.is_active} className="h-4 w-4 accent-[var(--color-accent)]" />
              Active cinema
            </label>
          </div>
          <PrimaryButton type="submit" disabled={cinemaMutation.isPending}>
            Save profile
          </PrimaryButton>
        </form>
      </Panel>

      <Panel title="Logo" eyebrow="brand mark">
        {cinema.logo_url ? (
          <img src={cinema.logo_url} alt={`${cinema.name} logo`} loading="lazy" decoding="async" className="mb-4 max-h-32 max-w-full border border-[rgba(223,197,106,0.14)] bg-[rgba(255,255,255,0.04)] p-4" />
        ) : (
          <EmptyState text="No logo uploaded yet." />
        )}
        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const fileInput = event.currentTarget.elements.namedItem("logo") as HTMLInputElement | null;
            const file = fileInput?.files?.[0];
            if (file) {
              cinemaLogoMutation.mutate(file);
              event.currentTarget.reset();
            }
          }}
        >
          <input name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className={inputClassName} required />
          <SecondaryButton type="submit" disabled={cinemaLogoMutation.isPending}>
            <Upload className="h-4 w-4" />
            Upload logo
          </SecondaryButton>
        </form>
      </Panel>
    </div>
  );
}

function LocationsTab({
  locations,
  hallsByLocation,
  locationMutation,
  hallMutation,
}: {
  locations: CinemaLocationRead[];
  hallsByLocation: Map<string, CinemaHallRead[]>;
  locationMutation: LooseMutation<LocationMutationVariables>;
  hallMutation: LooseMutation<HallMutationVariables>;
}) {
  const confirm = useConfirmDialog();

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:gap-6">
      <Panel title="Add location" eyebrow="cinema footprint">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            locationMutation.mutate({
              action: "create",
              payload: readLocationForm(formData),
            });
            event.currentTarget.reset();
          }}
        >
          <LocationFields />
          <PrimaryButton type="submit" disabled={locationMutation.isPending}>
            <Plus className="h-4 w-4" />
            Add location
          </PrimaryButton>
        </form>
      </Panel>

      <Panel title="Locations & halls" eyebrow={`${locations.length} locations`}>
        <div className="space-y-5">
          {locations.map((location) => (
            <div key={location.id} className="border border-[rgba(223,197,106,0.14)] bg-[rgba(255,255,255,0.025)] p-4">
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  locationMutation.mutate({
                    action: "update",
                    locationId: location.id,
                    payload: readLocationForm(new FormData(event.currentTarget)),
                  });
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{formatLocationLabel(location)}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-dim)]">{location.address_line1 ?? "No address"}</p>
                  </div>
                  <DangerButton
                    type="button"
                    disabled={locationMutation.isPending}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: "Delete location?",
                          message:
                            "Delete this location? Any halls attached to it may also be affected.",
                          confirmLabel: "Delete",
                        })
                      ) {
                        locationMutation.mutate({ action: "delete", locationId: location.id });
                      }
                    }}
                  >
                    Delete
                  </DangerButton>
                </div>
                <LocationFields location={location} />
                <SecondaryButton type="submit" disabled={locationMutation.isPending}>
                  Save location
                </SecondaryButton>
              </form>

              <div className="mt-5 border-t border-[rgba(223,197,106,0.12)] pt-5">
                <form
                  className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto]"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    hallMutation.mutate({
                      action: "create",
                      locationId: location.id,
                      payload: {
                        name: readRequiredString(formData, "name"),
                        capacity: readRequiredNumber(formData, "capacity"),
                        allow_private_booking: formData.get("allow_private_booking") === "on",
                      },
                    });
                    event.currentTarget.reset();
                  }}
                >
                  <input name="name" className={inputClassName} placeholder="Hall name" required />
                  <input name="capacity" type="number" min={1} className={inputClassName} placeholder="Seats" required />
                  <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                    <input name="allow_private_booking" type="checkbox" defaultChecked className="h-4 w-4 accent-[var(--color-accent)]" />
                    Private
                  </label>
                  <PrimaryButton type="submit" disabled={hallMutation.isPending}>
                    Add hall
                  </PrimaryButton>
                </form>

                <div className="mt-4 space-y-3">
                  {(hallsByLocation.get(location.id) ?? []).map((hall) => (
                    <form
                      key={hall.id}
                      className="grid min-w-0 gap-3 border border-[rgba(223,197,106,0.10)] bg-[rgba(19,26,39,0.5)] p-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto_auto]"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const formData = new FormData(event.currentTarget);
                        hallMutation.mutate({
                          action: "update",
                          locationId: location.id,
                          hallId: hall.id,
                          payload: {
                            name: readRequiredString(formData, "name"),
                            capacity: readRequiredNumber(formData, "capacity"),
                            allow_private_booking: formData.get("allow_private_booking") === "on",
                          },
                        });
                      }}
                    >
                      <input name="name" className={inputClassName} defaultValue={hall.name} required />
                      <input name="capacity" type="number" min={1} className={inputClassName} defaultValue={hall.capacity} required />
                      <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                        <input name="allow_private_booking" type="checkbox" defaultChecked={hall.allow_private_booking} className="h-4 w-4 accent-[var(--color-accent)]" />
                        Private
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <SecondaryButton type="submit" disabled={hallMutation.isPending}>
                          Save
                        </SecondaryButton>
                        <DangerButton
                          type="button"
                          disabled={hallMutation.isPending}
                          onClick={async () => {
                            if (
                              await confirm({
                                title: "Delete hall?",
                                message: "Delete this hall?",
                                confirmLabel: "Delete",
                              })
                            ) {
                              hallMutation.mutate({
                                action: "delete",
                                locationId: location.id,
                                hallId: hall.id,
                              });
                            }
                          }}
                        >
                          Delete
                        </DangerButton>
                      </div>
                    </form>
                  ))}
                  {(hallsByLocation.get(location.id) ?? []).length === 0 ? <EmptyState text="No halls at this location yet." /> : null}
                </div>
              </div>
            </div>
          ))}
          {locations.length === 0 ? <EmptyState text="No cinema locations yet." /> : null}
        </div>
      </Panel>
    </div>
  );
}

function BookingsTab({
  bookings,
  selectedBooking,
  selectedBookingId,
  setSelectedBookingId,
  locations,
  hallsByLocation,
  bookingMutation,
  newRequestCount,
}: {
  bookings: PrivateBookingRead[];
  selectedBooking: PrivateBookingRead | null;
  selectedBookingId: string | null;
  setSelectedBookingId: (id: string | null) => void;
  locations: CinemaLocationRead[];
  hallsByLocation: Map<string, CinemaHallRead[]>;
  bookingMutation: LooseMutation<BookingMutationVariables>;
  newRequestCount: number;
}) {
  const confirm = useConfirmDialog();
  const offerableLocations = useMemo(
    () =>
      locations.filter((location) =>
        (hallsByLocation.get(location.id) ?? []).some((hall) => hall.allow_private_booking),
      ),
    [locations, hallsByLocation],
  );
  const fallbackLocationId = offerableLocations[0]?.id ?? "";
  const preferredLocationId = selectedBooking?.preferred_location_id ?? fallbackLocationId;
  const [offeredLocationId, setOfferedLocationId] = useState(preferredLocationId);
  const [reviewMode, setReviewMode] = useState<BookingReviewMode>("offer");
  const hallsForPreferredLocation = (hallsByLocation.get(offeredLocationId) ?? []).filter(
    (hall) => hall.allow_private_booking,
  );
  const canReview = selectedBooking?.status === "submitted" || selectedBooking?.status === "in_review";
  const canCancel =
    selectedBooking?.status === "offered" ||
    selectedBooking?.status === "accepted" ||
    selectedBooking?.status === "paid";

  useEffect(() => {
    const nextLocationId = offerableLocations.some((location) => location.id === preferredLocationId)
      ? preferredLocationId
      : fallbackLocationId;
    setOfferedLocationId(nextLocationId);
    setReviewMode("offer");
  }, [preferredLocationId, selectedBooking?.id, fallbackLocationId, offerableLocations]);
  const isBookingDetailOpen = Boolean(selectedBookingId);

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[0.76fr_1.24fr] lg:gap-6">
      <div className={cn(isBookingDetailOpen ? "hidden lg:block" : "")}>
      <Panel
        title="Private booking requests"
        eyebrow={
          newRequestCount > 0
            ? `${bookings.length} total / ${newRequestCount} new`
            : `${bookings.length} total`
        }
      >
        {newRequestCount > 0 ? (
          <div className="mb-4 border border-[rgba(223,197,106,0.28)] bg-[rgba(223,197,106,0.08)] p-4">
            <div className="flex items-start gap-3">
              <BadgeCheck className="mt-0.5 h-5 w-5 text-[var(--color-accent)]" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
                  New private booking requests need review
                </p>
                <p className="mt-2 text-sm leading-6 text-white/90">
                  {newRequestCount} submitted request{newRequestCount === 1 ? "" : "s"} waiting for an offer or rejection.
                </p>
              </div>
            </div>
          </div>
        ) : null}
        <div className="max-h-[22rem] space-y-3 overflow-y-auto pr-1 sm:max-h-[680px]">
          {bookings.map((booking) => {
            const isNewRequest = booking.status === "submitted";

            return (
            <button
              key={booking.id}
              type="button"
              onClick={() => setSelectedBookingId(booking.id)}
              className={`w-full border p-4 text-left transition-colors ${
                selectedBookingId === booking.id
                  ? "border-[rgba(223,197,106,0.42)] bg-[rgba(223,197,106,0.09)]"
                  : isNewRequest
                    ? "border-[rgba(223,197,106,0.34)] bg-[rgba(223,197,106,0.07)] hover:border-[rgba(223,197,106,0.46)]"
                    : "border-[rgba(223,197,106,0.14)] bg-[rgba(255,255,255,0.025)] hover:border-[rgba(223,197,106,0.28)]"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {isNewRequest ? (
                      <span className="border border-[rgba(223,197,106,0.32)] bg-[rgba(223,197,106,0.12)] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
                        New
                      </span>
                    ) : null}
                    <p className="break-words font-medium text-white">
                    {formatEventType(booking.event_type)} · {booking.group_size} guests
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-dim)]">
                    {booking.preferred_start_at ? formatDateTime(booking.preferred_start_at) : "Flexible timing"}
                  </p>
                </div>
                <StatusBadge status={booking.status} />
              </div>
              {isNewRequest ? (
                <p className="mt-3 text-xs leading-5 text-[var(--color-accent)]">
                  Newly arrived request. Send an offer or reject it from the review panel.
                </p>
              ) : null}
              {booking.cinema_response_message ? (
                <p className="mt-3 line-clamp-2 text-xs leading-5 text-[var(--color-text-muted)]">
                  {booking.cinema_response_message}
                </p>
              ) : null}
              </button>
            );
          })}
          {bookings.length === 0 ? <EmptyState text="No private booking requests yet." /> : null}
        </div>
      </Panel>
      </div>

      <div className={cn(!isBookingDetailOpen ? "hidden lg:block" : "")}>
      <MobileWorkspaceBackButton
        label="Requests"
        onClick={() => setSelectedBookingId(null)}
      />
      <Panel title="Respond to request" eyebrow="send offer or rejection">
        {selectedBooking ? (
          <div className="space-y-5">
            <div className="grid min-w-0 gap-4 border border-[rgba(223,197,106,0.12)] bg-[rgba(255,255,255,0.025)] p-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="break-words text-lg font-semibold text-white">
                    {formatEventType(selectedBooking.event_type)} · {selectedBooking.group_size} guests
                  </p>
                  <StatusBadge status={selectedBooking.status} />
                </div>
                <div className="mt-4 grid gap-3 text-sm text-[var(--color-text-muted)] sm:grid-cols-2">
                  <SummaryItem label="Event type" value={formatEventType(selectedBooking.event_type)} />
                  <SummaryItem label="Requested start" value={selectedBooking.preferred_start_at ? formatDateTime(selectedBooking.preferred_start_at) : "Flexible"} />
                  <SummaryItem label="Requested end" value={selectedBooking.preferred_end_at ? formatDateTime(selectedBooking.preferred_end_at) : "Flexible"} />
                  <SummaryItem label="Created" value={formatDateTime(selectedBooking.created_at)} />
                  <SummaryItem label="Reference" value={selectedBooking.id.slice(0, 8)} />
                </div>
                {selectedBooking.notes ? (
                  <p className="mt-4 text-sm leading-6 text-[var(--color-text-muted)]">{selectedBooking.notes}</p>
                ) : null}
              </div>
              <div className="min-w-0 border border-[rgba(223,197,106,0.12)] bg-[rgba(19,26,39,0.5)] p-3 md:min-w-44">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-dim)]">
                  Current offer
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {selectedBooking.quoted_price_cents !== null
                    ? formatMoney(selectedBooking.quoted_price_cents, selectedBooking.currency)
                    : "No offer"}
                </p>
                {selectedBooking.offered_start_at ? (
                  <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">
                    {formatDateTime(selectedBooking.offered_start_at)}
                  </p>
                ) : null}
              </div>
            </div>

            {canReview ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setReviewMode("offer")}
                  className={`${buttonClassName} ${
                    reviewMode === "offer"
                      ? "border-[rgba(223,197,106,0.44)] bg-[rgba(223,197,106,0.12)] text-[var(--color-accent)]"
                      : "border-[rgba(223,197,106,0.18)] text-[var(--color-text-dim)] hover:border-[rgba(223,197,106,0.32)] hover:text-white"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Send offer
                </button>
                <button
                  type="button"
                  onClick={() => setReviewMode("reject")}
                  className={`${buttonClassName} ${
                    reviewMode === "reject"
                      ? "border-red-400/40 bg-red-400/10 text-red-100"
                      : "border-[rgba(223,197,106,0.18)] text-[var(--color-text-dim)] hover:border-red-400/30 hover:text-red-100"
                  }`}
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
              </div>
            ) : null}

            {canReview && reviewMode === "offer" ? (
              <form
                className="space-y-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (
                    !(await confirm({
                      title: "Reject request?",
                      message: "Reject this private booking request?",
                      confirmLabel: "Reject",
                    }))
                  ) {
                    return;
                  }
                  const formData = new FormData(event.currentTarget);
                  bookingMutation.mutate({
                    action: "review",
                    bookingId: selectedBooking.id,
                    payload: {
                      status: "offered",
                      offered_location_id: readRequiredString(formData, "offered_location_id"),
                      offered_hall_id: readRequiredString(formData, "offered_hall_id"),
                      offered_start_at: toIsoFromLocal(readRequiredString(formData, "offered_start_at")),
                      offered_end_at: toIsoFromLocal(readRequiredString(formData, "offered_end_at")),
                      quoted_price_cents: eurosToCents(readRequiredNumber(formData, "quoted_price_eur")),
                      cinema_response_message: readOptionalString(formData, "cinema_response_message"),
                    },
                  });
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <LabeledField label="Offer location">
                    <select
                      name="offered_location_id"
                      className={inputClassName}
                      value={offeredLocationId}
                      onChange={(event) => setOfferedLocationId(event.target.value)}
                      disabled={offerableLocations.length === 0}
                      required
                    >
                      <option value="">Select location</option>
                      {offerableLocations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {formatLocationLabel(location)}
                        </option>
                      ))}
                    </select>
                  </LabeledField>
                  <LabeledField label="Offer hall">
                    <select
                      name="offered_hall_id"
                      className={inputClassName}
                      key={offeredLocationId}
                      defaultValue={hallsForPreferredLocation[0]?.id ?? ""}
                      disabled={hallsForPreferredLocation.length === 0}
                      required
                    >
                      <option value="">Select hall</option>
                      {hallsForPreferredLocation.map((hall) => (
                        <option key={hall.id} value={hall.id}>
                          {hall.name} · {hall.capacity} seats
                        </option>
                      ))}
                    </select>
                  </LabeledField>
                  <LabeledField label="Starts">
                    <input name="offered_start_at" type="datetime-local" className={inputClassName} required />
                  </LabeledField>
                  <LabeledField label="Ends">
                    <input name="offered_end_at" type="datetime-local" className={inputClassName} required />
                  </LabeledField>
                  <LabeledField label="Quoted price (EUR)">
                    <input name="quoted_price_eur" type="number" min={0.01} step="0.01" className={inputClassName} required />
                  </LabeledField>
                </div>
                <LabeledField label="Message to user">
                  <textarea
                    name="cinema_response_message"
                    className={`${inputClassName} min-h-24`}
                    placeholder="Share what is included in the offer or any arrival instructions."
                  />
                </LabeledField>
                {offerableLocations.length === 0 ? (
                  <p className="text-sm text-amber-100">
                    This cinema currently has no halls enabled for private booking.
                  </p>
                ) : null}
                {offerableLocations.length > 0 && hallsForPreferredLocation.length === 0 ? (
                  <p className="text-sm text-amber-100">
                    Select a location with at least one hall enabled for private booking.
                  </p>
                ) : null}
                <PrimaryButton
                  type="submit"
                  disabled={bookingMutation.isPending || hallsForPreferredLocation.length === 0}
                >
                  Send offer email
                </PrimaryButton>
              </form>
            ) : null}

            {canReview && reviewMode === "reject" ? (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const formData = new FormData(event.currentTarget);
                  bookingMutation.mutate({
                    action: "review",
                    bookingId: selectedBooking.id,
                    payload: {
                      status: "rejected",
                      cinema_response_message: readOptionalString(formData, "cinema_response_message"),
                    },
                  });
                }}
              >
                <LabeledField label="Rejection response">
                  <textarea
                    name="cinema_response_message"
                    className={`${inputClassName} min-h-28`}
                    placeholder="Let the requester know why this private screening cannot be hosted."
                  />
                </LabeledField>
                <DangerButton type="submit" disabled={bookingMutation.isPending}>
                  Send rejection email
                </DangerButton>
              </form>
            ) : null}

            {!canReview ? (
              <div className="space-y-4 border border-[rgba(223,197,106,0.12)] bg-[rgba(255,255,255,0.025)] p-4">
                <div>
                  <p className="text-sm font-semibold text-white">Response already sent</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
                    This request is {selectedBooking.status}. Review details are read-only from here.
                  </p>
                </div>
                {selectedBooking.cinema_response_message ? (
                  <p className="text-sm leading-6 text-[var(--color-text-muted)]">
                    {selectedBooking.cinema_response_message}
                  </p>
                ) : null}
                {canCancel ? (
                  <SecondaryButton
                    type="button"
                    disabled={bookingMutation.isPending}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: "Cancel booking?",
                          message: "Cancel this private booking?",
                          confirmLabel: "Cancel booking",
                        })
                      ) {
                        bookingMutation.mutate({
                          action: "cancel",
                          bookingId: selectedBooking.id,
                          reason: "cancelled_by_cinema",
                        });
                      }
                    }}
                  >
                    Cancel booking
                  </SecondaryButton>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyState text="Select a request to review it." />
        )}
      </Panel>
      </div>
    </div>
  );
}

function ScreeningRow({
  screening,
  screeningMutation,
}: {
  screening: ScreeningRead;
  screeningMutation: LooseMutation<ScreeningMutationVariables>;
}) {
  const confirm = useConfirmDialog();

  return (
    <div className="flex flex-col gap-4 border border-[rgba(223,197,106,0.12)] bg-[rgba(255,255,255,0.025)] p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="break-words font-medium text-white">{formatMovieLabel(screening.movie_title, screening.movie_release_year)}</p>
          <StatusBadge status={screening.status} />
        </div>
        <p className="mt-2 text-xs text-[var(--color-text-dim)]">
          {screening.hall_name} · {formatDateTime(screening.starts_at)} · {screening.tickets_sold}/{screening.max_tickets} tickets
        </p>
        {screening.status === "pending" ? (
          <p className="mt-2 text-xs text-[var(--color-accent)]">
            Below threshold. Cinema admin can manually confirm this screening.
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {screening.status === "scheduled" ? (
          <SecondaryButton
            type="button"
            disabled={screeningMutation.isPending}
            onClick={() =>
              screeningMutation.mutate({
                action: "open-sales",
                screeningId: screening.id,
              })
            }
          >
            Open sales
          </SecondaryButton>
        ) : null}
        {screening.status === "selling" || screening.status === "pending" ? (
          <PrimaryButton
            type="button"
            disabled={screeningMutation.isPending}
            onClick={() =>
              screeningMutation.mutate({
                action: "confirm",
                screeningId: screening.id,
              })
            }
          >
            Confirm
          </PrimaryButton>
        ) : null}
        {screening.status !== "cancelled" && screening.status !== "confirmed" ? (
          <DangerButton
            type="button"
            disabled={screeningMutation.isPending}
            onClick={async () => {
              if (
                await confirm({
                  title: "Cancel screening?",
                  message: "Cancel this screening? Ticket handling may be affected.",
                  confirmLabel: "Cancel screening",
                })
              ) {
                screeningMutation.mutate({
                  action: "cancel",
                  screeningId: screening.id,
                  reason: "cancelled_by_cinema",
                });
              }
            }}
          >
            Cancel
          </DangerButton>
        ) : null}
      </div>
    </div>
  );
}

const TIMEZONES = [
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Zagreb",
  "Europe/Moscow",
];

function LocationFields({ location }: { location?: CinemaLocationRead }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <LabeledField label="Location name">
          <input name="location_name" className={inputClassName} defaultValue={location?.location_name ?? ""} />
        </LabeledField>
        <LabeledField label="Timezone">
          <select name="timezone" className={inputClassName} defaultValue={location?.timezone ?? "Europe/Zagreb"} required>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz} className="bg-[rgba(19,26,39,0.98)] text-white">
                {tz}
              </option>
            ))}
          </select>
        </LabeledField>
        <LabeledField label="Address line 1">
          <input name="address_line1" className={inputClassName} defaultValue={location?.address_line1 ?? ""} />
        </LabeledField>
        <LabeledField label="Address line 2">
          <input name="address_line2" className={inputClassName} defaultValue={location?.address_line2 ?? ""} />
        </LabeledField>
        <LabeledField label="Postal code">
          <input name="postal_code" className={inputClassName} defaultValue={location?.postal_code ?? ""} />
        </LabeledField>
        <LabeledField label="City">
          <input name="city_name" className={inputClassName} defaultValue={location?.city_name ?? ""} placeholder="Zagreb" />
        </LabeledField>
      </div>
      <label className="flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
        <input name="is_active" type="checkbox" defaultChecked={location?.is_active ?? true} className="h-4 w-4 accent-[var(--color-accent)]" />
        Active location
      </label>
    </>
  );
}

function MobileWorkspaceBackButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${buttonClassName} mb-3 border-[rgba(223,197,106,0.22)] text-[var(--color-text-muted)] hover:border-[rgba(223,197,106,0.36)] hover:text-white lg:hidden`}
    >
      <ArrowLeft className="h-4 w-4" />
      Back to {label}
    </button>
  );
}

function Panel({ title, eyebrow, headerExtra, children }: { title: string; eyebrow?: string; headerExtra?: ReactNode; children: ReactNode }) {
  return (
    <section className={`${panelClassName} min-w-0 p-4 sm:p-5`}>
      <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-accent)] sm:tracking-[0.24em]">{eyebrow}</p>
          ) : null}
          <h2 className={eyebrow ? "mt-2 break-words text-xl font-semibold text-white" : "break-words text-xl font-semibold text-white"}>{title}</h2>
        </div>
        {headerExtra ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{headerExtra}</div> : null}
      </div>
      {children}
    </section>
  );
}

function LabeledField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-dim)] sm:text-[11px] sm:tracking-[0.2em]">
        {label}
      </span>
      {children}
    </label>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-dim)] sm:tracking-[0.18em]">
        {label}
      </p>
      <p className="mt-1 break-words text-white">{value}</p>
    </div>
  );
}

function Metric({
  label,
  value,
  badge,
}: {
  label: string;
  value: number | string;
  badge?: string;
}) {
  return (
    <div className="min-w-0 border border-[rgba(223,197,106,0.16)] bg-[rgba(255,255,255,0.025)] px-3 py-3 sm:px-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-2xl font-semibold text-white">{value}</p>
        {badge ? (
          <span className="border border-[rgba(223,197,106,0.32)] bg-[rgba(223,197,106,0.12)] px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--color-accent)]">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-1 break-words text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-dim)] sm:tracking-[0.2em]">{label}</p>
    </div>
  );
}

function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`${buttonClassName} border-[rgba(223,197,106,0.42)] bg-[rgba(223,197,106,0.14)] text-[var(--color-accent)] hover:bg-[rgba(223,197,106,0.22)] hover:text-white ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`${buttonClassName} border-[rgba(223,197,106,0.22)] text-[var(--color-text-muted)] hover:border-[rgba(223,197,106,0.36)] hover:text-white ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

function DangerButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`${buttonClassName} border-red-400/25 text-red-100 hover:border-red-300/45 hover:bg-red-400/10 ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const className =
    normalized === "accepted" ||
    normalized === "active" ||
    normalized === "confirmed" ||
    normalized === "offered" ||
    normalized === "voting"
      ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
      : normalized === "rejected" || normalized === "cancelled" || normalized === "revoked"
        ? "border-red-300/25 bg-red-400/10 text-red-100"
        : "border-[rgba(223,197,106,0.22)] bg-[rgba(223,197,106,0.08)] text-[var(--color-accent)]";

  return (
    <span className={`inline-flex max-w-full items-center border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] sm:tracking-[0.18em] ${className}`}>
      {status}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="border border-dashed border-[rgba(223,197,106,0.16)] bg-[rgba(255,255,255,0.018)] p-5 text-sm text-[var(--color-text-dim)]">
      {text}
    </div>
  );
}

function readCampaignForm(formData: FormData): CampaignCreate {
  return {
    hall_id: readRequiredString(formData, "hall_id"),
    title: readRequiredString(formData, "title"),
    description: readOptionalString(formData, "description"),
    slot_starts_at: toIsoFromLocal(readRequiredString(formData, "slot_starts_at")),
    slot_ends_at: toIsoFromLocal(readRequiredString(formData, "slot_ends_at")),
    voting_duration_days: readOptionalNumber(formData, "voting_duration_days") ?? 7,
    decision_days_before_screening: readOptionalNumber(formData, "decision_days_before_screening") ?? 7,
    min_tickets_to_confirm: readRequiredNumber(formData, "min_tickets_to_confirm"),
    max_tickets: readOptionalNumber(formData, "max_tickets") ?? undefined,
    ticket_price_cents: eurosToCents(readRequiredNumber(formData, "ticket_price_eur")),
  };
}

function readLocationForm(formData: FormData) {
  return {
    city_name: readOptionalString(formData, "city_name"),
    location_name: readOptionalString(formData, "location_name"),
    address_line1: readOptionalString(formData, "address_line1"),
    address_line2: readOptionalString(formData, "address_line2"),
    postal_code: readOptionalString(formData, "postal_code"),
    timezone: readRequiredString(formData, "timezone"),
    is_active: formData.get("is_active") === "on",
  };
}

function readRequiredString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}

function readOptionalString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }
  return value.trim();
}

function readRequiredNumber(formData: FormData, key: string): number {
  const value = Number(readRequiredString(formData, key));
  if (!Number.isFinite(value)) {
    throw new Error(`${key} must be a number`);
  }
  return value;
}

function readOptionalNumber(formData: FormData, key: string): number | undefined {
  const raw = formData.get(key);
  if (typeof raw !== "string" || raw.trim() === "") {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`${key} must be a number`);
  }
  return value;
}

function toIsoFromLocal(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }
  return date.toISOString();
}

function toLocalDateTimeValue(value: string): string {
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function eurosToCents(value: number): number {
  return Math.round(value * 100);
}

function formatMoney(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

function formatEventType(value: string | null): string {
  if (!value) {
    return "Private booking";
  }

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char: string) => char.toUpperCase());
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Not set";
  }
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMovieLabel(title: string, releaseYear?: number | null): string {
  return releaseYear ? `${title} (${releaseYear})` : title;
}

function formatLocationLabel(location: CinemaLocationRead): string {
  return location.location_name || location.address_line1 || location.city_name || "Unnamed location";
}

function campaignSuccessMessage(action: string): string {
  if (action === "create") {
    return "Campaign created.";
  }
  if (action === "publish") {
    return "Campaign published. Matching recommendation emails were queued automatically.";
  }
  if (action === "resolve") {
    return "Campaign resolved and screening created.";
  }
  if (action === "cancel") {
    return "Campaign cancelled.";
  }
  if (action === "add-movie") {
    return "Offered movie added to campaign.";
  }
  if (action === "remove-movie") {
    return "Movie removed from campaign.";
  }
  return "Campaign updated.";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong.";
}
