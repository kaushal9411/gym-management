'use client';

import { toast } from 'sonner';

import { Skeleton } from '@/components/ui/skeleton';
import { useHasPermission } from '@/features/auth/hooks/use-auth';
import { KpiCard } from '@/features/dashboard/components/kpi-card';
import { fmtInt } from '@/features/dashboard/components/format';
import { Chip, EmptyNote } from '@/features/dashboard/components/ui';
import { ActionBar, SchedulerFrame, type ActionDef } from '@/features/scheduler/components/kit';
import { toSchedulerError, useClearQueue, usePauseQueue, useResumeQueue, useRetryQueue, useSchedulerQueues } from '@/features/scheduler/hooks/use-scheduler';
import { ErrorNote, MixBar } from '@/features/tenants/components/detail/tabs/_shared/kit';

const PARTS = [
  ['waiting', 'Waiting', 'var(--chart-4)'],
  ['delayed', 'Delayed', 'var(--chart-3)'],
  ['active', 'Active', 'var(--chart-2)'],
  ['completed', 'Completed', 'var(--chart-6)'],
  ['failed', 'Failed', 'var(--chart-5)'],
] as const;

export default function SchedulerQueuesPage() {
  const canRetry = useHasPermission('scheduler:retry');
  const canPause = useHasPermission('scheduler:pause');
  const canManage = useHasPermission('scheduler:manage');
  const { data: queues, isLoading, isError, error, refetch } = useSchedulerQueues();
  const retryQueue = useRetryQueue();
  const clearQueue = useClearQueue();
  const pauseQueue = usePauseQueue();
  const resumeQueue = useResumeQueue();

  const sum = (k: string) => (queues ?? []).reduce((a, q) => a + (q.counts[k] ?? 0), 0);

  return (
    <SchedulerFrame title="Queue monitor" subtitle="One queue per job category: live counts and manual controls. Every action asks for inline confirmation.">
      {isError ? <ErrorNote what="queues" message={toSchedulerError(error).message} onRetry={() => void refetch()} /> : null}
      {isLoading || !queues ? (
        <Skeleton className="h-72 rounded-[14px]" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard index={0} label="Waiting" value={sum('waiting')} format={fmtInt} color="var(--chart-4)" fallbackCaption="Ready to run" />
            <KpiCard index={1} label="Active" value={sum('active')} format={fmtInt} color="var(--chart-2)" fallbackCaption="Running now" />
            <KpiCard index={2} label="Failed" value={sum('failed')} format={fmtInt} invert color="var(--chart-5)" fallbackCaption="Awaiting retry" />
            <KpiCard index={3} label="Paused queues" value={queues.filter((q) => q.isPaused).length} format={fmtInt} color="var(--chart-7)" fallbackCaption={`of ${queues.length} queues`} />
          </div>
          {queues.length === 0 ? <EmptyNote>No queues reported.</EmptyNote> : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {queues.map((q) => {
                const actions: ActionDef[] = [];
                if (canRetry) actions.push({ key: 'retry', label: 'Retry failed', title: `Retry failed jobs in ${q.category.toLowerCase()}?`, text: 'Re-enqueues every failed job in this queue.', confirmLabel: 'Retry all', busy: retryQueue.isPending, run: async () => { try { const r = await retryQueue.mutateAsync(q.queueName); toast.success(`Re-enqueued ${r.retried} failed job(s).`); } catch (e) { toast.error(toSchedulerError(e).message); } } });
                if (canManage) actions.push({ key: 'clear', label: 'Clear backlog', title: `Clear the ${q.category.toLowerCase()} backlog?`, text: `Discards ${q.counts.waiting ?? 0} waiting and ${q.counts.delayed ?? 0} delayed job(s). This cannot be undone.`, confirmLabel: 'Clear backlog', destructive: true, busy: clearQueue.isPending, run: async () => { try { await clearQueue.mutateAsync(q.queueName); toast.success('Queue backlog cleared.'); } catch (e) { toast.error(toSchedulerError(e).message); } } });
                if (canPause && !q.isPaused) actions.push({ key: 'pause', label: 'Pause', title: `Pause the ${q.category.toLowerCase()} queue?`, text: 'Workers stop picking up new jobs until it is resumed.', confirmLabel: 'Pause queue', busy: pauseQueue.isPending, run: async () => { try { await pauseQueue.mutateAsync(q.queueName); toast.success('Queue paused.'); } catch (e) { toast.error(toSchedulerError(e).message); } } });
                if (canManage && q.isPaused) actions.push({ key: 'resume', label: 'Resume', title: `Resume the ${q.category.toLowerCase()} queue?`, text: 'Workers start picking up jobs again.', confirmLabel: 'Resume queue', busy: resumeQueue.isPending, run: async () => { try { await resumeQueue.mutateAsync(q.queueName); toast.success('Queue resumed.'); } catch (e) { toast.error(toSchedulerError(e).message); } } });
                return (
                  <article key={q.queueName} className="min-w-0 space-y-3 rounded-[14px] border bg-card p-4">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold capitalize">{q.category.toLowerCase()}</h2>
                      <Chip tone={q.isPaused ? 'amber' : 'green'}>{q.isPaused ? 'Paused' : 'Running'}</Chip>
                      <span className="ml-auto truncate font-mono text-[11px] text-muted-foreground">{q.queueName}</span>
                    </div>
                    <MixBar label={`${q.category} queue`} items={PARTS.map(([k, label, color]) => ({ label, value: q.counts[k] ?? 0, color }))} />
                    {PARTS.every(([k]) => !(q.counts[k] ?? 0)) ? <p className="text-xs text-muted-foreground">Queue is empty.</p> : null}
                    <ActionBar actions={actions} />
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </SchedulerFrame>
  );
}
