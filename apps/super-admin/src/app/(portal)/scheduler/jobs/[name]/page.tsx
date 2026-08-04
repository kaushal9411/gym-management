'use client';

import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { useHasPermission } from '@/features/auth/hooks/use-auth';
import { SchedulerSubNav } from '@/features/scheduler/components/scheduler-sub-nav';
import { StatusBadge } from '@/features/scheduler/components/status-badge';
import {
  toSchedulerError,
  useCancelJob,
  usePauseJob,
  useResumeJob,
  useRetryFailedJob,
  useSchedulerJob,
  useTriggerJob,
} from '@/features/scheduler/hooks/use-scheduler';
import type { JobExecution } from '@/features/scheduler/types';

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b py-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export default function SchedulerJobDetailPage() {
  const params = useParams<{ name: string }>();
  const name = decodeURIComponent(params.name);

  const canTrigger = useHasPermission('scheduler:trigger');
  const canPause = useHasPermission('scheduler:pause');
  const canManage = useHasPermission('scheduler:manage');
  const canRetry = useHasPermission('scheduler:retry');

  const { data: job, isLoading } = useSchedulerJob(name);
  const trigger = useTriggerJob();
  const pause = usePauseJob();
  const resume = useResumeJob();
  const cancel = useCancelJob();
  const retry = useRetryFailedJob();

  const historyColumns: DataTableColumn<JobExecution>[] = [
    { key: 'status', header: 'Status', render: (e) => <StatusBadge status={e.status} /> },
    { key: 'trigger', header: 'Trigger', render: (e) => <span className="capitalize">{e.trigger.toLowerCase()}</span> },
    { key: 'attempt', header: 'Attempt', render: (e) => e.attempt },
    { key: 'started', header: 'Started', render: (e) => new Date(e.startedAt).toLocaleString() },
    { key: 'duration', header: 'Duration', render: (e) => (e.durationMs != null ? `${e.durationMs} ms` : '—') },
    { key: 'error', header: 'Error', render: (e) => (e.error ? <span className="text-destructive">{e.error}</span> : '—') },
  ];

  if (isLoading || !job) return <Skeleton className="h-96 rounded-xl" />;

  const hasFailedExecution = job.recentExecutions.some((e) => e.status === 'FAILED');

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
          <h1 className="text-2xl font-semibold tracking-tight">{job.name}</h1>
          <p className="text-muted-foreground">{job.description}</p>
        </div>
      </div>

      <SchedulerSubNav />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Category" value={<span className="capitalize">{job.category.toLowerCase()}</span>} />
            <InfoRow label="Status" value={<StatusBadge status={job.status} />} />
            <InfoRow label="Queue" value={job.queueName} />
            <InfoRow label="Schedule (cron)" value={<span className="font-mono">{job.cronPattern}</span>} />
            <InfoRow label="Timezone" value={job.timezone} />
            <InfoRow label="Priority" value={job.priority} />
            <InfoRow label="Max Retries" value={job.maxRetries} />
            <InfoRow label="Retry Delay" value={`${job.retryDelayMs} ms`} />
            <InfoRow label="Timeout" value={`${job.timeoutMs} ms`} />
            <InfoRow label="Last Run" value={job.lastRunAt ? new Date(job.lastRunAt).toLocaleString() : 'never'} />
            <InfoRow label="Last Status" value={job.lastStatus ? <StatusBadge status={job.lastStatus} /> : '—'} />
            <InfoRow label="Next Run" value={job.nextRunAt ? new Date(job.nextRunAt).toLocaleString() : '—'} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {canTrigger && (
              <Button
                disabled={trigger.isPending}
                onClick={() => trigger.mutate(job.name, { onSuccess: () => toast.success('Job triggered.'), onError: (e) => toast.error(toSchedulerError(e).message) })}
              >
                Trigger Manually
              </Button>
            )}
            {canRetry && hasFailedExecution && (
              <Button
                variant="outline"
                disabled={retry.isPending}
                onClick={() => retry.mutate(job.name, { onSuccess: () => toast.success('Retry enqueued.'), onError: (e) => toast.error(toSchedulerError(e).message) })}
              >
                Retry Failed Execution
              </Button>
            )}
            {canPause && job.status !== 'PAUSED' && job.status !== 'CANCELLED' && (
              <Button
                variant="outline"
                disabled={pause.isPending}
                onClick={() => pause.mutate(job.name, { onSuccess: () => toast.success('Job paused.'), onError: (e) => toast.error(toSchedulerError(e).message) })}
              >
                Pause
              </Button>
            )}
            {canManage && (job.status === 'PAUSED' || job.status === 'CANCELLED') && (
              <Button
                variant="outline"
                disabled={resume.isPending}
                onClick={() => resume.mutate(job.name, { onSuccess: () => toast.success('Job resumed.'), onError: (e) => toast.error(toSchedulerError(e).message) })}
              >
                Resume
              </Button>
            )}
            {canManage && job.status !== 'CANCELLED' && (
              <Button
                variant="outline"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate(job.name, { onSuccess: () => toast.success('Job cancelled.'), onError: (e) => toast.error(toSchedulerError(e).message) })}
              >
                Cancel
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Executions</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={historyColumns} rows={job.recentExecutions} rowKey={(e) => e.id} emptyMessage="No executions yet." />
        </CardContent>
      </Card>
    </div>
  );
}
