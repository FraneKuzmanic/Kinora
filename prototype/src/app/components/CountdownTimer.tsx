import { Clock } from 'lucide-react';
import { useCountdown, formatCountdown } from '../hooks/useCountdown';

interface CountdownTimerProps {
  targetDate: string;
  className?: string;
}

export function CountdownTimer({ targetDate, className = '' }: CountdownTimerProps) {
  const timeRemaining = useCountdown(targetDate);
  const formattedTime = formatCountdown(timeRemaining);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Clock className="w-4 h-4 text-primary" />
      <span className={`font-semibold ${timeRemaining.isExpired ? 'text-muted-foreground' : 'text-primary'}`}>
        {formattedTime}
      </span>
    </div>
  );
}
