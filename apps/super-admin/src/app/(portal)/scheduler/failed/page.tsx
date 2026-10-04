'use client';

import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

import { Skeleton } from '@/components/ui/skeleton';
import { ADMIN_ROUTES } from '@/constants/routes';
import { useHasPermission } from '@/features/auth/hooks/use-auth';
import { EmptyNote, Panel } from '@/features/dashboard/components/ui';
import { GrowBar } from '@/features/plans/components/bars';
import { ActionBar, SchedulerFrame, fmtDT, fmtMs, relative, useNow } from '@/features/scheduler/components/kit';
import { toSchedulerError, useRetryFailedJob, useSchedulerFailedJobs } from '@/features/scheduler/hooks/use-scheduler';
import { ErrorNote, PagerBar, Stat, StatRow } from '@/features/tenants/components/detail/tabs/_shared/kit';

export default function SchedulerFailedJobsPage() {
  const [page, setPage] = React.useState(1);
  const canRetry = useHasPermission('scheduler:retry');
  const { data, isLoading, isError, error, refetch } = useSchedulerFailedJobs({ page, limit: 12 });
  const retry = useRetryFailedJob();
  const now = useNow();

  const items = React.useMemo(() => data?.items ?? [], [data]);
  const byJob = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const e of items) m.set(e.jobName, (m.get(e.jobName) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [items]);

  return (
    <SchedulerFrame title="Failed jobs" subtitle="Every failed execution, newest first, with the recorded error. Retrying asks for inline confirmation.">
      {isError ? <ErrorNote what="failed jobs" message={toSchedulerError(error).message} onRetry={() => void refetch()} /> : null}
      {isLoading || !data ? (
        <Skeleton className="h-72 rounded-[14px]" />
      ) : (
        <>
          <StatRow>
            <Stat index={0} label="Failed executions" value={String(data.total)} caption="all time" tone={data.total ? 'bad' : 'good'} />
            <Stat index={1} label="Jobs affected" value={String(new Set(items.map((e) => e.jobName)).size)} caption="on this page" />
            <Stat index={2} label="Latest failure" value={items[0] ? relative(items[0].startedAt, now) : '—'} caption={items[0]?.jobName ?? 'none'} />
            <Stat index={3} label="Retry" value={canRetry ? 'Allowed' : 'Read only'} caption="scheduler:retry" />
          </StatRow>

          {items.length === 0 ? (
            <EmptyNote>No failed jobs. Everything is running cleanly.</EmptyNote>
          ) : (
            <div className="grid gap-3 lg:grid-cols-3">
              <Panel title="Failures by job" hint="this page" index={1}>
                <ul className="space-y-3">
                  {byJob.map(([name, n]) => (
                    <li key={name}>
                      <div className="mb-1 flex gap-2 text-[13px]"><span className="truncate font-medium">{name}</span><span className="ml-auto tabular-nums text-muted-foreground">{n}</span></div>
                      <GrowBar pct={(n / byJob[0]![1]) * 100} color="var(--chart-5)" />
                    </li>
                  ))}
                </ul>
              </Panel>
              <div className="space-y-3 lg:col-span-2">
                {items.map((e) => (
                  <article key={e.id} className="min-w-0 space-y-2 rounded-[14px] border bg-card p-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Link href={`${ADMIN_ROUTES.scheduler}/jobs/${e.jobName}`} className="text-sm font-semibold text-primary hover:underline">{e.jobName}</Link>
                      <span className="text-xs text-muted-foreground">{fmtDT(e.startedAt)} · {fmtMs(e.durationMs)} · attempt {e.attempt} · <span className="capitalize">{e.trigger.toLowerCase()}</span></span>
                    </div>
                    <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-mono text-[11.5px] text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{e.error ?? 'No error message recorded.'}</pre>
                    {canRetry ? (
                      <ActionBar
                        actions={[{
                          key: 'retry', label: 'Retry', title: `Retry ${e.jobName}?`, text: 'Re-enqueues this job’s most recent failed execution.', confirmLabel: 'Retry', busy: retry.isPending,
                          run: async () => {
                            try { await retry.mutateAsync(e.jobName); toast.success(`${e.jobName} retry enqueued.`); } catch (err) { toast.error(toSchedulerError(err).message); }
                          },
                        }]}
                      />
                    ) : null}
                  </article>
                ))}
                <PagerBar page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />
              </div>
            </div>
          )}
        </>
      )}
    </SchedulerFrame>
  );
}
