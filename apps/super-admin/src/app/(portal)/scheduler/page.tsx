'use client';

import Link from 'next/link';

import { KpiCard } from '@/features/dashboard/components/kpi-card';
import { Chip, EmptyNote, Panel } from '@/features/dashboard/components/ui';
import { fmtInt } from '@/features/dashboard/components/format';
import { GrowBar } from '@/features/plans/components/bars';
import { ADMIN_ROUTES } from '@/constants/routes';
import { ErrorNote } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { Skeleton } from '@/components/ui/skeleton';
import { RunsOverTime, OutcomeDonut, DurationByJob } from '@/features/scheduler/components/run-charts';
import { RunChip, SchedulerFrame, StatusDot, fmtDT, fmtMs, relative, useNow } from '@/features/scheduler/components/kit';
import { toSchedulerError, useSchedulerDashboard, useSchedulerJobs, useSchedulerRecentRuns } from '@/features/scheduler/hooks/use-scheduler';

const HEALTH = { healthy: 'green', degraded: 'amber', unhealthy: 'red' } as const;

export default function SchedulerDashboardPage() {
  const dash = useSchedulerDashboard();
  const jobs = useSchedulerJobs({ page: 1, limit: 100 });
  const runs = useSchedulerRecentRuns();
  const now = useNow();
  const data = dash.data;
  const runItems = runs.data?.items ?? [];
  const failures = runItems.filter((r) => r.status === 'FAILED').slice(0, 5);

  return (
    <SchedulerFrame
      title="Scheduler & background jobs"
      subtitle="Job health, queue depth and execution history across every automated task. Refreshes every 5 seconds."
      chips={data ? <Chip tone={HEALTH[data.queueHealth]} className="capitalize">Queues {data.queueHealth}</Chip> : null}
    >
      {dash.isError ? <ErrorNote what="scheduler overview" message={toSchedulerError(dash.error).message} onRetry={() => void dash.refetch()} /> : null}
      {!data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[88px] rounded-[14px]" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard index={0} label="Running now" value={data.runningJobs} format={fmtInt} color="var(--chart-2)" fallbackCaption="Active executions" />
            <KpiCard index={1} label="Scheduled jobs" value={data.scheduledJobs} format={fmtInt} color="var(--chart-1)" fallbackCaption="On a cron schedule" />
            <KpiCard index={2} label="Failed jobs" value={data.failedJobs} format={fmtInt} invert color="var(--chart-5)" fallbackCaption="Last run failed" />
            <KpiCard index={3} label="Paused / cancelled" value={data.pausedJobs} format={fmtInt} color="var(--chart-4)" fallbackCaption="Not running on schedule" />
            <KpiCard index={4} label="Queue backlog" value={data.queueSize} format={fmtInt} color="var(--chart-3)" fallbackCaption="Waiting + delayed" />
            <KpiCard index={5} label="Avg processing time" value={data.avgProcessingTimeMs} format={fmtMs} color="var(--chart-7)" fallbackCaption="Across recorded runs" />
            <KpiCard index={6} label="Success rate" value={data.successRate} format={(v) => `${Math.round(v * 10) / 10}%`} color="var(--chart-6)" fallbackCaption="Completed vs finished runs" />
            <KpiCard index={7} label="Queues" value={data.workerStatus.length} format={fmtInt} color="var(--chart-8)" fallbackCaption={`${data.workerStatus.filter((q) => q.isPaused).length} paused`} />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Panel title="Runs over time" hint={`last ${runItems.length} runs`} className="lg:col-span-2" index={1}>
              {runs.isError ? <ErrorNote what="execution history" onRetry={() => void runs.refetch()} /> : runs.isLoading ? <Skeleton className="h-[220px]" /> : <RunsOverTime runs={runItems} />}
            </Panel>
            <Panel title="Outcomes" hint={`last ${runItems.length} runs`} index={2}>
              {runs.isLoading ? <Skeleton className="h-[150px]" /> : <OutcomeDonut runs={runItems} />}
            </Panel>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Panel title="Queue depth" hint="per category" index={3} right={<Link href={`${ADMIN_ROUTES.scheduler}/queues`} className="text-xs font-semibold text-primary hover:underline">Manage</Link>}>
              {(() => {
                const max = Math.max(1, ...data.workerStatus.map((q) => (q.counts.waiting ?? 0) + (q.counts.delayed ?? 0) + (q.counts.active ?? 0) + (q.counts.failed ?? 0)));
                return (
                  <ul className="space-y-3">
                    {data.workerStatus.map((q) => {
                      const depth = (q.counts.waiting ?? 0) + (q.counts.delayed ?? 0) + (q.counts.active ?? 0) + (q.counts.failed ?? 0);
                      return (
                        <li key={q.queueName}>
                          <div className="mb-1 flex items-center gap-2 text-[13px]">
                            <span className="font-medium capitalize">{q.category.toLowerCase()}</span>
                            {q.isPaused ? <Chip tone="amber">Paused</Chip> : null}
                            {(q.counts.failed ?? 0) > 0 ? <Chip tone="red">{q.counts.failed} failed</Chip> : null}
                            <span className="ml-auto tabular-nums text-muted-foreground">{depth}</span>
                          </div>
                          <GrowBar pct={(depth / max) * 100} color={(q.counts.failed ?? 0) > 0 ? 'var(--chart-5)' : 'var(--chart-1)'} />
                        </li>
                      );
                    })}
                  </ul>
                );
              })()}
            </Panel>
            <Panel title="Slowest jobs" hint="average duration" index={4}>
              {runs.isLoading ? <Skeleton className="h-[160px]" /> : <DurationByJob runs={runItems} />}
            </Panel>
            <Panel title="Recent failures" index={5} right={<Link href={`${ADMIN_ROUTES.scheduler}/failed`} className="text-xs font-semibold text-primary hover:underline">View all</Link>}>
              {failures.length === 0 ? (
                <EmptyNote>No failures in recent runs.</EmptyNote>
              ) : (
                <ul className="space-y-2.5">
                  {failures.map((f) => (
                    <li key={f.id} className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 text-xs dark:border-red-500/30 dark:bg-red-500/10">
                      <div className="flex items-center gap-2">
                        <Link href={`${ADMIN_ROUTES.scheduler}/jobs/${f.jobName}`} className="truncate font-semibold text-primary hover:underline">{f.jobName}</Link>
                        <span className="ml-auto shrink-0 text-muted-foreground">{relative(f.startedAt, now)}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 break-words text-red-800 dark:text-red-300">{f.error ?? 'No error message recorded.'}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <Panel title="Job health" hint={jobs.data ? `${jobs.data.total} registered` : undefined} index={6} right={<Link href={`${ADMIN_ROUTES.scheduler}/jobs`} className="text-xs font-semibold text-primary hover:underline">All jobs</Link>}>
            {jobs.isLoading ? (
              <Skeleton className="h-32" />
            ) : !jobs.data || jobs.data.items.length === 0 ? (
              <EmptyNote>No jobs registered.</EmptyNote>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {jobs.data.items.map((j) => (
                  <Link key={j.id} href={`${ADMIN_ROUTES.scheduler}/jobs/${j.name}`} className="min-w-0 rounded-xl border p-3 outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring">
                    <div className="flex items-center gap-2">
                      <StatusDot status={j.isPaused ? 'PAUSED' : j.lastStatus ?? j.status} />
                      <span className="truncate text-[13px] font-semibold">{j.name}</span>
                      <span className="ml-auto shrink-0"><RunChip status={j.status} /></span>
                    </div>
                    <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{j.cronPattern}</p>
                    <dl className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                      <div><dt className="text-muted-foreground">Last run</dt><dd className="font-medium" title={fmtDT(j.lastRunAt)}>{j.lastRunAt ? relative(j.lastRunAt, now) : 'never'}</dd></div>
                      <div><dt className="text-muted-foreground">Next run</dt><dd className="font-medium" title={fmtDT(j.nextRunAt)}>{j.nextRunAt ? relative(j.nextRunAt, now) : '—'}</dd></div>
                    </dl>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}
    </SchedulerFrame>
  );
}
