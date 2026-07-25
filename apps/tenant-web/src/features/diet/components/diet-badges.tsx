import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { DietProgressStatus, MemberDietPlanStatus } from '../types';

const PROGRESS_STYLES: Record<DietProgressStatus, string> = {
  PENDING: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  COMPLETED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  SKIPPED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
};

const PROGRESS_LABELS: Record<DietProgressStatus, string> = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  SKIPPED: 'Skipped',
};

const ASSIGNMENT_STYLES: Record<MemberDietPlanStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  COMPLETED: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  CANCELLED: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

export function DietProgressBadge({ status }: { status: DietProgressStatus }) {
  return <Badge className={cn('border-transparent font-medium', PROGRESS_STYLES[status])}>{PROGRESS_LABELS[status]}</Badge>;
}

export function DietAssignmentStatusBadge({ status }: { status: MemberDietPlanStatus }) {
  return <Badge className={cn('border-transparent font-medium', ASSIGNMENT_STYLES[status])}>{status[0]}{status.slice(1).toLowerCase()}</Badge>;
}
