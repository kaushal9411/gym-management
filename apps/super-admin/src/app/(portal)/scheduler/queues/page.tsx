'use client';

import { toast } from 'sonner';
import { Clock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { useHasPermission } from '@/features/auth/hooks/use-auth';
import { SchedulerSubNav } from '@/features/scheduler/components/scheduler-sub-nav';
import { toSchedulerError, useClearQueue, usePauseQueue, useResumeQueue, useRetryQueue, useSchedulerQueues } from '@/features/scheduler/hooks/use-scheduler';
import type { QueueStatus } from '@/features/scheduler/types';

export default function SchedulerQueuesPage() {
  const canRetry = useHasPermission('scheduler:retry');
  const canPause = useHasPermission('scheduler:pause');
  const canManage = useHasPermission('scheduler:manage');

  const { data: queues, isLoading } = useSchedulerQueues();
  const retryQueue = useRetryQueue();
  const clearQueue = useClearQueue();
  const pauseQueue = usePauseQueue();
  const resumeQueue = useResumeQueue();

  const columns: DataTableColumn<QueueStatus>[] = [
    { key: 'category', header: 'Category', render: (q) => <span className="capitalize">{q.category.toLowerCase()}</span> },
    { key: 'queue', header: 'Queue', render: (q) => <span className="font-mono text-xs">{q.queueName}</span> },
    { key: 'status', header: 'Status', render: (q) => <Badge variant={q.isPaused ? 'warning' : 'success'}>{q.isPaused ? 'Paused' : 'Running'}</Badge> },
    { key: 'waiting', header: 'Waiting', render: (q) => q.counts.waiting ?? 0 },
    { key: 'delayed', header: 'Delayed', render: (q) => q.counts.delayed ?? 0 },
    { key: 'active', header: 'Active', render: (q) => q.counts.active ?? 0 },
    { key: 'completed', header: 'Completed', render: (q) => q.counts.completed ?? 0 },
    { key: 'failed', header: 'Failed', render: (q) => <span className={q.counts.failed ? 'font-semibold text-destructive' : ''}>{q.counts.failed ?? 0}</span> },
    {
      key: 'actions',
      header: 'Actions',
      render: (q) => (
        <div className="flex gap-2">
          {canRetry && (
            <Button
              size="sm"
              variant="outline"
              disabled={retryQueue.isPending}
              onClick={() =>
                retryQueue.mutate(q.queueName, {
                  onSuccess: (r) => toast.success(`Re-enqueued ${r.retried} failed job(s).`),
                  onError: (e) => toast.error(toSchedulerError(e).message),
                })
              }
            >
              Retry Failed
            </Button>
          )}
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              disabled={clearQueue.isPending}
              onClick={() =>
                clearQueue.mutate(q.queueName, { onSuccess: () => toast.success('Queue backlog cleared.'), onError: (e) => toast.error(toSchedulerError(e).message) })
              }
            >
              Clear Backlog
            </Button>
          )}
          {canPause && !q.isPaused && (
            <Button
              size="sm"
              variant="outline"
              disabled={pauseQueue.isPending}
              onClick={() => pauseQueue.mutate(q.queueName, { onSuccess: () => toast.success('Queue paused.'), onError: (e) => toast.error(toSchedulerError(e).message) })}
            >
              Pause
            </Button>
          )}
          {canManage && q.isPaused && (
            <Button
              size="sm"
              variant="outline"
              disabled={resumeQueue.isPending}
              onClick={() => resumeQueue.mutate(q.queueName, { onSuccess: () => toast.success('Queue resumed.'), onError: (e) => toast.error(toSchedulerError(e).message) })}
            >
              Resume
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor: 'color-mix(in oklch, var(--chart-4) 16%, transparent)',
            color: 'var(--chart-4)',
            boxShadow: '0 0 0 1px color-mix(in oklch, var(--chart-4) 18%, transparent)',
          }}
        >
          <Clock className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Queue Monitor</h1>
          <p className="text-muted-foreground">One queue per job category — live counts, health, and manual controls.</p>
        </div>
      </div>

      <SchedulerSubNav />

      {isLoading || !queues ? <Skeleton className="h-72 rounded-xl" /> : <DataTable columns={columns} rows={queues} rowKey={(q) => q.queueName} />}
    </div>
  );
}
