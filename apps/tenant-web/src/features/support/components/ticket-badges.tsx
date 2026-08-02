import { Badge, type BadgeProps } from '@/components/ui/badge';
import type { TicketPriority, TicketStatus } from '../types';

const STATUS_VARIANT: Record<TicketStatus, NonNullable<BadgeProps['variant']>> = {
  OPEN: 'warning',
  IN_PROGRESS: 'outline',
  RESOLVED: 'success',
  CLOSED: 'secondary',
};

const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

const PRIORITY_VARIANT: Record<TicketPriority, NonNullable<BadgeProps['variant']>> = {
  LOW: 'secondary',
  MEDIUM: 'outline',
  HIGH: 'warning',
  URGENT: 'destructive',
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className="font-medium">
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function TicketPriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <Badge variant={PRIORITY_VARIANT[priority]} className="font-medium">
      {priority}
    </Badge>
  );
}
