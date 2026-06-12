import { Clock, TrendingUp, MapPin, Users } from 'lucide-react';
import { StateBadge } from './StateBadge';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface CampaignCardProps {
  campaignId: string;
  cinema: string;
  location: string;
  slot: string;
  timeLeft: string;
  candidates: Array<{
    title: string;
    posterUrl: string;
  }>;
  currentLeader: {
    title: string;
  };
  totalVotes: number;
  onClick?: () => void;
}

export function CampaignCard({
  cinema,
  location,
  slot,
  timeLeft,
  candidates,
  currentLeader,
  totalVotes,
  onClick,
}: CampaignCardProps) {
  return (
    <button
      onClick={onClick}
      className="group relative bg-card rounded-xl border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 text-left w-full"
    >
      <div className="flex gap-6 p-4">
        {/* Layered poster stack */}
        <div className="relative w-28 h-36 flex-shrink-0 z-30">
          {candidates.slice(0, 4).map((candidate, index) => {
            // Calculate default and hover positions
            const defaultTransform = `translateX(${index * 10}px) translateY(${index * 6}px) rotate(${index * 2 - 2}deg)`;
            const hoverTransform = `translateX(${index * 45}px) translateY(${index * 25}px) rotate(${index * 8 - 8}deg)`;
            
            return (
              <div
                key={index}
                className="absolute inset-0 rounded-lg overflow-hidden bg-secondary border border-border/50 transition-all duration-300 group-hover:shadow-xl poster-layer"
                style={{
                  transform: defaultTransform,
                  zIndex: candidates.length - index,
                  opacity: 1 - index * 0.15,
                  ['--hover-transform' as string]: hoverTransform,
                }}
              >
                <ImageWithFallback
                  src={candidate.posterUrl}
                  alt={candidate.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
            );
          })}
          
          {/* Overlay badge showing number of films */}
          <div className="absolute -bottom-2 -right-2 z-10 bg-primary text-primary-foreground text-xs font-semibold px-2 py-1 rounded-full border-2 border-background shadow-lg">
            {candidates.length} films
          </div>
        </div>

        {/* Campaign details */}
        <div className="flex-1 space-y-2.5 min-w-0 pl-8 relative z-10">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <StateBadge status="voting" />
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="font-medium text-primary">{timeLeft}</span>
                </div>
              </div>
              <h3 className="text-base font-semibold mb-1 truncate">{cinema}</h3>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{location}</span>
              </div>
              <p className="text-xs text-muted-foreground">{slot}</p>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-sm truncate">
                <span className="text-primary font-medium">{currentLeader.title}</span>
                <span className="text-muted-foreground"> leading</span>
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-muted-foreground">
                {totalVotes} {totalVotes === 1 ? 'voter' : 'voters'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}