import { useNavigate } from "react-router";
import { startTransition } from "react";
import { Ticket, ChevronRight, Film } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { MovieCard } from "../components/MovieCard";
import { CampaignCard } from "../components/CampaignCard";

function DiscoverPage() {
  const navigate = useNavigate();
  const {
    campaigns,
    screenings,
    getCampaignLeader,
    getTotalVotes,
    handleScreeningClick,
    setActiveModal,
    setSelectedScreening,
    setSelectedCampaign,
    setScrollToCampaignId,
  } = useAppContext();

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-primary/20 via-background to-background border border-primary/20 p-8 md:p-12">
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-4xl md:text-5xl mb-4">
            You pick, we play!
          </h1>
          <p className="text-lg text-muted-foreground mb-6">
            Discover voting campaigns, vote for your favorite
            films, and book tickets to help confirm screenings.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() =>
                startTransition(() => navigate("/screenings"))
              }
              className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors flex items-center gap-2"
            >
              <Ticket className="w-5 h-5" />
              Explore Screenings
            </button>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-10">
          <Film className="absolute top-8 right-8 w-24 h-24 text-primary" />
        </div>
      </div>

      {/* Active Voting Campaigns */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="mb-1">Active Voting Campaigns</h2>
            <p className="text-sm text-muted-foreground">
              Vote now to influence what screens next
            </p>
          </div>
          <button
            onClick={() =>
              startTransition(() => navigate("/voting"))
            }
            className="text-primary hover:text-primary/80 flex items-center gap-1 text-sm"
          >
            View all
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.slice(0, 2).map((campaign) => {
            const leader = getCampaignLeader(campaign);
            const totalVotes = getTotalVotes(campaign);
            return (
              <CampaignCard
                key={campaign.id}
                campaignId={campaign.id}
                cinema={campaign.cinema}
                location={
                  campaign.location || "Zagreb, Croatia"
                }
                slot={campaign.slot}
                timeLeft={campaign.timeLeft}
                candidates={campaign.candidates.map((m) => ({
                  title: m.title,
                  posterUrl: m.posterUrl,
                }))}
                currentLeader={{ title: leader.movie.title }}
                totalVotes={totalVotes}
                onClick={() => {
                  setScrollToCampaignId(campaign.id);
                  startTransition(() => navigate("/voting"));
                }}
              />
            );
          })}
        </div>
      </section>

      {/* Nearby Screenings */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="mb-1">Nearby Screenings</h2>
            <p className="text-sm text-muted-foreground">
              Confirmed screenings ready to book
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {screenings
            .filter(
              (screening) => screening.status === "confirmed",
            )
            .map((screening) => (
              <MovieCard
                key={screening.id}
                title={screening.movie.title}
                genre={screening.movie.genre}
                year={screening.movie.year}
                location={screening.cinema}
                dateTime={screening.dateTime}
                status={screening.status}
                posterUrl={screening.movie.posterUrl}
                onClick={() => {
                  handleScreeningClick(screening);
                  startTransition(() => {
                    navigate("/screening/" + screening.id);
                  });
                }}
              />
            ))}
        </div>
      </section>

      {/* Suggest a Film */}
      <section>
        <div className="bg-card border border-primary/30 rounded-xl p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="flex items-start gap-4 flex-1">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Film className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="mb-2">Don't see your film?</h3>
                <p className="text-sm text-muted-foreground">
                  Suggest a film you'd love to watch on the big
                  screen. If approved, it'll be available for
                  everyone to vote on!
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                setActiveModal("suggest-film-form")
              }
              className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors flex-shrink-0 w-full md:w-auto"
            >
              Suggest a Film
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default DiscoverPage;
export { DiscoverPage as Component };