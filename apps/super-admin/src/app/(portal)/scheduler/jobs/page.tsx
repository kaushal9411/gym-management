'use client';

import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { Pagination } from '@/components/pagination';
import { ADMIN_ROUTES } from '@/constants/routes';
import { useHasPermission } from '@/features/auth/hooks/use-auth';
import { SchedulerSubNav } from '@/features/scheduler/components/scheduler-sub-nav';
import { StatusBadge } from '@/features/scheduler/components/status-badge';
import { toSchedulerError, useCancelJob, usePauseJob, useResumeJob, useSchedulerJobs, useTriggerJob } from '@/features/scheduler/hooks/use-scheduler';
import type { JobCategory, ScheduledJob } from '@/features/scheduler/types';

const CATEGORIES: JobCategory[] = ['MEMBERSHIP', 'ATTENDANCE', 'PAYMENT', 'NOTIFICATION', 'REPORT', 'MAINTENANCE'];

export default function SchedulerJobsPage() {
  const [category, setCategory] = React.useState<JobCategory | ''>('');
  const [page, setPage] = React.useState(1);

  const canTrigger = useHasPermission('scheduler:trigger');
  const canPause = useHasPermission('scheduler:pause');
  const canManage = useHasPermission('scheduler:manage');

  const jobs = useSchedulerJobs({ category: category || undefined, page, limit: 20 });
  const trigger = useTriggerJob();
  const pause = usePauseJob();
  const resume = useResumeJob();
  const cancel = useCancelJob();

  const columns: DataTableColumn<ScheduledJob>[] = [
    {
      key: 'name',
      header: 'Job',
      render: (j) => (
        <Link href={`${ADMIN_ROUTES.scheduler}/jobs/${j.name}`} className="font-medium text-primary hover:underline">
          {j.name}
        </Link>
      ),
    },
    { key: 'category', header: 'Category', render: (j) => <span className="capitalize">{j.category.toLowerCase()}</span> },
    { key: 'status', header: 'Status', render: (j) => <StatusBadge status={j.status} /> },
    { key: 'cron', header: 'Schedule', render: (j) => <span className="font-mono text-xs">{j.cronPattern}</span> },
    { key: 'next', header: 'Next Run', render: (j) => (j.nextRunAt ? new Date(j.nextRunAt).toLocaleString() : '—') },
    { key: 'last', header: 'Last Run', render: (j) => (j.lastRunAt ? new Date(j.lastRunAt).toLocaleString() : 'never') },
    {
      key: 'actions',
      header: 'Actions',
      render: (j) => (
        <div className="flex gap-2">
          {canTrigger && (
            <Button
              size="sm"
              variant="outline"
              disabled={trigger.isPending}
              onClick={() => trigger.mutate(j.name, { onSuccess: () => toast.success(`${j.name} triggered.`), onError: (e) => toast.error(toSchedulerError(e).message) })}
            >
              Trigger
            </Button>
          )}
          {canPause && j.status !== 'PAUSED' && j.status !== 'CANCELLED' && (
            <Button
              size="sm"
              variant="outline"
              disabled={pause.isPending}
              onClick={() => pause.mutate(j.name, { onSuccess: () => toast.success(`${j.name} paused.`), onError: (e) => toast.error(toSchedulerError(e).message) })}
            >
              Pause
            </Button>
          )}
          {canManage && (j.status === 'PAUSED' || j.status === 'CANCELLED') && (
            <Button
              size="sm"
              variant="outline"
              disabled={resume.isPending}
              onClick={() => resume.mutate(j.name, { onSuccess: () => toast.success(`${j.name} resumed.`), onError: (e) => toast.error(toSchedulerError(e).message) })}
            >
              Resume
            </Button>
          )}
          {canManage && j.status !== 'CANCELLED' && (
            <Button
              size="sm"
              variant="outline"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate(j.name, { onSuccess: () => toast.success(`${j.name} cancelled.`), onError: (e) => toast.error(toSchedulerError(e).message) })}
            >
              Cancel
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
          <h1 className="text-2xl font-semibold tracking-tight">Scheduler &amp; Background Jobs</h1>
          <p className="text-muted-foreground">Every registered background job — schedule, status, and manual controls.</p>
        </div>
      </div>

      <SchedulerSubNav />

      <div className="flex items-center gap-3">
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value as JobCategory | '');
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0) + c.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      {jobs.isLoading || !jobs.data ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : (
        <>
          <DataTable columns={columns} rows={jobs.data.items} rowKey={(j) => j.id} emptyMessage="No jobs registered." />
          <Pagination page={jobs.data.page} totalPages={jobs.data.totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
