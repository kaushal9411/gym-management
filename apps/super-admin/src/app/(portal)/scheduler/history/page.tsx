'use client';

import * as React from 'react';
import Link from 'next/link';

import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ADMIN_ROUTES } from '@/constants/routes';
import { EmptyNote, Panel } from '@/features/dashboard/components/ui';
import { RunChip, STATUS_COLOR, SchedulerFrame, fmtDT, fmtMs } from '@/features/scheduler/components/kit';
import { toSchedulerError, useSchedulerJobHistory } from '@/features/scheduler/hooks/use-scheduler';
import type { JobRunStatus } from '@/features/scheduler/types';
import { CountChips, ErrorNote, MixBar, PagerBar, Stat, StatRow, TableScroll, tdClass, thClass } from '@/features/tenants/components/detail/tabs/_shared/kit';

const STATUSES: JobRunStatus[] = ['COMPLETED', 'FAILED', 'RUNNING', 'PENDING', 'SCHEDULED', 'CANCELLED', 'PAUSED'];

export default function SchedulerHistoryPage() {
  const [jobName, setJobName] = React.useState('');
  const [status, setStatus] = React.useState<JobRunStatus | ''>('');
  const [page, setPage] = React.useState(1);
  const { data, isLoading, isError, error, refetch } = useSchedulerJobHistory({ jobName: jobName || undefined, status: status || undefined, page, limit: 20 });

  const items = data?.items ?? [];
  const timed = items.filter((e) => e.durationMs !== null);
  const avg = timed.length ? timed.reduce((a, e) => a + (e.durationMs ?? 0), 0) / timed.length : null;
  const slow = timed.reduce((a, e) => Math.max(a, e.durationMs ?? 0), 0);
  const failed = items.filter((e) => e.status === 'FAILED').length;

  return (
    <SchedulerFrame title="Job history" subtitle="Every execution across all jobs: scheduled, manual and retry runs, newest first.">
      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Filter by job name…" aria-label="Filter by job name" value={jobName} onChange={(e) => { setJobName(e.target.value); setPage(1); }} className="h-9 max-w-xs rounded-[9px] bg-card" />
        <CountChips label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: '' as JobRunStatus | '', label: 'All' }, ...STATUSES.map((s) => ({ value: s as JobRunStatus | '', label: s.charAt(0) + s.slice(1).toLowerCase() }))]} />
      </div>

      {isError ? <ErrorNote what="execution history" message={toSchedulerError(error).message} onRetry={() => void refetch()} /> : null}
      {isLoading || !data ? (
        <Skeleton className="h-72 rounded-[14px]" />
      ) : (
        <>
          <StatRow>
            <Stat index={0} label="Matching executions" value={String(data.total)} caption="all pages" />
            <Stat index={1} label="Failed on this page" value={String(failed)} caption={`of ${items.length} shown`} tone={failed ? 'bad' : undefined} />
            <Stat index={2} label="Avg duration" value={fmtMs(avg)} caption="this page" />
            <Stat index={3} label="Slowest run" value={fmtMs(timed.length ? slow : null)} caption="this page" />
          </StatRow>
          <Panel title="Outcomes on this page" index={1}>
            {items.length === 0 ? <EmptyNote>No execution history{jobName || status ? ' matches these filters' : ' yet'}.</EmptyNote> : (
              <MixBar label="Outcomes" items={STATUSES.map((s) => ({ label: s.charAt(0) + s.slice(1).toLowerCase(), value: items.filter((e) => e.status === s).length, color: STATUS_COLOR[s] })).filter((x) => x.value > 0)} />
            )}
          </Panel>
          {items.length > 0 ? (
            <Panel title="Executions" index={2} hint={`page ${data.page} of ${data.totalPages}`}>
              <TableScroll label="Execution history">
                <table className="w-full min-w-[720px] border-collapse">
                  <thead><tr>{['Job', 'Status', 'Trigger', 'Attempt', 'Started', 'Finished', 'Duration'].map((h) => <th key={h} className={thClass}>{h}</th>)}</tr></thead>
                  <tbody>
                    {items.map((e) => (
                      <tr key={e.id}>
                        <td className={tdClass}><Link href={`${ADMIN_ROUTES.scheduler}/jobs/${e.jobName}`} className="font-medium text-primary hover:underline">{e.jobName}</Link></td>
                        <td className={tdClass}><RunChip status={e.status} /></td>
                        <td className={`${tdClass} capitalize`}>{e.trigger.toLowerCase()}</td>
                        <td className={`${tdClass} tabular-nums`}>{e.attempt}</td>
                        <td className={`${tdClass} whitespace-nowrap`}>{fmtDT(e.startedAt)}</td>
                        <td className={`${tdClass} whitespace-nowrap`}>{fmtDT(e.finishedAt)}</td>
                        <td className={`${tdClass} tabular-nums`}>{fmtMs(e.durationMs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
              <PagerBar page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />
            </Panel>
          ) : null}
        </>
      )}
    </SchedulerFrame>
  );
}
