import { MapPin, Clock } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { StateBadge } from "../components/StateBadge";
import { ProgressBar } from "../components/ProgressBar";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { Share2} from "lucide-react";

function MyTicketsPage() {
  const { purchasedTickets, setSelectedTicket, setActiveModal } = useAppContext();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-2">My Tickets</h1>
        <p className="text-muted-foreground">
          Your upcoming screenings and reservations
        </p>
      </div>

      {purchasedTickets.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-muted-foreground mb-2">No tickets yet</p>
          <p className="text-sm text-muted-foreground">
            Purchase tickets from the Screenings page to see them here
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {purchasedTickets.map((ticket) => (
            <div 
              key={ticket.id}
              className={`bg-card border rounded-xl p-6 ${
                ticket.status === "pending" ? "border-yellow-500/30" : "border-border"
              }`}
            >
              <div className="flex gap-6">
                <div className="w-24 h-36 rounded-lg overflow-hidden bg-secondary flex-shrink-0">
                  <ImageWithFallback
                    src={ticket.screening.movie.posterUrl}
                    alt={ticket.screening.movie.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="mb-1">{ticket.screening.movie.title}</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        {ticket.screening.movie.genre} • {ticket.screening.movie.year}
                      </p>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="w-4 h-4" />
                          <span>{ticket.screening.cinema}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span>{ticket.screening.dateTime}</span>
                        </div>
                      </div>
                    </div>
                    <StateBadge status={ticket.status} />
                  </div>
                  
                  {ticket.status === "pending" && ticket.screening.threshold && ticket.screening.ticketsSold && (
                    <>
                      <div className="mb-3">
                        <ProgressBar
                          current={ticket.screening.ticketsSold}
                          total={ticket.screening.threshold}
                          label="Tickets reserved"
                          variant="amber"
                        />
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Only charged if confirmed • {ticket.screening.deadlineText || "Few days left to reach threshold"}
                      </p>
                      <div className="flex items-center gap-3">
                        <button className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg flex items-center gap-2 text-sm transition-colors">
                          <Share2 className="w-4 h-4" />
                          Share Campaign
                        </button>
                      </div>
                    </>
                  )}

                  {ticket.status === "confirmed" && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setSelectedTicket({
                            movie: ticket.screening.movie,
                            cinema: ticket.screening.cinema,
                            dateTime: ticket.screening.dateTime,
                            ticketQuantity: ticket.ticketQuantity,
                            totalPaid: ticket.totalPaid,
                          });
                          setActiveModal("qr-ticket");
                        }}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm transition-colors"
                      >
                        View QR Ticket
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyTicketsPage;
export { MyTicketsPage as Component };
