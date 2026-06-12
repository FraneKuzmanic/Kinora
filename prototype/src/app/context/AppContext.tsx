import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Movie, Screening, Campaign, Cinema, BookingStep, BookingData, ModalType, PurchasedTicket } from "../data/types";
import { movies, cinemas, initialCampaigns, screenings, initialPurchasedTickets } from "../data/mockData";

interface AppContextType {
  // Modal state
  activeModal: ModalType;
  setActiveModal: (modal: ModalType) => void;
  closeModal: () => void;

  // Selection state
  selectedScreening: Screening | null;
  setSelectedScreening: (s: Screening | null) => void;
  selectedCampaign: Campaign | null;
  setSelectedCampaign: (c: Campaign | null) => void;
  selectedMovie: Movie | null;
  setSelectedMovie: (m: Movie | null) => void;
  selectedCinema: Cinema | null;
  setSelectedCinema: (c: Cinema | null) => void;
  selectedTicket: {
    movie: Movie;
    cinema: string;
    dateTime: string;
    ticketQuantity: number;
    totalPaid: number;
  } | null;
  setSelectedTicket: (t: {
    movie: Movie;
    cinema: string;
    dateTime: string;
    ticketQuantity: number;
    totalPaid: number;
  } | null) => void;

  // Ticket quantity
  ticketQuantity: number;
  setTicketQuantity: (q: number) => void;

  // Voting
  userVotes: Record<string, string>;
  campaigns: Campaign[];
  handleVote: (campaignId: string, movieId: string) => void;
  getCampaignLeader: (campaign: Campaign) => { movie: Movie; votes: number };
  getTotalVotes: (campaign: Campaign) => number;
  addCampaign: (campaign: Omit<Campaign, 'id' | 'votes'>) => void;

  // Booking flow
  bookingStep: BookingStep;
  setBookingStep: (s: BookingStep) => void;
  bookingData: BookingData;
  setBookingData: (d: BookingData) => void;
  submittedBooking: BookingData | null;
  setSubmittedBooking: (d: BookingData | null) => void;
  cinemaSearchQuery: string;
  setCinemaSearchQuery: (q: string) => void;
  movieSearchQuery: string;
  setMovieSearchQuery: (q: string) => void;
  resetBookingFlow: () => void;
  calculateEstimatedPrice: () => number;
  handleCinemaSelect: (cinema: Cinema) => void;
  handleEventTypeSelect: (eventType: "screening" | "rental") => void;
  handleMovieSelect: (movie: Movie) => void;
  handleEventDetailsSubmit: (eventName: string, date: string, time: string, guestCount: number) => void;
  filteredCinemas: Cinema[];
  filteredMovies: Movie[];

  // Film suggestions
  suggestFilmData: { movieTitle: string; preferredCinema: string; reason: string };
  setSuggestFilmData: (d: { movieTitle: string; preferredCinema: string; reason: string }) => void;
  filmSuggestions: Array<{ id: string; title: string; count: number; noScreening: boolean }>;
  handleSuggestFilmSubmit: (e: React.FormEvent) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Location
  location: string;

  // Data
  movies: Movie[];
  screenings: Screening[];
  cinemas: Cinema[];
  purchasedTickets: PurchasedTicket[];

  // Screening click handler
  handleScreeningClick: (screening: Screening) => void;
  handleMovieInfoClick: (movie: Movie, e: React.MouseEvent) => void;
  handleCheckout: () => void;
  handlePurchase: () => void;
  purchaseTicket: (screening: Screening, quantity: number) => void;
  
  // Scroll to campaign
  scrollToCampaignId: string | null;
  setScrollToCampaignId: (id: string | null) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedScreening, setSelectedScreening] = useState<Screening | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [selectedCinema, setSelectedCinema] = useState<Cinema | null>(null);
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [userVotes, setUserVotes] = useState<Record<string, string>>({});
  const [location] = useState("Zagreb");
  const [selectedTicket, setSelectedTicket] = useState<{
    movie: Movie;
    cinema: string;
    dateTime: string;
    ticketQuantity: number;
    totalPaid: number;
  } | null>(null);

  const [bookingStep, setBookingStep] = useState<BookingStep>("cinema-selection");
  const [bookingData, setBookingData] = useState<BookingData>({
    cinema: null,
    eventType: null,
    movie: null,
    eventName: "",
    date: "",
    time: "",
    guestCount: 0,
  });
  const [submittedBooking, setSubmittedBooking] = useState<BookingData | null>(null);
  const [movieSearchQuery, setMovieSearchQuery] = useState("");
  const [cinemaSearchQuery, setCinemaSearchQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [suggestFilmData, setSuggestFilmData] = useState({
    movieTitle: "",
    preferredCinema: "",
    reason: "",
  });

  const [filmSuggestions, setFilmSuggestions] = useState([
    { id: "1", title: "Lost in Translation", count: 12, noScreening: true },
    { id: "2", title: "Parasite", count: 9, noScreening: true },
    { id: "3", title: "The Grand Budapest Hotel", count: 7, noScreening: true },
    { id: "4", title: "In the Mood for Love", count: 5, noScreening: true },
    { id: "5", title: "John Wick", count: 3, noScreening: false },
  ]);

  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [purchasedTickets, setPurchasedTickets] = useState<PurchasedTicket[]>(initialPurchasedTickets);

  const closeModal = useCallback(() => setActiveModal(null), []);

  const handleVote = useCallback((campaignId: string, movieId: string) => {
    const previousVote = userVotes[campaignId];
    setCampaigns((prevCampaigns) =>
      prevCampaigns.map((campaign) => {
        if (campaign.id === campaignId) {
          const updatedVotes = { ...campaign.votes };
          if (previousVote && previousVote !== movieId) {
            updatedVotes[previousVote] = Math.max(0, (updatedVotes[previousVote] || 0) - 1);
          }
          if (!previousVote || previousVote !== movieId) {
            updatedVotes[movieId] = (updatedVotes[movieId] || 0) + 1;
          }
          return { ...campaign, votes: updatedVotes };
        }
        return campaign;
      }),
    );
    setUserVotes((prev) => ({ ...prev, [campaignId]: movieId }));
  }, [userVotes]);

  const getCampaignLeader = useCallback((campaign: Campaign) => {
    let leaderId = campaign.candidates[0].id;
    let maxVotes = campaign.votes[leaderId] || 0;
    Object.entries(campaign.votes).forEach(([id, votes]) => {
      if (votes > maxVotes) {
        maxVotes = votes;
        leaderId = id;
      }
    });
    const leader = campaign.candidates.find((m) => m.id === leaderId)!;
    return { movie: leader, votes: maxVotes };
  }, []);

  const getTotalVotes = useCallback((campaign: Campaign) => {
    return Object.values(campaign.votes).reduce((sum, votes) => sum + votes, 0);
  }, []);

  const addCampaign = useCallback((campaign: Omit<Campaign, 'id' | 'votes'>) => {
    setCampaigns((prev) => [
      {
        ...campaign,
        id: Date.now().toString(),
        votes: {},
      },
      ...prev,
    ]);
  }, []);

  const handleScreeningClick = useCallback((screening: Screening) => {
    setSelectedScreening(screening);
  }, []);

  const handleMovieInfoClick = useCallback((movie: Movie, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedMovie(movie);
    setActiveModal("movie-info");
  }, []);

  const handleCheckout = useCallback(() => setActiveModal("checkout"), []);
  const handlePurchase = useCallback(() => setActiveModal("ticket-success"), []);

  const handleCinemaSelect = useCallback((cinema: Cinema) => {
    setBookingData((prev) => ({ ...prev, cinema }));
    setBookingStep("event-type");
  }, []);

  const handleEventTypeSelect = useCallback((eventType: "screening" | "rental") => {
    setBookingData((prev) => ({ ...prev, eventType }));
    if (eventType === "screening") {
      setBookingStep("movie-selection");
    } else {
      setBookingStep("event-details");
    }
  }, []);

  const handleMovieSelect = useCallback((movie: Movie) => {
    setBookingData((prev) => ({ ...prev, movie }));
    setBookingStep("event-details");
  }, []);

  const handleEventDetailsSubmit = useCallback((eventName: string, date: string, time: string, guestCount: number) => {
    setBookingData((prev) => ({ ...prev, eventName, date, time, guestCount }));
    setBookingStep("summary");
  }, []);

  const resetBookingFlow = useCallback(() => {
    setBookingStep("cinema-selection");
    setBookingData({
      cinema: null,
      eventType: null,
      movie: null,
      eventName: "",
      date: "",
      time: "",
      guestCount: 0,
    });
    setMovieSearchQuery("");
    setCinemaSearchQuery("");
  }, []);

  const calculateEstimatedPrice = useCallback(() => {
    if (!bookingData.cinema || !bookingData.guestCount) return 0;
    const basePrice = bookingData.cinema.priceFrom;
    const guestMultiplier = bookingData.guestCount / 50;
    return Math.round(basePrice * (0.7 + guestMultiplier * 0.3));
  }, [bookingData.cinema, bookingData.guestCount]);

  const filteredCinemas = cinemas.filter(
    (cinema) =>
      cinema.name.toLowerCase().includes(cinemaSearchQuery.toLowerCase()) ||
      cinema.location.toLowerCase().includes(cinemaSearchQuery.toLowerCase()),
  );

  const filteredMovies = movies.filter(
    (movie) =>
      movie.title.toLowerCase().includes(movieSearchQuery.toLowerCase()) ||
      movie.director.toLowerCase().includes(movieSearchQuery.toLowerCase()),
  );

  const handleSuggestFilmSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const existingSuggestion = filmSuggestions.find(
      (s) => s.title.toLowerCase() === suggestFilmData.movieTitle.toLowerCase(),
    );
    if (existingSuggestion) {
      setFilmSuggestions((prev) =>
        prev.map((s) =>
          s.title.toLowerCase() === suggestFilmData.movieTitle.toLowerCase()
            ? { ...s, count: s.count + 1 }
            : s,
        ),
      );
    } else {
      setFilmSuggestions((prev) => [
        {
          id: Date.now().toString(),
          title: suggestFilmData.movieTitle,
          count: 1,
          noScreening: true,
        },
        ...prev,
      ]);
    }
    setActiveModal("suggest-film-success");
    setSuggestFilmData({ movieTitle: "", preferredCinema: "", reason: "" });
  }, [filmSuggestions, suggestFilmData]);

  const purchaseTicket = useCallback((screening: Screening, quantity: number) => {
    const ticket: PurchasedTicket = {
      id: Date.now().toString(),
      screening: screening,
      ticketQuantity: quantity,
      totalPaid: screening.price * quantity + 0.5,
      purchaseDate: new Date().toISOString(),
      status: screening.status === "confirmed" ? "confirmed" : "pending",
    };
    setPurchasedTickets((prev) => [ticket, ...prev]);
    setActiveModal("ticket-success");
  }, []);

  const [scrollToCampaignId, setScrollToCampaignId] = useState<string | null>(null);

  return (
    <AppContext.Provider
      value={{
        activeModal,
        setActiveModal,
        closeModal,
        selectedScreening,
        setSelectedScreening,
        selectedCampaign,
        setSelectedCampaign,
        selectedMovie,
        setSelectedMovie,
        selectedCinema,
        setSelectedCinema,
        selectedTicket,
        setSelectedTicket,
        ticketQuantity,
        setTicketQuantity,
        userVotes,
        campaigns,
        handleVote,
        getCampaignLeader,
        getTotalVotes,
        addCampaign,
        bookingStep,
        setBookingStep,
        bookingData,
        setBookingData,
        submittedBooking,
        setSubmittedBooking,
        cinemaSearchQuery,
        setCinemaSearchQuery,
        movieSearchQuery,
        setMovieSearchQuery,
        resetBookingFlow,
        calculateEstimatedPrice,
        handleCinemaSelect,
        handleEventTypeSelect,
        handleMovieSelect,
        handleEventDetailsSubmit,
        filteredCinemas,
        filteredMovies,
        suggestFilmData,
        setSuggestFilmData,
        filmSuggestions,
        handleSuggestFilmSubmit,
        searchQuery,
        setSearchQuery,
        location,
        movies,
        screenings,
        cinemas,
        handleScreeningClick,
        handleMovieInfoClick,
        handleCheckout,
        handlePurchase,
        purchaseTicket,
        scrollToCampaignId,
        setScrollToCampaignId,
        purchasedTickets,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}