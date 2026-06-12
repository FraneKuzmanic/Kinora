import { useNavigate } from "react-router";
import { startTransition } from "react";
import {
  MapPin,
  Clock,
  CheckCircle,
  QrCode,
  Vote,
  TrendingUp,
  Bookmark,
  Share2,
  Users,
  Calendar,
  Film,
  Ticket,
  AlertCircle,
  Search,
  ChevronRight,
} from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { Modal } from "./Modal";
import { StateBadge } from "./StateBadge";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { CreateCampaignModal } from "./CreateCampaignModal";
import { CampaignCreatedSuccessModal } from "./CampaignCreatedSuccessModal";

export default function Modals() {
  const navigate = useNavigate();
  const {
    activeModal,
    setActiveModal,
    closeModal,
    selectedScreening,
    selectedCampaign,
    selectedMovie,
    selectedCinema,
    selectedTicket,
    setSelectedMovie,
    setSelectedCampaign,
    setSelectedScreening,
    ticketQuantity,
    setTicketQuantity,
    userVotes,
    handleVote,
    getCampaignLeader,
    getTotalVotes,
    handleCinemaSelect,
    submittedBooking,
    suggestFilmData,
    setSuggestFilmData,
    handleSuggestFilmSubmit,
    searchQuery,
    setSearchQuery,
    movies,
    screenings,
    campaigns,
    handleScreeningClick,
    setScrollToCampaignId,
    purchaseTicket,
  } = useAppContext();

  // For the post-vote modal - replicate original behavior with userVote variable
  const userVote = selectedCampaign ? userVotes[selectedCampaign.id] : undefined;

  return (
    <>
      {/* Ticket Checkout Modal */}
      {activeModal === "checkout" && selectedScreening && (
        <Modal isOpen={true} onClose={closeModal} title="Complete Your Purchase" size="md">
          <div className="space-y-6">
            <div className="bg-secondary rounded-xl p-4">
              <h3 className="mb-3">Screening Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Film</span>
                  <span>{selectedScreening.movie.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cinema</span>
                  <span>{selectedScreening.cinema}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date & Time</span>
                  <span>{selectedScreening.dateTime}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block mb-3">Number of Tickets</label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setTicketQuantity(Math.max(1, ticketQuantity - 1))}
                  className="w-10 h-10 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
                >
                  −
                </button>
                <span className="text-2xl w-12 text-center">{ticketQuantity}</span>
                <button
                  onClick={() => setTicketQuantity(Math.min(10, ticketQuantity + 1))}
                  className="w-10 h-10 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <span>Subtotal</span>
                <span>€{(selectedScreening.price * ticketQuantity).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>Service fee</span>
                <span>€0.50</span>
              </div>
              <div className="border-t border-primary/30 mt-3 pt-3">
                <div className="flex justify-between items-center text-xl">
                  <span>Total</span>
                  <span className="text-primary">
                    €{(selectedScreening.price * ticketQuantity + 0.5).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                if (selectedScreening) {
                  purchaseTicket(selectedScreening, ticketQuantity);
                }
              }}
              className="w-full px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
            >
              Complete Purchase
            </button>
          </div>
        </Modal>
      )}

      {/* Ticket Success Modal */}
      {activeModal === "ticket-success" && selectedScreening && (
        <Modal isOpen={true} onClose={closeModal} size="md">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <h2 className="mb-2">Ticket Confirmed!</h2>
              <p className="text-muted-foreground">Your tickets have been sent to your email</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="w-48 h-48 bg-white rounded-lg mx-auto mb-4 flex items-center justify-center">
                <QrCode className="w-32 h-32 text-black" />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Film</span>
                  <span>{selectedScreening.movie.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cinema</span>
                  <span>{selectedScreening.cinema}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date & Time</span>
                  <span>{selectedScreening.dateTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tickets</span>
                  <span>{ticketQuantity}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Paid</span>
                  <span className="text-primary">
                    €{(selectedScreening.price * ticketQuantity + 0.5).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="flex-1 px-6 py-3 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors">
                Download PDF
              </button>
            </div>
            <button
              onClick={() => {
                closeModal();
                startTransition(() => {
                  navigate("/tickets");
                });
              }}
              className="text-primary hover:text-primary/80 text-sm"
            >
              View My Tickets
            </button>
          </div>
        </Modal>
      )}

      {/* QR Ticket Modal */}
      {activeModal === "qr-ticket" && selectedTicket && (
        <Modal isOpen={true} onClose={closeModal} size="md">
          <div className="text-center space-y-6">
            <div>
              <h2 className="mb-2">Your Ticket</h2>
              <p className="text-muted-foreground">Show this QR code at the cinema entrance</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="w-48 h-48 bg-white rounded-lg mx-auto mb-4 flex items-center justify-center">
                <QrCode className="w-32 h-32 text-black" />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Film</span>
                  <span>{selectedTicket.movie.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cinema</span>
                  <span>{selectedTicket.cinema}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date & Time</span>
                  <span>{selectedTicket.dateTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tickets</span>
                  <span>{selectedTicket.ticketQuantity}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Paid</span>
                  <span className="text-primary">€{selectedTicket.totalPaid.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <button className="w-full px-6 py-3 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors">
              Download PDF
            </button>
            <button onClick={closeModal} className="text-primary hover:text-primary/80 text-sm">
              Close
            </button>
          </div>
        </Modal>
      )}

      {/* Campaign Detail Modal */}
      {activeModal === "campaign-detail" && selectedCampaign && (
        <Modal isOpen={true} onClose={closeModal} size="xl">
          <div className="space-y-6">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-3xl mb-2">Vote for Your Choice</h1>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span>{selectedCampaign.cinema}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{selectedCampaign.slot}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <StateBadge status="voting" />
                  <p className="text-sm text-muted-foreground mt-2">{selectedCampaign.timeLeft}</p>
                </div>
              </div>
              <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
                <p className="text-sm">
                  <span className="text-primary">How it works:</span> Vote for your preferred
                  film. The winner enters a screening phase. The screening is{" "}
                  <span className="text-primary">confirmed only if enough tickets are reserved</span>
                  . You'll only be charged if it happens!
                </p>
              </div>
            </div>

            <div>
              <h3 className="mb-4">Candidate Films</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {selectedCampaign.candidates.map((movie) => {
                  const votes = selectedCampaign.votes[movie.id] || 0;
                  const totalVotes = getTotalVotes(selectedCampaign);
                  const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                  const isLeading = votes === Math.max(...Object.values(selectedCampaign.votes));

                  return (
                    <button
                      key={movie.id}
                      onClick={() => handleVote(selectedCampaign.id, movie.id)}
                      className="group relative bg-card border border-border hover:border-primary transition-all rounded-xl overflow-hidden text-left"
                    >
                      {isLeading && (
                        <div className="absolute top-3 right-3 z-10">
                          <div className="bg-primary/90 text-primary-foreground text-xs px-2 py-1 rounded-full flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            Leading
                          </div>
                        </div>
                      )}
                      <div className="aspect-[2/3] overflow-hidden bg-secondary">
                        <ImageWithFallback
                          src={movie.posterUrl}
                          alt={movie.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="p-4 space-y-3">
                        <div>
                          <h4 className="mb-1 truncate">{movie.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {movie.genre} • {movie.year}
                          </p>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 text-sm">
                            <span className="text-muted-foreground">{votes} votes</span>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-primary">{percentage}%</span>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-border">
                          <div className="text-sm text-primary group-hover:text-primary/80 flex items-center gap-2">
                            <Vote className="w-4 h-4" />
                            Vote for this film
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="flex gap-3">
                <button className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors flex items-center gap-2">
                  <Bookmark className="w-4 h-4" />
                  Save
                </button>
                <button className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors flex items-center gap-2">
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">
                  {getTotalVotes(selectedCampaign)} total votes
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Post-Vote State Modal */}
      {activeModal === "post-vote" && selectedCampaign && userVote && (
        <Modal isOpen={true} onClose={closeModal} size="md">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="mb-2">Your vote has been recorded!</h2>
              <p className="text-muted-foreground">
                You voted for{" "}
                {selectedCampaign.candidates.find((m) => m.id === userVote)?.title}
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6 space-y-4 text-left">
              <h3>What happens next?</h3>
              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-primary text-xs">1</span>
                  </div>
                  <div>
                    <p className="text-foreground mb-1">
                      Voting closes in {selectedCampaign.timeLeft}
                    </p>
                    <p className="text-muted-foreground">The film with the most votes wins</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-primary text-xs">2</span>
                  </div>
                  <div>
                    <p className="text-foreground mb-1">Winner enters screening phase</p>
                    <p className="text-muted-foreground">You'll be notified to reserve your ticket</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-primary text-xs">3</span>
                  </div>
                  <div>
                    <p className="text-foreground mb-1">
                      Screening confirmed at {selectedCampaign.threshold} tickets
                    </p>
                    <p className="text-muted-foreground">Only charged if confirmed</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-left">
                  We'll send you email and push notifications when voting closes and when
                  reservation opens. Share with friends to help reach the threshold!
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => closeModal()}
                className="flex-1 px-6 py-3 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
              >
                Done
              </button>
              <button className="flex-1 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors flex items-center justify-center gap-2">
                <Share2 className="w-4 h-4" />
                Share Campaign
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Cinema Details Modal */}
      {activeModal === "cinema-details" && selectedCinema && (
        <Modal isOpen={true} onClose={closeModal} title={selectedCinema.name} size="lg">
          <div className="space-y-6">
            <div className="h-64 rounded-lg overflow-hidden bg-secondary">
              <ImageWithFallback
                src={selectedCinema.imageUrl}
                alt={selectedCinema.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="mb-2">Location</h4>
                <p className="text-muted-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {selectedCinema.location}
                </p>
              </div>
              <div>
                <h4 className="mb-2">Description</h4>
                <p className="text-muted-foreground">{selectedCinema.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="mb-2">Capacity</h4>
                  <p className="text-muted-foreground flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    {selectedCinema.capacity} seats
                  </p>
                </div>
                <div>
                  <h4 className="mb-2">Starting Price</h4>
                  <p className="text-primary text-xl">€{selectedCinema.priceFrom}</p>
                </div>
              </div>
              <div>
                <h4 className="mb-3">Amenities</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedCinema.amenities.map((amenity) => (
                    <span key={amenity} className="px-3 py-1.5 bg-secondary rounded-lg text-sm">
                      {amenity}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button
                onClick={closeModal}
                className="flex-1 px-6 py-3 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleCinemaSelect(selectedCinema);
                  closeModal();
                }}
                className="flex-1 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
              >
                Select This Cinema
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Booking Form Modal */}
      {activeModal === "booking-form" && (
        <Modal isOpen={true} onClose={closeModal} title="Private Booking Request" size="lg">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-2">Event Type</label>
                <select className="w-full px-4 py-2 bg-input border border-border rounded-lg">
                  <option>Birthday celebration</option>
                  <option>Team event</option>
                  <option>Student club night</option>
                  <option>Indie filmmaker showcase</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block mb-2">Preferred Cinema</label>
                <select className="w-full px-4 py-2 bg-input border border-border rounded-lg">
                  <option>Kino Europa</option>
                  <option>Student Film Hall</option>
                  <option>ArtHouse Zagreb</option>
                  <option>City Screen</option>
                </select>
              </div>
              <div>
                <label className="block mb-2">Date</label>
                <input
                  type="date"
                  className="w-full px-4 py-2 bg-input border border-border rounded-lg"
                  defaultValue="2026-04-05"
                />
              </div>
              <div>
                <label className="block mb-2">Preferred Time</label>
                <input
                  type="time"
                  className="w-full px-4 py-2 bg-input border border-border rounded-lg"
                  defaultValue="15:00"
                />
              </div>
              <div>
                <label className="block mb-2">Number of Guests</label>
                <input
                  type="number"
                  className="w-full px-4 py-2 bg-input border border-border rounded-lg"
                  placeholder="35"
                  min="10"
                  max="200"
                />
              </div>
              <div>
                <label className="block mb-2">Film/Content</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-input border border-border rounded-lg"
                  placeholder="e.g., Titanic"
                />
              </div>
            </div>
            <div>
              <label className="block mb-2">Additional Requests</label>
              <textarea
                className="w-full px-4 py-2 bg-input border border-border rounded-lg min-h-24"
                placeholder="Any special requirements, catering needs, or questions..."
              />
            </div>
            <div className="bg-secondary rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h4>Estimated Price</h4>
                <span className="text-2xl text-primary">€280</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Based on 35 guests at Student Film Hall. Final price subject to cinema approval.
              </p>
            </div>
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
              <p className="text-sm">
                Your request will be reviewed by the cinema within 24 hours. You'll receive a
                confirmation email with final pricing and availability.
              </p>
            </div>
            <button
              onClick={() => setActiveModal("booking-submitted")}
              className="w-full px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
            >
              Submit Booking Request
            </button>
          </div>
        </Modal>
      )}

      {/* Booking Submitted Modal */}
      {activeModal === "booking-submitted" && submittedBooking && submittedBooking.cinema && (
        <Modal isOpen={true} onClose={closeModal} size="md">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="mb-2">Request Submitted!</h2>
              <p className="text-muted-foreground">
                Your private booking request has been sent to {submittedBooking.cinema.name}
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6 space-y-4 text-left">
              <h3>Request Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Event Type</span>
                  <span className="capitalize">
                    {submittedBooking.eventType === "screening" ? "Film Screening" : "Space Rental"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Event Name</span>
                  <span>{submittedBooking.eventName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cinema</span>
                  <span>{submittedBooking.cinema.name}</span>
                </div>
                {submittedBooking.movie && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Film</span>
                    <span>{submittedBooking.movie.title}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date & Time</span>
                  <span>
                    {new Date(submittedBooking.date).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    • {submittedBooking.time}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Guests</span>
                  <span>{submittedBooking.guestCount} people</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated Cost</span>
                  <span className="text-primary">
                    €
                    {Math.round(
                      submittedBooking.cinema.priceFrom *
                        (0.7 + (submittedBooking.guestCount / 50) * 0.3),
                    )}
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-left">
                  <p className="text-sm mb-1">
                    <span className="text-yellow-400">Pending cinema approval</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    You'll receive a confirmation email within 24 hours with final pricing and
                    next steps.
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                closeModal();
                startTransition(() => {
                  navigate("/private-booking");
                });
              }}
              className="w-full px-6 py-3 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </Modal>
      )}

      {/* Booking Request Detail Modal */}
      {activeModal === "booking-request-detail" && (
        <Modal isOpen={true} onClose={closeModal} title="Booking Request Review" size="lg">
          <div className="space-y-6">
            <div className="bg-secondary rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="mb-1">Birthday Screening Request</h3>
                  <p className="text-sm text-muted-foreground">Requested by: Sarah Johnson</p>
                </div>
                <StateBadge status="pending" />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Date & Time</p>
                  <p>Sat, Apr 5 • 3:00 PM</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Number of Guests</p>
                  <p>35 people</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Film/Content</p>
                  <p>Titanic</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Event Type</p>
                  <p>Birthday celebration</p>
                </div>
              </div>
            </div>
            <div>
              <h4 className="mb-3">Additional Requests</h4>
              <div className="bg-card border border-border rounded-lg p-4 text-sm text-muted-foreground">
                We'd like to bring a birthday cake and have a small decoration setup before the
                screening. Is it possible to access the room 30 minutes early?
              </div>
            </div>
            <div>
              <h4 className="mb-3">Revenue Estimate</h4>
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Base rental (80 seats)</span>
                  <span>€180</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Film licensing</span>
                  <span>€60</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Weekend premium</span>
                  <span>€40</span>
                </div>
                <div className="border-t border-border pt-3">
                  <div className="flex justify-between items-center">
                    <span>Recommended Price</span>
                    <span className="text-2xl text-primary">€280</span>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <h4 className="mb-3">Availability Check</h4>
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="text-sm">
                      <span className="text-green-400">Slot available</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      No conflicts found for this date and time
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <label className="block mb-2">Response Message (Optional)</label>
              <textarea
                className="w-full px-4 py-2 bg-input border border-border rounded-lg min-h-20"
                placeholder="Add any notes or conditions for the customer..."
              />
            </div>
            <div className="flex gap-3 pt-4 border-t border-border">
              <button
                onClick={closeModal}
                className="flex-1 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
              >
                Approve & Send Quote
              </button>
              <button className="px-6 py-3 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors">
                Decline
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Suggest Film Form Modal */}
      {activeModal === "suggest-film-form" && (
        <Modal isOpen={true} onClose={closeModal} title="Suggest a Film" size="md">
          <form onSubmit={handleSuggestFilmSubmit} className="space-y-4">
            <div>
              <label htmlFor="movieTitle" className="block text-sm mb-2">
                Movie Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                id="movieTitle"
                value={suggestFilmData.movieTitle}
                onChange={(e) =>
                  setSuggestFilmData({ ...suggestFilmData, movieTitle: e.target.value })
                }
                placeholder="e.g., Lost in Translation"
                required
                className="w-full px-4 py-3 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label htmlFor="preferredCinema" className="block text-sm mb-2">
                Preferred Cinema{" "}
                <span className="text-xs text-muted-foreground">(optional)</span>
              </label>
              <select
                id="preferredCinema"
                value={suggestFilmData.preferredCinema}
                onChange={(e) =>
                  setSuggestFilmData({ ...suggestFilmData, preferredCinema: e.target.value })
                }
                className="w-full px-4 py-3 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Any cinema</option>
                <option value="Kino Europa">Kino Europa</option>
                <option value="Student Film Hall">Student Film Hall</option>
                <option value="ArtHouse Zagreb">ArtHouse Zagreb</option>
                <option value="City Screen">City Screen</option>
              </select>
            </div>
            <div>
              <label htmlFor="reason" className="block text-sm mb-2">
                Why would you love to see this film?{" "}
                <span className="text-xs text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="reason"
                value={suggestFilmData.reason}
                onChange={(e) =>
                  setSuggestFilmData({ ...suggestFilmData, reason: e.target.value })
                }
                placeholder="Share why this film matters to you..."
                rows={4}
                className="w-full px-4 py-3 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 px-6 py-3 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Film className="w-5 h-5" />
                Submit Suggestion
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Suggest Film Success Modal */}
      {activeModal === "suggest-film-success" && (
        <Modal isOpen={true} onClose={closeModal} size="sm">
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-green-400/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="mb-3">Suggestion Submitted!</h2>
            <p className="text-muted-foreground mb-6">
              Thank you for your suggestion! We'll review it and if approved, it will be added
              to our voting campaigns for the community to vote on.
            </p>
            <button
              onClick={closeModal}
              className="w-full px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
            >
              Got it
            </button>
          </div>
        </Modal>
      )}

      {/* Movie Info Modal */}
      {activeModal === "movie-info" && selectedMovie && (
        <Modal isOpen={true} onClose={closeModal} size="md">
          <div className="space-y-6">
            <div className="flex gap-6">
              <div className="w-32 h-48 flex-shrink-0 overflow-hidden bg-secondary rounded-lg border border-border">
                <ImageWithFallback
                  src={selectedMovie.posterUrl}
                  alt={selectedMovie.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl mb-2">{selectedMovie.title}</h2>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Film className="w-4 h-4 text-primary" />
                    <span>{selectedMovie.genre}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span>{selectedMovie.year}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span>Directed by {selectedMovie.director}</span>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-lg mb-2">Synopsis</h3>
              <p className="text-muted-foreground leading-relaxed">{selectedMovie.synopsis}</p>
            </div>
            <div className="flex justify-end pt-4 border-t border-border">
              <button
                onClick={closeModal}
                className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Buy Early Modal */}
      {activeModal === "buy-early" && selectedMovie && (
        <Modal isOpen={true} onClose={closeModal} size="md">
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Ticket className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl mb-2">Buy Early Ticket</h2>
              <p className="text-muted-foreground">
                Reserve your spot before the screening is confirmed
              </p>
            </div>
            <div className="flex gap-4 p-4 bg-secondary/50 rounded-lg border border-border">
              <div className="w-20 h-30 flex-shrink-0 overflow-hidden bg-secondary rounded-lg border border-border">
                <ImageWithFallback
                  src={selectedMovie.posterUrl}
                  alt={selectedMovie.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">{selectedMovie.title}</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {selectedMovie.genre} • {selectedMovie.year}
                </p>
                {selectedCampaign && (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span>{selectedCampaign.cinema}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      <span>{selectedCampaign.slot}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="space-y-2 text-sm">
                  <p className="font-medium">How early tickets work:</p>
                  <ul className="space-y-1.5 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>Your card will be authorized but not charged yet</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>You'll only be charged if this film wins the vote</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>If it loses, your authorization will be released</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>Early buyers get priority seating when screening is confirmed</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Number of Tickets</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setTicketQuantity(Math.max(1, ticketQuantity - 1))}
                  className="w-10 h-10 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors"
                >
                  <span className="text-xl">−</span>
                </button>
                <div className="flex-1 text-center">
                  <span className="text-2xl font-semibold">{ticketQuantity}</span>
                </div>
                <button
                  onClick={() => setTicketQuantity(Math.min(10, ticketQuantity + 1))}
                  className="w-10 h-10 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors"
                >
                  <span className="text-xl">+</span>
                </button>
              </div>
            </div>
            <div className="bg-secondary/50 rounded-lg p-4 border border-border">
              <div className="flex items-center justify-between mb-1">
                <span className="text-muted-foreground">Estimated price per ticket</span>
                <span className="font-medium">${selectedCampaign?.ticketPrice?.toFixed(2) || '12.00'}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
                <span className="font-semibold">Total (Authorization)</span>
                <span className="text-xl font-bold text-primary">
                  ${((selectedCampaign?.ticketPrice || 12) * ticketQuantity).toFixed(2)}
                </span>
              </div>
            </div>
            <div className="flex gap-3 pt-4 border-t border-border">
              <button
                onClick={closeModal}
                className="flex-1 px-6 py-3 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setActiveModal("early-ticket-success");
                }}
                className="flex-1 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Ticket className="w-5 h-5" />
                Reserve Ticket
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Early Ticket Success Modal */}
      {activeModal === "early-ticket-success" && selectedMovie && (
        <Modal isOpen={true} onClose={closeModal} size="md">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="mb-2">Early Ticket Reserved!</h2>
              <p className="text-muted-foreground">
                Your spot is secured for {selectedMovie.title}
              </p>
            </div>
            <div className="bg-secondary rounded-xl p-4 border border-border text-left">
              <div className="flex items-start gap-3">
                <Ticket className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="mb-1">Reservation Details</h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Film</span>
                      <span className="text-foreground">{selectedMovie.title}</span>
                    </div>
                    {selectedCampaign && (
                      <>
                        <div className="flex justify-between">
                          <span>Cinema</span>
                          <span className="text-foreground">{selectedCampaign.cinema}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Slot</span>
                          <span className="text-foreground">{selectedCampaign.slot}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between">
                      <span>Tickets</span>
                      <span className="text-foreground">{ticketQuantity}x</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-border">
                      <span>Authorization Hold</span>
                      <span className="text-primary font-medium">
                        ${(12 * ticketQuantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-left">
                  We'll notify you when voting closes and if the screening is confirmed. Share with
                  friends to help reach the threshold!
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={closeModal}
                className="flex-1 px-6 py-3 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
              >
                Done
              </button>
              <button className="flex-1 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors flex items-center justify-center gap-2">
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Search Modal */}
      {activeModal === "search" && (
        <Modal isOpen={true} onClose={closeModal} size="lg">
          <div className="flex flex-col h-full max-h-[70vh]">
            <div className="flex-shrink-0 space-y-4 pb-4">
              <h2 className="text-2xl">Search Movies</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for a movie"
                  className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {searchQuery.trim() && (
                <div className="space-y-6">
                  {(() => {
                    const query = searchQuery.toLowerCase();
                    const votingResults: Array<{
                      movie: typeof movies[0];
                      campaign: typeof campaigns[0];
                    }> = [];
                    campaigns.forEach((campaign) => {
                      campaign.candidates.forEach((movie) => {
                        if (
                          movie.title.toLowerCase().includes(query) ||
                          movie.genre.toLowerCase().includes(query) ||
                          movie.director.toLowerCase().includes(query)
                        ) {
                          votingResults.push({ movie, campaign });
                        }
                      });
                    });
                    const screeningResults = screenings.filter(
                      (screening) =>
                        screening.movie.title.toLowerCase().includes(query) ||
                        screening.movie.genre.toLowerCase().includes(query) ||
                        screening.movie.director.toLowerCase().includes(query),
                    );
                    const hasResults = votingResults.length > 0 || screeningResults.length > 0;

                    if (!hasResults) {
                      return (
                        <div className="text-center py-12">
                          <Film className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                          <p className="text-muted-foreground">
                            No movies found matching "{searchQuery}"
                          </p>
                        </div>
                      );
                    }

                    return (
                      <>
                        {screeningResults.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <Ticket className="w-5 h-5 text-primary" />
                              <h3 className="font-semibold">
                                Confirmed Screenings ({screeningResults.length})
                              </h3>
                            </div>
                            <div className="space-y-3">
                              {screeningResults.map((screening) => (
                                <button
                                  key={screening.id}
                                  onClick={() => {
                                    setSelectedScreening(screening);
                                    setActiveModal(null);
                                    startTransition(() => {
                                      navigate("/screening/" + screening.id);
                                    });
                                  }}
                                  className="w-full flex gap-4 p-3 bg-secondary/50 hover:bg-secondary rounded-lg border border-border transition-colors text-left"
                                >
                                  <div className="w-16 h-24 flex-shrink-0 overflow-hidden bg-secondary rounded border border-border">
                                    <ImageWithFallback
                                      src={screening.movie.posterUrl}
                                      alt={screening.movie.title}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold mb-1 truncate">
                                      {screening.movie.title}
                                    </h4>
                                    <p className="text-sm text-muted-foreground mb-2">
                                      {screening.movie.genre} • {screening.movie.year}
                                    </p>
                                    <div className="space-y-1 text-xs text-muted-foreground">
                                      <div className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        <span>{screening.dateTime}</span>
                                      </div>
                                      <div>{screening.cinema}</div>
                                    </div>
                                  </div>
                                  <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 self-center" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {votingResults.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <Vote className="w-5 h-5 text-primary" />
                              <h3 className="font-semibold">
                                Available for Voting ({votingResults.length})
                              </h3>
                            </div>
                            <div className="space-y-3">
                              {votingResults.map(({ movie, campaign }, idx) => (
                                <button
                                  key={`voting-${movie.id}-${campaign.id}-${idx}`}
                                  onClick={() => {
                                    closeModal();
                                    setScrollToCampaignId(campaign.id);
                                    startTransition(() => {
                                      navigate("/voting");
                                    });
                                  }}
                                  className="w-full flex gap-4 p-3 bg-secondary/50 hover:bg-secondary rounded-lg border border-border transition-colors text-left"
                                >
                                  <div className="w-16 h-24 flex-shrink-0 overflow-hidden bg-secondary rounded border border-border">
                                    <ImageWithFallback
                                      src={movie.posterUrl}
                                      alt={movie.title}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold mb-1 truncate">{movie.title}</h4>
                                    <p className="text-sm text-muted-foreground mb-2">
                                      {movie.genre} • {movie.year}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                                        Voting Campaign
                                      </span>
                                      <span className="text-muted-foreground">
                                        {campaign.cinema}
                                      </span>
                                    </div>
                                  </div>
                                  <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 self-center" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
              {!searchQuery.trim() && (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Start typing to search for movies</p>
                </div>
              )}
            </div>

            <div className="flex-shrink-0 border-t border-border pt-4 mt-4">
              <button
                onClick={() => setActiveModal("suggest-film-form")}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-secondary/50 hover:bg-secondary border border-border rounded-lg transition-colors"
              >
                <Film className="w-5 h-5 text-primary" />
                <span className="text-sm">Don't see your movie? Suggest a film</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Campaign Modal */}
      {activeModal === "create-campaign" && <CreateCampaignModal />}

      {/* Campaign Created Success Modal */}
      {activeModal === "campaign-created-success" && <CampaignCreatedSuccessModal />}
    </>
  );
}
