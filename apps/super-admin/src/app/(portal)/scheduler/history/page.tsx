'use client';

import * as React from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { Pagination } from '@/components/pagination';
import { ADMIN_ROUTES } from '@/constants/routes';
import { SchedulerSubNav } from '@/features/scheduler/components/scheduler-sub-nav';
import { StatusBadge } from '@/features/scheduler/components/status-badge';
import { useSchedulerJobHistory } from '@/features/scheduler/hooks/use-scheduler';
import type { JobExecution, JobRunStatus } from '@/features/scheduler/types';

const STATUSES: JobRunStatus[] = ['PENDING', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PAUSED'];

export default function SchedulerHistoryPage() {
  const [jobName, setJobName] = React.useState('');
  const [status, setStatus] = React.useState<JobRunStatus | ''>('');
  const [page, setPage] = React.useState(1);

  const { data, isLoading } = useSchedulerJobHistory({ jobName: jobName || undefined, status: status || undefined, page, limit: 20 });

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
    { key: 'status', header: 'Status', render: (e) => <StatusBadge status={e.status} /> },
    { key: 'trigger', header: 'Trigger', render: (e) => <span className="capitalize">{e.trigger.toLowerCase()}</span> },
    { key: 'attempt', header: 'Attempt', render: (e) => e.attempt },
    { key: 'started', header: 'Started', render: (e) => new Date(e.startedAt).toLocaleString() },
    { key: 'finished', header: 'Finished', render: (e) => (e.finishedAt ? new Date(e.finishedAt).toLocaleString() : '—') },
    { key: 'duration', header: 'Duration', render: (e) => (e.durationMs != null ? `${e.durationMs} ms` : '—') },
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
          <h1 className="text-2xl font-semibold tracking-tight">Job History</h1>
          <p className="text-muted-foreground">Complete execution history across every job — scheduled, manual, and retry runs.</p>
        </div>
      </div>

      <SchedulerSubNav />

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Filter by job name…"
          value={jobName}
          onChange={(e) => {
            setJobName(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as JobRunStatus | '');
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : (
        <>
          <DataTable columns={columns} rows={data.items} rowKey={(e) => e.id} emptyMessage="No execution history yet." />
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
