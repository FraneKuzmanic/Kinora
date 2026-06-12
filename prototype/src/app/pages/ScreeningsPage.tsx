import { useNavigate } from "react-router";
import { startTransition } from "react";
import { MapPin, Calendar, Ticket } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { StateBadge } from "../components/StateBadge";
import { ProgressBar } from "../components/ProgressBar";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

function ScreeningsPage() {
  const navigate = useNavigate();
  const { screenings, handleScreeningClick, setActiveModal } = useAppContext();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="mb-2">Active Screenings</h1>
        <p className="text-muted-foreground">
          Nearby screenings with threshold progress.
          Screenings confirm when enough tickets are sold.
        </p>
      </div>

      {/* How it works card */}
      <div className="bg-card border border-primary/30 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Ticket className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="mb-2">How threshold screenings work</h3>
            <p className="text-sm text-muted-foreground">
              Each screening needs to reach its minimum
              ticket threshold to be confirmed. Buy your
              ticket now to help make it happen. You'll
              only be charged if the screening confirms.
            </p>
          </div>
        </div>
      </div>

      {/* Screenings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {screenings.map((screening) => {
          const progress =
            screening.ticketsSold && screening.threshold
              ? (screening.ticketsSold / screening.threshold) * 100
              : 0;

          return (
            <div
              key={screening.id}
              className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all group"
              onClick={() => {
                handleScreeningClick(screening);
                startTransition(() => {
                  navigate("/screening/" + screening.id);
                });
              }}
            >
              {/* Poster Image */}
              <div className="relative aspect-[2/3] overflow-hidden bg-secondary">
                <ImageWithFallback
                  src={screening.movie.posterUrl}
                  alt={screening.movie.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg line-clamp-2 mb-1">
                      {screening.movie.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {screening.movie.genre} • {screening.movie.year}
                    </p>
                  </div>
                  {screening.status !== "on-sale" && (
                    <div className="flex-shrink-0">
                      <StateBadge status={screening.status} />
                    </div>
                  )}
                </div>

                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                  <p>{screening.cinema} • {screening.location}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span>{screening.dateTime}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Ticket className="w-4 h-4 text-primary" />
                  <span className="font-medium">
                    ${screening.price.toFixed(2)}
                  </span>
                </div>

                {screening.ticketsSold !== undefined &&
                  screening.threshold !== undefined && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {screening.status === "confirmed"
                            ? `${screening.ticketsSold} tickets sold`
                            : `${screening.ticketsSold}/${screening.threshold} tickets sold`}
                        </span>
                        <span className="font-medium text-primary">
                          {screening.status === "confirmed"
                            ? "100%"
                            : `${Math.round(progress)}%`}
                        </span>
                      </div>
                      <ProgressBar
                        current={screening.ticketsSold}
                        total={screening.threshold}
                        showPercentage={false}
                      />
                      {screening.status === "confirmed" ? (
                        <p className="text-xs text-primary font-medium">
                          Screening confirmed
                        </p>
                      ) : (
                        screening.deadlineText && (
                          <p className="text-xs text-muted-foreground">
                            Screening confirms when threshold is reached •{" "}
                            {screening.deadlineText}
                          </p>
                        )
                      )}
                    </div>
                  )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleScreeningClick(screening);
                    setActiveModal("checkout");
                  }}
                  className="w-full px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Ticket className="w-4 h-4" />
                  Buy Ticket
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ScreeningsPage;
export { ScreeningsPage as Component };