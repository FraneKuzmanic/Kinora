import { MapPin, Clock } from 'lucide-react';
import { StateBadge } from './StateBadge';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface MovieCardProps {
  title: string;
  genre: string;
  year: number;
  location: string;
  dateTime?: string;
  status: 'voting' | 'leading' | 'on-sale' | 'confirmed' | 'at-risk' | 'pending';
  posterUrl: string;
  onClick?: () => void;
}

export function MovieCard({
  title,
  genre,
  year,
  location,
  dateTime,
  status,
  posterUrl,
  onClick,
}: MovieCardProps) {
  return (
    <button
      onClick={onClick}
      className="group relative bg-card rounded-xl overflow-hidden border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 text-left w-full"
    >
      <div className="aspect-[2/3] overflow-hidden bg-secondary">
        <ImageWithFallback
          src={posterUrl}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="truncate text-foreground text-sm md:text-base">{title}</h3>
            <p className="text-xs md:text-sm text-muted-foreground">
              {genre} • {year}
            </p>
          </div>
          <StateBadge status={status} />
        </div>
        <div className="space-y-1 text-xs md:text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3 md:w-3.5 md:h-3.5 flex-shrink-0" />
            <span className="truncate text-xs">{location}</span>
          </div>
          {dateTime && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 md:w-3.5 md:h-3.5 flex-shrink-0" />
              <span className="text-xs">{dateTime}</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}