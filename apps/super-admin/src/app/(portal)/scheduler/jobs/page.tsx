'use client';

import * as React from 'react';
import Link from 'next/link';

import { Skeleton } from '@/components/ui/skeleton';
import { ADMIN_ROUTES } from '@/constants/routes';
import { KpiCard } from '@/features/dashboard/components/kpi-card';
import { fmtInt } from '@/features/dashboard/components/format';
import { EmptyNote } from '@/features/dashboard/components/ui';
import { JobActions } from '@/features/scheduler/components/job-actions';
import { RunChip, SchedulerFrame, StatusDot, fmtDT, relative, useNow } from '@/features/scheduler/components/kit';
import { toSchedulerError, useSchedulerDashboard, useSchedulerJobs } from '@/features/scheduler/hooks/use-scheduler';
import type { JobCategory } from '@/features/scheduler/types';
import { ErrorNote, CountChips, PagerBar } from '@/features/tenants/components/detail/tabs/_shared/kit';

const CATEGORIES: JobCategory[] = ['MEMBERSHIP', 'ATTENDANCE', 'PAYMENT', 'NOTIFICATION', 'REPORT', 'MAINTENANCE'];

export default function SchedulerJobsPage() {
  const [category, setCategory] = React.useState<JobCategory | ''>('');
  const [page, setPage] = React.useState(1);
  const jobs = useSchedulerJobs({ category: category || undefined, page, limit: 12 });
  const dash = useSchedulerDashboard();
  const now = useNow();

  return (
    <SchedulerFrame title="Jobs" subtitle="Every registered background job: schedule, health and manual controls. Each action asks for inline confirmation.">
      {dash.data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard index={0} label="Scheduled" value={dash.data.scheduledJobs} format={fmtInt} color="var(--chart-1)" fallbackCaption="On a cron schedule" />
          <KpiCard index={1} label="Running now" value={dash.data.runningJobs} format={fmtInt} color="var(--chart-2)" fallbackCaption="Active executions" />
          <KpiCard index={2} label="Failed" value={dash.data.failedJobs} format={fmtInt} invert color="var(--chart-5)" fallbackCaption="Last run failed" />
          <KpiCard index={3} label="Paused / cancelled" value={dash.data.pausedJobs} format={fmtInt} color="var(--chart-4)" fallbackCaption="Not on schedule" />
        </div>
      ) : null}

      <CountChips
        label="Category"
        value={category}
        onChange={(v) => { setCategory(v); setPage(1); }}
        options={[{ value: '' as JobCategory | '', label: 'All' }, ...CATEGORIES.map((c) => ({ value: c as JobCategory | '', label: c.charAt(0) + c.slice(1).toLowerCase() }))]}
      />

      {jobs.isError ? <ErrorNote what="jobs" message={toSchedulerError(jobs.error).message} onRetry={() => void jobs.refetch()} /> : null}
      {jobs.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-[14px]" />)}</div>
      ) : jobs.data ? (
        jobs.data.items.length === 0 ? (
          <EmptyNote>No jobs registered{category ? ' in this category' : ''}.</EmptyNote>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {jobs.data.items.map((j) => (
                <article key={j.id} className="min-w-0 space-y-3 rounded-[14px] border bg-card p-4">
                  <div className="flex items-start gap-2">
                    <StatusDot status={j.isPaused ? 'PAUSED' : j.lastStatus ?? j.status} className="mt-1.5" />
                    <div className="min-w-0 flex-1">
                      <Link href={`${ADMIN_ROUTES.scheduler}/jobs/${j.name}`} className="block truncate text-sm font-semibold text-primary hover:underline">{j.name}</Link>
                      <p className="text-xs capitalize text-muted-foreground">{j.category.toLowerCase()}</p>
                    </div>
                    <RunChip status={j.status} />
                  </div>
                  <p className="truncate rounded-md bg-muted px-2 py-1 font-mono text-[11px]" title={`${j.cronPattern} (${j.timezone})`}>{j.cronPattern}</p>
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <div><dt className="text-muted-foreground">Last run</dt><dd className="font-medium" title={fmtDT(j.lastRunAt)}>{j.lastRunAt ? relative(j.lastRunAt, now) : 'never'}</dd></div>
                    <div><dt className="text-muted-foreground">Next run</dt><dd className="font-medium" title={fmtDT(j.nextRunAt)}>{j.nextRunAt ? relative(j.nextRunAt, now) : '—'}</dd></div>
                  </dl>
                  <JobActions job={j} />
                </article>
              ))}
            </div>
            <PagerBar page={jobs.data.page} totalPages={jobs.data.totalPages} total={jobs.data.total} onPage={setPage} />
          </>
        )
      ) : null}
    </SchedulerFrame>
  );
}
