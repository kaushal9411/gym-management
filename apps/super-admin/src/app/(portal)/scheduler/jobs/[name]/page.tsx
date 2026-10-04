'use client';

import { useParams } from 'next/navigation';

import { Skeleton } from '@/components/ui/skeleton';
import { ADMIN_ROUTES } from '@/constants/routes';
import { Panel } from '@/features/dashboard/components/ui';
import { JobActions } from '@/features/scheduler/components/job-actions';
import { DurationTimeline } from '@/features/scheduler/components/run-charts';
import { RunChip, SchedulerFrame, fmtDT, fmtMs, relative, useNow } from '@/features/scheduler/components/kit';
import { toSchedulerError, useSchedulerJob } from '@/features/scheduler/hooks/use-scheduler';
import { BackLink, NotFoundCard } from '@/features/payments/components/pay-kit';
import { MixBar, Stat, StatRow, TableScroll, tdClass, thClass } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { STATUS_COLOR } from '@/features/scheduler/components/kit';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2 text-[13px] last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium">{value}</dd>
    </div>
  );
}

export default function SchedulerJobDetailPage() {
  const params = useParams<{ name: string }>();
  const name = decodeURIComponent(params.name);
  const { data: job, isLoading, isError, error, refetch } = useSchedulerJob(name);
  const now = useNow();

  if (isError) return <NotFoundCard what="Job" message={toSchedulerError(error).message} backHref={`${ADMIN_ROUTES.scheduler}/jobs`} backLabel="Back to jobs" onRetry={() => void refetch()} />;
  if (isLoading || !job) return <div className="space-y-4"><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-64 rounded-[14px]" /></div>;

  const runs = job.recentExecutions;
  const done = runs.filter((e) => e.status === 'COMPLETED').length;
  const failed = runs.filter((e) => e.status === 'FAILED').length;
  const finished = done + failed;
  const timed = runs.filter((e) => e.durationMs !== null);
  const avg = timed.length ? timed.reduce((a, e) => a + (e.durationMs ?? 0), 0) / timed.length : null;
  const hasFailed = failed > 0;
  const mix = (['COMPLETED', 'FAILED', 'RUNNING', 'PENDING', 'CANCELLED'] as const).map((s) => ({ label: s.charAt(0) + s.slice(1).toLowerCase(), value: runs.filter((e) => e.status === s).length, color: STATUS_COLOR[s] }));

  return (
    <SchedulerFrame
      above={<BackLink href={`${ADMIN_ROUTES.scheduler}/jobs`}><span className="text-teal-100">All jobs</span></BackLink>}
      title={job.name}
      subtitle={job.description ?? `${job.category.toLowerCase()} job on queue ${job.queueName}`}
      chips={<><RunChip status={job.status} /><span className="rounded-full bg-white/15 px-2 py-0.5 font-mono text-[11px] font-semibold">{job.cronPattern}</span></>}
    >
      <StatRow>
        <Stat index={0} label="Last run" value={job.lastRunAt ? relative(job.lastRunAt, now) : 'never'} caption={job.lastStatus ? job.lastStatus.toLowerCase() : fmtDT(job.lastRunAt)} tone={job.lastStatus === 'FAILED' ? 'bad' : undefined} />
        <Stat index={1} label="Next run" value={job.nextRunAt ? relative(job.nextRunAt, now) : '—'} caption={fmtDT(job.nextRunAt)} />
        <Stat index={2} label="Success rate" value={finished ? `${Math.round((done / finished) * 100)}%` : '—'} caption={`last ${runs.length} runs`} tone={finished && failed === 0 ? 'good' : failed ? 'bad' : undefined} />
        <Stat index={3} label="Avg duration" value={fmtMs(avg)} caption={`${timed.length} timed runs`} />
      </StatRow>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel title="Duration per run" hint="oldest to newest, coloured by outcome" className="lg:col-span-2" index={1}>
          <DurationTimeline runs={runs} />
          <div className="mt-3"><MixBar items={mix} label="Recent outcomes" /></div>
        </Panel>
        <Panel title="Actions" hint="each asks to confirm" index={2}>
          <JobActions job={job} showRetry={hasFailed} size="default" />
          {hasFailed ? null : <p className="mt-2 text-xs text-muted-foreground">Retry appears when a recent execution failed.</p>}
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel title="Configuration" index={3}>
          <dl>
            <Row label="Category" value={<span className="capitalize">{job.category.toLowerCase()}</span>} />
            <Row label="Queue" value={<span className="font-mono text-xs">{job.queueName}</span>} />
            <Row label="Timezone" value={job.timezone} />
            <Row label="Priority" value={job.priority} />
            <Row label="Max retries" value={job.maxRetries} />
            <Row label="Retry delay" value={fmtMs(job.retryDelayMs)} />
            <Row label="Timeout" value={fmtMs(job.timeoutMs)} />
          </dl>
        </Panel>
        <Panel title="Recent executions" hint={`${runs.length} shown`} className="lg:col-span-2" index={4}>
          {runs.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">No executions yet.</p>
          ) : (
            <TableScroll label="Recent executions">
              <table className="w-full min-w-[640px] border-collapse">
                <thead><tr>{['Status', 'Trigger', 'Attempt', 'Started', 'Duration', 'Error'].map((h) => <th key={h} className={thClass}>{h}</th>)}</tr></thead>
                <tbody>
                  {runs.map((e) => (
                    <tr key={e.id}>
                      <td className={tdClass}><RunChip status={e.status} /></td>
                      <td className={`${tdClass} capitalize`}>{e.trigger.toLowerCase()}</td>
                      <td className={`${tdClass} tabular-nums`}>{e.attempt}</td>
                      <td className={`${tdClass} whitespace-nowrap`}>{fmtDT(e.startedAt)}</td>
                      <td className={`${tdClass} tabular-nums`}>{fmtMs(e.durationMs)}</td>
                      <td className={`${tdClass} max-w-[260px]`}>{e.error ? <span className="line-clamp-2 break-words text-red-700 dark:text-red-400" title={e.error}>{e.error}</span> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </Panel>
      </div>
    </SchedulerFrame>
  );
}
