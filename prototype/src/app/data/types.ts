export interface Movie {
  id: string;
  title: string;
  genre: string;
  year: number;
  director: string;
  synopsis: string;
  posterUrl: string;
}

export interface Screening {
  id: string;
  movie: Movie;
  cinema: string;
  dateTime: string;
  price: number;
  status: "confirmed" | "on-sale" | "at-risk";
  ticketsSold?: number;
  threshold?: number;
  location?: string;
  deadlineText?: string;
}

export interface Campaign {
  id: string;
  cinema: string;
  slot: string;
  timeLeft: string;
  candidates: Movie[];
  votes: Record<string, number>;
  threshold: number;
  ticketPrice?: number;
  location?: string;
  votingDeadline?: string;
}

export interface Cinema {
  id: string;
  name: string;
  location: string;
  capacity: number;
  priceFrom: number;
  amenities: string[];
  description: string;
  imageUrl: string;
}

export interface PurchasedTicket {
  id: string;
  screening: Screening;
  ticketQuantity: number;
  totalPaid: number;
  purchaseDate: string;
  status: "confirmed" | "pending";
}

export type BookingStep =
  | "cinema-selection"
  | "event-type"
  | "movie-selection"
  | "event-details"
  | "summary";

export interface BookingData {
  cinema: Cinema | null;
  eventType: "screening" | "rental" | null;
  movie: Movie | null;
  eventName: string;
  date: string;
  time: string;
  guestCount: number;
}

export type ModalType =
  | "checkout"
  | "ticket-success"
  | "qr-ticket"
  | "campaign-detail"
  | "post-vote"
  | "booking-form"
  | "booking-submitted"
  | "booking-request-detail"
  | "cinema-details"
  | "suggest-film-form"
  | "suggest-film-success"
  | "movie-info"
  | "buy-early"
  | "early-ticket-success"
  | "search"
  | "create-campaign"
  | "campaign-created-success"
  | null;