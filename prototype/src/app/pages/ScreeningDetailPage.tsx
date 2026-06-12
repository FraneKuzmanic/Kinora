import { useNavigate } from "react-router";
import { startTransition, useEffect } from "react";
import {
  ChevronRight,
  MapPin,
  Clock,
  Ticket,
  CheckCircle,
  Bookmark,
  Share2,
} from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

function ScreeningDetailPage() {
  const navigate = useNavigate();
  const { selectedScreening, setSelectedScreening, handleCheckout } =
    useAppContext();

  useEffect(() => {
    if (!selectedScreening) {
      startTransition(() => {
        navigate("/screenings");
      });
    }
  }, [selectedScreening, navigate]);

  if (!selectedScreening) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => {
          setSelectedScreening(null);
          startTransition(() => navigate(-1));
        }}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight className="w-5 h-5 rotate-180" />
        <span>Back</span>
      </button>

      {/* Screening Detail Content */}
      <div className="bg-card border border-border rounded-2xl p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Movie Poster */}
          <div className="w-full lg:w-64 h-[380px] rounded-xl overflow-hidden bg-secondary flex-shrink-0">
            <ImageWithFallback
              src={selectedScreening.movie.posterUrl}
              alt={selectedScreening.movie.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Movie Details */}
          <div className="flex-1 space-y-4 lg:space-y-5">
            <div>
              <h1 className="text-3xl lg:text-4xl mb-2">
                {selectedScreening.movie.title}
              </h1>
              <p className="text-base lg:text-lg text-muted-foreground">
                {selectedScreening.movie.genre} •{" "}
                {selectedScreening.movie.year} • Directed
                by {selectedScreening.movie.director}
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center gap-3 text-base lg:text-lg">
                <MapPin className="w-5 h-5 text-primary" />
                <span>{selectedScreening.cinema}</span>
              </div>
              <div className="flex items-center gap-3 text-base lg:text-lg">
                <Clock className="w-5 h-5 text-primary" />
                <span>{selectedScreening.dateTime}</span>
              </div>
              <div className="flex items-center gap-3 text-base lg:text-lg">
                <Ticket className="w-5 h-5 text-primary" />
                <span className="text-primary font-semibold">
                  €{selectedScreening.price.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Status Badge */}
            {selectedScreening.status === "confirmed" && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-400 font-medium">Confirmed Screening</span>
              </div>
            )}

            {/* Synopsis - moved here for better layout */}
            <div className="pt-2">
              <h2 className="text-xl lg:text-2xl mb-3">Synopsis</h2>
              <p className="text-muted-foreground text-sm lg:text-base leading-relaxed line-clamp-6">
                {selectedScreening.movie.synopsis}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCheckout}
                className="flex-1 lg:flex-initial px-8 py-3.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors text-base lg:text-lg font-medium"
              >
                Buy Ticket
              </button>
              <button className="px-4 py-3.5 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors">
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScreeningDetailPage;
export { ScreeningDetailPage as Component };