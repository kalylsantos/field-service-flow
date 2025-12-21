import { ServiceOrderStatus, STATUS_LABELS } from '@/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  status: ServiceOrderStatus;
  className?: string;
}

const statusClasses: Record<ServiceOrderStatus, string> = {
  pending: 'bg-blue-500 text-white hover:bg-blue-600',
  in_progress: 'bg-yellow-500 text-white hover:bg-yellow-600',
  completed: 'bg-green-500 text-white hover:bg-green-600',
  not_executed: 'bg-red-500 text-white hover:bg-red-600',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge className={cn('text-xs font-medium px-3 py-1', statusClasses[status], className)}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
