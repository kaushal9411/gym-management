import { Badge } from '@/components/ui/badge';
import type { JobRunStatus } from '../types';

const VARIANT: Record<JobRunStatus, 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline'> = {
  PENDING: 'secondary',
  SCHEDULED: 'outline',
  RUNNING: 'warning',
  COMPLETED: 'success',
  FAILED: 'destructive',
  CANCELLED: 'secondary',
  PAUSED: 'secondary',
};

export function StatusBadge({ status }: { status: JobRunStatus }) {
  return <Badge variant={VARIANT[status]}>{status}</Badge>;
}
