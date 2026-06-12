interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
  showPercentage?: boolean;
  variant?: 'amber' | 'green' | 'blue';
}

export function ProgressBar({
  current,
  total,
  label,
  showPercentage = true,
  variant = 'amber',
}: ProgressBarProps) {
  const percentage = Math.min((current / total) * 100, 100);

  const colors = {
    amber: 'bg-primary',
    green: 'bg-green-500',
    blue: 'bg-blue-500',
  };

  return (
    <div className="space-y-2">
      {(label || showPercentage) && (
        <div className="flex justify-between items-center text-sm">
          {label && <span className="text-muted-foreground">{label}</span>}
          {showPercentage && (
            <span className="text-foreground">
              {current}/{total} ({Math.round(percentage)}%)
            </span>
          )}
        </div>
      )}
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full ${colors[variant]} transition-all duration-500 rounded-full`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
