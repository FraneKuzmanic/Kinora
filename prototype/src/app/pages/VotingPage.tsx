import {
  Vote,
  MapPin,
  Calendar,
  Users,
  TrendingUp,
  Ticket,
  Share2,
  Film,
  Sparkles,
} from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { StateBadge } from "../components/StateBadge";
import { CountdownTimer } from "../components/CountdownTimer";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { VoteAnimation } from "../components/VoteAnimation";

function VotingPage() {
  const {
    campaigns,
    userVotes,
    getCampaignLeader,
    getTotalVotes,
    handleVote,
    setSelectedMovie,
    setSelectedCampaign,
    setActiveModal,
    handleMovieInfoClick,
    ticketQuantity,
    setTicketQuantity,
    scrollToCampaignId,
    setScrollToCampaignId,
  } = useAppContext();

  const campaignRefs = useRef<
    Record<string, HTMLDivElement | null>
  >({});
  const [showVoteAnimation, setShowVoteAnimation] =
    useState(false);
  const [voteButtonRef, setVoteButtonRef] =
    useState<HTMLButtonElement | null>(null);
  const [votedMovieId, setVotedMovieId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (scrollToCampaignId) {
      const campaignRef =
        campaignRefs.current[scrollToCampaignId];
      if (campaignRef) {
        campaignRef.scrollIntoView({ behavior: "smooth" });
      }
      setScrollToCampaignId(null);
    }
  }, [scrollToCampaignId, setScrollToCampaignId]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-2">Vote for What Screens Next</h1>
        <p className="text-muted-foreground">
          Choose your favorite from each campaign. The winning
          film moves to screening phase.
        </p>
      </div>

      <div className="bg-card border border-primary/30 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Vote className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="mb-2">How voting works</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>
                  Vote for your preferred film in each campaign
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>
                  The winning film enters a screening phase
                  after voting closes
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>
                  Screening confirms only if enough tickets are
                  reserved
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Expanded Voting Containers */}
      <div className="space-y-8">
        {campaigns.map((campaign) => {
          const leader = getCampaignLeader(campaign);
          const totalVotes = getTotalVotes(campaign);

          return (
            <div
              key={campaign.id}
              className="bg-card border border-border rounded-2xl overflow-hidden"
              ref={(el) =>
                (campaignRefs.current[campaign.id] = el)
              }
            >
              {/* Campaign Header */}
              <div className="bg-gradient-to-r from-primary/10 to-transparent p-6 border-b border-border">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <StateBadge status="voting" />
                      {campaign.votingDeadline && (
                        <CountdownTimer
                          targetDate={campaign.votingDeadline}
                          className="text-sm"
                        />
                      )}
                    </div>
                    <h2 className="text-2xl mb-2">
                      {campaign.cinema}
                    </h2>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4" />
                        <span>
                          {campaign.location ||
                            "Zagreb, Croatia"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        <span>{campaign.slot}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-4 h-4" />
                        <span>
                          {totalVotes}{" "}
                          {totalVotes === 1
                            ? "voter"
                            : "voters"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-start lg:items-end gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <span className="text-primary font-medium">
                        {leader.movie.title}
                      </span>
                      <span className="text-muted-foreground">
                        leading
                      </span>
                    </div>
                    {campaign.votingDeadline && (
                      <p className="text-xs text-muted-foreground">
                        Voting closes: {campaign.votingDeadline}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Candidate Films Grid */}
              <div className="p-6">
                <h3 className="mb-4 text-lg">
                  Choose Your Film
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                  {campaign.candidates.map((movie) => {
                    const votes = campaign.votes[movie.id] || 0;
                    const percentage =
                      totalVotes > 0
                        ? (votes / totalVotes) * 100
                        : 0;
                    const isLeading =
                      votes ===
                      Math.max(
                        ...Object.values(campaign.votes),
                      );
                    const hasVoted =
                      userVotes[campaign.id] === movie.id;

                    return (
                      <div
                        key={movie.id}
                        className="group relative flex gap-3 p-3 rounded-lg border border-transparent hover:border-primary/30 hover:bg-card/50 transition-all cursor-pointer"
                        onClick={() =>
                          handleMovieInfoClick(movie, {
                            stopPropagation: () => {},
                          } as React.MouseEvent)
                        }
                      >
                        {/* Movie Poster */}
                        <div className="w-24 h-36 flex-shrink-0 overflow-hidden bg-secondary rounded-lg border border-border relative">
                          <ImageWithFallback
                            src={movie.posterUrl}
                            alt={movie.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          {isLeading && (
                            <div className="absolute top-1.5 left-1.5 z-10">
                              <div className="bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1 shadow-lg">
                                <TrendingUp className="w-2.5 h-2.5" />
                                Leading
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Movie Info */}
                        <div className="flex-1 flex flex-col justify-between min-w-0">
                          <div>
                            <h4 className="text-sm font-semibold line-clamp-2 mb-0.5">
                              {movie.title}
                            </h4>
                            <p className="text-xs text-muted-foreground mb-2">
                              {movie.genre} • {movie.year}
                            </p>
                            <div className="flex items-center gap-1.5 text-xs mb-2">
                              <span className="text-muted-foreground">
                                {votes} votes
                              </span>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-primary font-semibold">
                                {percentage.toFixed(1)}%
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <motion.button
                              ref={(el) => {
                                if (hasVoted && el) {
                                  setVoteButtonRef(el);
                                }
                              }}
                              whileTap={{ scale: 0.95 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                const target = e.currentTarget;
                                setVoteButtonRef(target);
                                handleVote(
                                  campaign.id,
                                  movie.id,
                                );
                                setVotedMovieId(movie.id);
                                setShowVoteAnimation(true);
                              }}
                              className={`sm:w-[84px] px-4 py-2 rounded-md transition-colors flex items-center justify-center gap-1.5 font-medium text-xs whitespace-nowrap ${
                                hasVoted
                                  ? "bg-secondary text-muted-foreground"
                                  : "bg-primary hover:bg-primary/90 text-primary-foreground"
                              }`}
                            >
                              <Vote className="w-3 h-3" />
                              {hasVoted ? "Voted" : "Vote"}
                            </motion.button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMovie(movie);
                                setSelectedCampaign(campaign);
                                setActiveModal("buy-early");
                              }}
                              className="px-3 py-2 bg-secondary hover:bg-primary/20 text-foreground rounded-md transition-colors flex items-center justify-center gap-1.5 font-medium text-xs whitespace-nowrap"
                            >
                              <Ticket className="w-3 h-3" />
                              Buy Early
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Campaign Actions */}
                <div className="flex items-center justify-between pt-6 mt-6 border-t border-border">
                  <button className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors flex items-center gap-2 text-sm">
                    <Share2 className="w-4 h-4" />
                    Share Campaign
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Vote Animation */}
      <VoteAnimation
        show={showVoteAnimation}
        onComplete={() => setShowVoteAnimation(false)}
        buttonRef={voteButtonRef}
      />
    </div>
  );
}

export default VotingPage;
export { VotingPage as Component };