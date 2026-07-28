import { Badge, type BadgeProps } from '@/components/ui/badge';
import type { DietProgressStatus, MemberDietPlanStatus } from '../types';

const PROGRESS_VARIANTS: Record<DietProgressStatus, NonNullable<BadgeProps['variant']>> = {
  PENDING: 'secondary',
  COMPLETED: 'success',
  SKIPPED: 'warning',
};

const PROGRESS_LABELS: Record<DietProgressStatus, string> = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  SKIPPED: 'Skipped',
};

const ASSIGNMENT_VARIANTS: Record<MemberDietPlanStatus, NonNullable<BadgeProps['variant']>> = {
  ACTIVE: 'success',
  COMPLETED: 'secondary',
  CANCELLED: 'outline',
};

export function DietProgressBadge({ status }: { status: DietProgressStatus }) {
  return <Badge variant={PROGRESS_VARIANTS[status]}>{PROGRESS_LABELS[status]}</Badge>;
}

export function DietAssignmentStatusBadge({ status }: { status: MemberDietPlanStatus }) {
  return (
    <Badge variant={ASSIGNMENT_VARIANTS[status]}>
      {status[0]}
      {status.slice(1).toLowerCase()}
    </Badge>
  );
}
