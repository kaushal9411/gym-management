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
import { toSchedulerError, useRetryFailedJob, useSchedulerFailedJobs } from '@/features/scheduler/hooks/use-scheduler';
import type { JobExecution } from '@/features/scheduler/types';

export default function SchedulerFailedJobsPage() {
  const [page, setPage] = React.useState(1);
  const canRetry = useHasPermission('scheduler:retry');

  const { data, isLoading } = useSchedulerFailedJobs({ page, limit: 20 });
  const retry = useRetryFailedJob();

  const columns: DataTableColumn<JobExecution>[] = [
    {
      key: 'job',
      header: 'Job',
      render: (e) => (
        <Link href={`${ADMIN_ROUTES.scheduler}/jobs/${e.jobName}`} className="font-medium text-primary hover:underline">
          {e.jobName}
        </Link>
      ),
    },
    { key: 'trigger', header: 'Trigger', render: (e) => <span className="capitalize">{e.trigger.toLowerCase()}</span> },
    { key: 'attempt', header: 'Attempt', render: (e) => e.attempt },
    { key: 'started', header: 'Started', render: (e) => new Date(e.startedAt).toLocaleString() },
    { key: 'duration', header: 'Duration', render: (e) => (e.durationMs != null ? `${e.durationMs} ms` : '—') },
    { key: 'error', header: 'Error', render: (e) => <span className="text-destructive">{e.error ?? '—'}</span> },
    {
      key: 'actions',
      header: 'Actions',
      render: (e) =>
        canRetry ? (
          <Button
            size="sm"
            variant="outline"
            disabled={retry.isPending}
            onClick={() =>
              retry.mutate(e.jobName, { onSuccess: () => toast.success(`${e.jobName} retry enqueued.`), onError: (err) => toast.error(toSchedulerError(err).message) })
            }
          >
            Retry
          </Button>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor: 'color-mix(in oklch, var(--destructive) 16%, transparent)',
            color: 'var(--destructive)',
            boxShadow: '0 0 0 1px color-mix(in oklch, var(--destructive) 18%, transparent)',
          }}
        >
          <Clock className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Failed Jobs</h1>
          <p className="text-muted-foreground">Every failed execution, newest first — retry individually from here.</p>
        </div>
      </div>

      <SchedulerSubNav />

      {isLoading || !data ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : (
        <>
          <DataTable columns={columns} rows={data.items} rowKey={(e) => e.id} emptyMessage="No failed jobs — everything is running cleanly." />
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
