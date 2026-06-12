import { useState, useEffect } from 'react';

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

export function useCountdown(targetDate: string): TimeRemaining {
  const calculateTimeLeft = (): TimeRemaining => {
    const difference = new Date(targetDate).getTime() - new Date().getTime();
    
    if (difference <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
    }

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
      isExpired: false,
    };
  };

  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>(calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  return timeRemaining;
}

export function formatCountdown(time: TimeRemaining): string {
  if (time.isExpired) {
    return 'Voting closed';
  }

  if (time.days > 0) {
    return `${time.days}d ${time.hours}h ${time.minutes}m ${time.seconds}s`;
  }

  if (time.hours > 0) {
    return `${time.hours}h ${time.minutes}m ${time.seconds}s`;
  }

  if (time.minutes > 0) {
    return `${time.minutes}m ${time.seconds}s`;
  }

  return `${time.seconds}s`;
}
