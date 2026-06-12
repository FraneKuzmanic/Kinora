import { X, Calendar, MapPin, Users, Film, Check, Clock, DollarSign } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { useState } from "react";
import type { Movie } from "../data/types";
import { ImageWithFallback } from "./figma/ImageWithFallback";

export function CreateCampaignModal() {
  const { closeModal, movies, addCampaign, setActiveModal } = useAppContext();
  
  // Hardcoded cinema info - acting as a specific cinema
  const cinemaName = "Kino Europa";
  const cinemaLocation = "Varšavska 3, Zagreb";
  
  const [formData, setFormData] = useState({
    screeningDate: "",
    screeningTime: "",
    votingDeadlineDate: "",
    votingDeadlineTime: "",
    ticketPrice: 8,
  });
  const [selectedMovies, setSelectedMovies] = useState<Movie[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleMovieToggle = (movie: Movie) => {
    setSelectedMovies((prev) => {
      const isSelected = prev.some((m) => m.id === movie.id);
      if (isSelected) {
        return prev.filter((m) => m.id !== movie.id);
      } else {
        if (prev.length >= 4) {
          return prev;
        }
        return [...prev, movie];
      }
    });
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.screeningDate) newErrors.screeningDate = "Screening date is required";
    if (!formData.screeningTime) newErrors.screeningTime = "Screening time is required";
    if (!formData.votingDeadlineDate) newErrors.votingDeadlineDate = "Voting deadline date is required";
    if (!formData.votingDeadlineTime) newErrors.votingDeadlineTime = "Voting deadline time is required";
    if (formData.ticketPrice < 1) newErrors.ticketPrice = "Minimum ticket price is 1";
    if (selectedMovies.length !== 4) newErrors.movies = "Please select exactly 4 films";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Format date and time for display
    const screeningDate = new Date(formData.screeningDate + 'T' + formData.screeningTime);
    const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    const formattedDate = screeningDate.toLocaleDateString('en-US', dateOptions);
    const formattedTime = screeningDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    
    const votingDeadline = new Date(formData.votingDeadlineDate + 'T' + formData.votingDeadlineTime);
    const formattedDeadline = votingDeadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + 
      ' ' + votingDeadline.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

    addCampaign({
      cinema: cinemaName,
      location: cinemaLocation,
      slot: `${formattedDate} • ${formattedTime}`,
      timeLeft: "Just created",
      votingDeadline: formattedDeadline,
      candidates: selectedMovies,
      threshold: 50,
      ticketPrice: formData.ticketPrice,
    });

    setActiveModal("campaign-created-success");
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto my-8">
        {/* Header */}
        <div className="sticky z-50 top-0 bg-card border-b border-border p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl mb-1">Create Voting Campaign</h2>
            <p className="text-sm text-muted-foreground">
              Set up a new voting campaign for your cinema
            </p>
          </div>
          <button
            onClick={closeModal}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Cinema Info - Read Only */}
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium mb-1">{cinemaName}</h4>
                <p className="text-sm text-muted-foreground">{cinemaLocation}</p>
              </div>
            </div>
          </div>

          {/* Screening Date & Time */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Screening Date & Time <span className="text-primary">*</span>
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              When will the winning film be screened?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-2">Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="date"
                    value={formData.screeningDate}
                    onChange={(e) => setFormData({ ...formData, screeningDate: e.target.value })}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full pl-10 pr-4 py-2.5 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                {errors.screeningDate && (
                  <p className="text-xs text-red-400 mt-1">{errors.screeningDate}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-2">Time</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="time"
                    value={formData.screeningTime}
                    onChange={(e) => setFormData({ ...formData, screeningTime: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                {errors.screeningTime && (
                  <p className="text-xs text-red-400 mt-1">{errors.screeningTime}</p>
                )}
              </div>
            </div>
          </div>

          {/* Voting Deadline */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Voting Deadline <span className="text-primary">*</span>
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              When should voting close?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-2">Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="date"
                    value={formData.votingDeadlineDate}
                    onChange={(e) =>
                      setFormData({ ...formData, votingDeadlineDate: e.target.value })
                    }
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full pl-10 pr-4 py-2.5 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                {errors.votingDeadlineDate && (
                  <p className="text-xs text-red-400 mt-1">{errors.votingDeadlineDate}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-2">Time</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="time"
                    value={formData.votingDeadlineTime}
                    onChange={(e) =>
                      setFormData({ ...formData, votingDeadlineTime: e.target.value })
                    }
                    className="w-full pl-10 pr-4 py-2.5 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                {errors.votingDeadlineTime && (
                  <p className="text-xs text-red-400 mt-1">{errors.votingDeadlineTime}</p>
                )}
              </div>
            </div>
          </div>

          {/* Ticket Price */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Ticket Price <span className="text-primary">*</span>
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="number"
                min="1"
                step="0.50"
                value={formData.ticketPrice}
                onChange={(e) =>
                  setFormData({ ...formData, ticketPrice: parseFloat(e.target.value) || 0 })
                }
                className="w-full pl-10 pr-4 py-2.5 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Early bird ticket price for moviegoers who want to secure their seat
            </p>
            {errors.ticketPrice && (
              <p className="text-xs text-red-400 mt-1">{errors.ticketPrice}</p>
            )}
          </div>

          {/* Movie Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Select 4 Films <span className="text-primary">*</span>
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              Choose exactly 4 films for moviegoers to vote on (
              {selectedMovies.length}/4 selected)
            </p>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto p-1">
              {movies.map((movie) => {
                const isSelected = selectedMovies.some((m) => m.id === movie.id);
                const isDisabled = !isSelected && selectedMovies.length >= 4;

                return (
                  <button
                    key={movie.id}
                    type="button"
                    onClick={() => !isDisabled && handleMovieToggle(movie)}
                    disabled={isDisabled}
                    className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/20"
                        : isDisabled
                        ? "border-border opacity-40 cursor-not-allowed"
                        : "border-transparent hover:border-primary/50"
                    }`}
                  >
                    <div className="aspect-[2/3] relative">
                      <ImageWithFallback
                        src={movie.posterUrl}
                        alt={movie.title}
                        className="w-full h-full object-cover"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                            <Check className="w-5 h-5 text-primary-foreground" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2">
                      <p className="text-xs font-medium line-clamp-2">{movie.title}</p>
                      <p className="text-[10px] text-muted-foreground">{movie.year}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            {errors.movies && (
              <p className="text-xs text-red-400 mt-2">{errors.movies}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={closeModal}
              className="px-6 py-2.5 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors flex items-center gap-2"
            >
              <Film className="w-4 h-4" />
              Create Campaign
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}