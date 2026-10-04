'use client';

import { toast } from 'sonner';

import { useHasPermission } from '@/features/auth/hooks/use-auth';
import { toSchedulerError, useCancelJob, usePauseJob, useResumeJob, useRetryFailedJob, useTriggerJob } from '../hooks/use-scheduler';
import type { ScheduledJob } from '../types';
import { ActionBar, type ActionDef } from './kit';

/** Run now / Retry failed / Pause / Resume / Cancel for one job — same permission gates as before, each confirmed inline. */
export function JobActions({ job, showRetry = false, size = 'sm' }: { job: Pick<ScheduledJob, 'name' | 'status'>; showRetry?: boolean; size?: 'sm' | 'default' }) {
  const canTrigger = useHasPermission('scheduler:trigger');
  const canPause = useHasPermission('scheduler:pause');
  const canManage = useHasPermission('scheduler:manage');
  const canRetry = useHasPermission('scheduler:retry');
  const trigger = useTriggerJob();
  const pause = usePauseJob();
  const resume = useResumeJob();
  const cancel = useCancelJob();
  const retry = useRetryFailedJob();

  const go = async (p: Promise<unknown>, ok: string) => {
    try {
      await p;
      toast.success(ok);
    } catch (e) {
      toast.error(toSchedulerError(e).message);
    }
  };
  const stopped = job.status === 'PAUSED' || job.status === 'CANCELLED';
  const actions: ActionDef[] = [];
  if (canTrigger) actions.push({ key: 'run', label: 'Run now', title: `Run ${job.name} now?`, text: 'Triggers one manual execution immediately, outside its schedule.', confirmLabel: 'Run now', busy: trigger.isPending, run: () => go(trigger.mutateAsync(job.name), `${job.name} triggered.`) });
  if (canRetry && showRetry) actions.push({ key: 'retry', label: 'Retry failed', title: `Retry the failed run of ${job.name}?`, text: 'Re-enqueues the most recent failed execution.', confirmLabel: 'Retry', busy: retry.isPending, run: () => go(retry.mutateAsync(job.name), 'Retry enqueued.') });
  if (canPause && !stopped) actions.push({ key: 'pause', label: 'Pause', title: `Pause ${job.name}?`, text: 'The job stops running on its schedule until it is resumed.', confirmLabel: 'Pause job', busy: pause.isPending, run: () => go(pause.mutateAsync(job.name), `${job.name} paused.`) });
  if (canManage && stopped) actions.push({ key: 'resume', label: 'Resume', title: `Resume ${job.name}?`, text: 'The job goes back to running on its schedule.', confirmLabel: 'Resume job', busy: resume.isPending, run: () => go(resume.mutateAsync(job.name), `${job.name} resumed.`) });
  if (canManage && job.status !== 'CANCELLED') actions.push({ key: 'cancel', label: 'Cancel', title: `Cancel ${job.name}?`, text: 'Removes the job from the schedule. It can be resumed later.', confirmLabel: 'Cancel job', destructive: true, busy: cancel.isPending, run: () => go(cancel.mutateAsync(job.name), `${job.name} cancelled.`) });
  return <ActionBar actions={actions} size={size} />;
}
