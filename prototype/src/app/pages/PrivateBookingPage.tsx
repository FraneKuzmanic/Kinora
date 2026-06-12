import {
  Search,
  MapPin,
  Users,
  Film,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

function PrivateBookingPage() {
  const {
    bookingStep,
    setBookingStep,
    bookingData,
    setBookingData,
    cinemaSearchQuery,
    setCinemaSearchQuery,
    movieSearchQuery,
    setMovieSearchQuery,
    filteredCinemas,
    filteredMovies,
    handleCinemaSelect,
    handleEventTypeSelect,
    handleMovieSelect,
    handleEventDetailsSubmit,
    resetBookingFlow,
    calculateEstimatedPrice,
    setSelectedCinema,
    setActiveModal,
    setSubmittedBooking,
  } = useAppContext();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="mb-2">Private Cinema Booking</h1>
        <p className="text-muted-foreground">
          Reserve an entire cinema for your special event
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center gap-2">
        {[
          { step: "cinema-selection", label: "Select Cinema" },
          { step: "event-type", label: "Event Type" },
          ...(bookingData.eventType === "screening"
            ? [{ step: "movie-selection", label: "Choose Film" }]
            : []),
          { step: "event-details", label: "Event Details" },
          { step: "summary", label: "Summary" },
        ].map((item, index) => (
          <div key={item.step} className="flex items-center flex-1">
            <div className="flex items-center gap-2 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                  bookingStep === item.step
                    ? "bg-primary text-primary-foreground"
                    : index <
                        [
                          "cinema-selection",
                          "event-type",
                          "movie-selection",
                          "event-details",
                          "summary",
                        ].indexOf(bookingStep)
                      ? "bg-primary/20 text-primary"
                      : "bg-secondary text-muted-foreground"
                }`}
              >
                {index + 1}
              </div>
              <span
                className={`text-sm hidden md:block ${bookingStep === item.step ? "text-foreground" : "text-muted-foreground"}`}
              >
                {item.label}
              </span>
            </div>
            {index < 4 && <div className="w-full h-0.5 bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 1: Cinema Selection */}
      {bookingStep === "cinema-selection" && (
        <div className="space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by cinema name or location..."
              value={cinemaSearchQuery}
              onChange={(e) => setCinemaSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredCinemas.map((cinema) => (
              <div
                key={cinema.id}
                className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-all"
              >
                <div className="h-48 overflow-hidden bg-secondary">
                  <ImageWithFallback
                    src={cinema.imageUrl}
                    alt={cinema.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <h3 className="mb-1">{cinema.name}</h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {cinema.location}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4 text-primary" />
                      <span>{cinema.capacity} seats</span>
                    </div>
                    <div className="text-primary">from €{cinema.priceFrom}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cinema.amenities.slice(0, 3).map((amenity) => (
                      <span
                        key={amenity}
                        className="px-2 py-1 bg-secondary rounded text-xs text-muted-foreground"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCinemaSelect(cinema)}
                      className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
                    >
                      Select Cinema
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCinema(cinema);
                        setActiveModal("cinema-details");
                      }}
                      className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
                    >
                      Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Event Type Selection */}
      {bookingStep === "event-type" && bookingData.cinema && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="mb-1">Select Event Type</h2>
              <p className="text-sm text-muted-foreground">
                Cinema: {bookingData.cinema.name}
              </p>
            </div>
            <button
              onClick={() => setBookingStep("cinema-selection")}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Change Cinema
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={() => handleEventTypeSelect("screening")}
              className="bg-card border-2 border-border hover:border-primary rounded-xl p-8 text-left transition-all group"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Film className="w-6 h-6 text-primary" />
              </div>
              <h3 className="mb-2">Film Screening</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Book a private screening of your chosen film. Perfect for movie
                nights, birthdays, or team-building events.
              </p>
              <div className="text-primary flex items-center gap-2">
                Select Film Screening
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>

            <button
              onClick={() => handleEventTypeSelect("rental")}
              className="bg-card border-2 border-border hover:border-primary rounded-xl p-8 text-left transition-all group"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <h3 className="mb-2">Non-Screening Rental</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Rent the cinema space for presentations, meetings or
                other events without film screening.
              </p>
              <div className="text-primary flex items-center gap-2">
                Book Space Rental
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Movie Selection */}
      {bookingStep === "movie-selection" && bookingData.eventType === "screening" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2>Choose Your Film</h2>
            <button
              onClick={() => setBookingStep("event-type")}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Back
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search for a film..."
              value={movieSearchQuery}
              onChange={(e) => setMovieSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {filteredMovies.map((movie) => (
              <button
                key={movie.id}
                onClick={() => handleMovieSelect(movie)}
                className="text-left group"
              >
                <div className="aspect-[2/3] rounded-lg overflow-hidden bg-secondary mb-3 ring-2 ring-transparent group-hover:ring-primary transition-all">
                  <ImageWithFallback
                    src={movie.posterUrl}
                    alt={movie.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h4 className="text-sm mb-1 group-hover:text-primary transition-colors">
                  {movie.title}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {movie.year} • {movie.director}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 4: Event Details */}
      {bookingStep === "event-details" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2>Event Details</h2>
            <button
              onClick={() =>
                setBookingStep(
                  bookingData.eventType === "screening" ? "movie-selection" : "event-type",
                )
              }
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Back
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleEventDetailsSubmit(
                formData.get("eventName") as string,
                formData.get("date") as string,
                formData.get("time") as string,
                Number(formData.get("guestCount")),
              );
            }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 text-sm">Event Name</label>
                <input
                  type="text"
                  name="eventName"
                  required
                  placeholder="e.g., Sarah's Birthday Party"
                  className="w-full px-4 py-2 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm">Expected Guest Count</label>
                <input
                  type="number"
                  name="guestCount"
                  required
                  min="10"
                  max={bookingData.cinema?.capacity}
                  placeholder="35"
                  className="w-full px-4 py-2 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm">Preferred Date</label>
                <input
                  type="date"
                  name="date"
                  required
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-2 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm">Preferred Time</label>
                <input
                  type="time"
                  name="time"
                  required
                  className="w-full px-4 py-2 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
            >
              Continue to Summary
            </button>
          </form>
        </div>
      )}

      {/* Step 5: Summary */}
      {bookingStep === "summary" && bookingData.cinema && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2>Booking Summary</h2>
            <button
              onClick={() => setBookingStep("event-details")}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Edit Details
            </button>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="mb-3">Cinema</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">{bookingData.cinema.name}</p>
                      <p className="text-muted-foreground">{bookingData.cinema.location}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span>{bookingData.cinema.capacity} seats capacity</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="mb-3">Event Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Event Type</span>
                    <span className="capitalize">{bookingData.eventType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Event Name</span>
                    <span>{bookingData.eventName}</span>
                  </div>
                  {bookingData.movie && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Film</span>
                      <span>{bookingData.movie.title}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date</span>
                    <span>
                      {new Date(bookingData.date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time</span>
                    <span>{bookingData.time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Guests</span>
                    <span>{bookingData.guestCount} people</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <h4>Estimated Price</h4>
                <span className="text-3xl text-primary">€{calculateEstimatedPrice()}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Final price subject to cinema approval and may vary based on specific
                requirements.
              </p>
            </div>
          </div>

          <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
            <p className="text-sm">
              Your request will be reviewed by {bookingData.cinema.name} within 24 hours.
              You'll receive a confirmation email with final pricing and availability.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={resetBookingFlow}
              className="flex-1 px-6 py-3 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setSubmittedBooking(bookingData);
                setActiveModal("booking-submitted");
                resetBookingFlow();
              }}
              className="flex-1 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
            >
              Submit Request
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PrivateBookingPage;
export { PrivateBookingPage as Component };