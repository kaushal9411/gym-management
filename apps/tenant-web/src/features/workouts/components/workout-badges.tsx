import { Badge, type BadgeProps } from '@/components/ui/badge';
import type { ExerciseProgressStatus, MemberWorkoutPlanStatus, WorkoutLevel } from '../types';

const PROGRESS_VARIANTS: Record<ExerciseProgressStatus, NonNullable<BadgeProps['variant']>> = {
  PENDING: 'secondary',
  COMPLETED: 'success',
  SKIPPED: 'warning',
};

const PROGRESS_LABELS: Record<ExerciseProgressStatus, string> = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  SKIPPED: 'Skipped',
};

const ASSIGNMENT_VARIANTS: Record<MemberWorkoutPlanStatus, NonNullable<BadgeProps['variant']>> = {
  ACTIVE: 'success',
  COMPLETED: 'secondary',
  CANCELLED: 'outline',
};

export function ExerciseProgressBadge({ status }: { status: ExerciseProgressStatus }) {
  return <Badge variant={PROGRESS_VARIANTS[status]}>{PROGRESS_LABELS[status]}</Badge>;
}

export function WorkoutAssignmentStatusBadge({ status }: { status: MemberWorkoutPlanStatus }) {
  return (
    <Badge variant={ASSIGNMENT_VARIANTS[status]}>
      {status[0]}
      {status.slice(1).toLowerCase()}
    </Badge>
  );
}

export function WorkoutLevelBadge({ level }: { level: WorkoutLevel }) {
  return (
    <Badge variant="secondary">
      {level[0]}
      {level.slice(1).toLowerCase()}
    </Badge>
  );
}
