import { ServiceOrderStatus, STATUS_LABELS } from '@/types';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: ServiceOrderStatus;
  className?: string;
}

const statusClasses: Record<ServiceOrderStatus, string> = {
  pending: 'status-pending',
  in_progress: 'status-in-progress',
  completed: 'status-completed',
  not_executed: 'status-not-executed',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={cn('status-badge', statusClasses[status], className)}>
      {STATUS_LABELS[status]}
    </span>
  );
}
