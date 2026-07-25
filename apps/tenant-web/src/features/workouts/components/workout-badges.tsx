import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ExerciseProgressStatus, MemberWorkoutPlanStatus, WorkoutLevel } from '../types';

const PROGRESS_STYLES: Record<ExerciseProgressStatus, string> = {
  PENDING: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  COMPLETED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  SKIPPED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
};

const PROGRESS_LABELS: Record<ExerciseProgressStatus, string> = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  SKIPPED: 'Skipped',
};

const ASSIGNMENT_STYLES: Record<MemberWorkoutPlanStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  COMPLETED: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  CANCELLED: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

export function ExerciseProgressBadge({ status }: { status: ExerciseProgressStatus }) {
  return <Badge className={cn('border-transparent font-medium', PROGRESS_STYLES[status])}>{PROGRESS_LABELS[status]}</Badge>;
}

export function WorkoutAssignmentStatusBadge({ status }: { status: MemberWorkoutPlanStatus }) {
  return <Badge className={cn('border-transparent font-medium', ASSIGNMENT_STYLES[status])}>{status[0]}{status.slice(1).toLowerCase()}</Badge>;
}

export function WorkoutLevelBadge({ level }: { level: WorkoutLevel }) {
  return <Badge variant="secondary">{level[0]}{level.slice(1).toLowerCase()}</Badge>;
}
