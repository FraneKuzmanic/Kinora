interface StateBadgeProps {
  status: 'voting' | 'leading' | 'on-sale' | 'confirmed' | 'at-risk' | 'pending';
  className?: string;
}

export function StateBadge({ status, className = '' }: StateBadgeProps) {
  const styles = {
    voting: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    leading: 'bg-primary/20 text-primary border-primary/30',
    'on-sale': 'bg-green-500/20 text-green-400 border-green-500/30',
    confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
    'at-risk': 'bg-red-500/20 text-red-400 border-red-500/30',
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  };

  const labels = {
    voting: 'Voting open',
    leading: 'Leading',
    'on-sale': 'On sale',
    confirmed: 'Confirmed',
    'at-risk': 'At risk',
    pending: 'Pending approval',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border ${styles[status]} ${className}`}
    >
      {labels[status]}
    </span>
  );
}
