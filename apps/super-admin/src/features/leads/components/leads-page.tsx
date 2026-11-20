'use client';

/**
 * /leads — everyone who used the public website contact form (and the trial/billing screens).
 * Data: GET /admin/leads only (search, status and topic filters run on the server; the status counts come with
 * every response and ignore the filters, so the chips never jump). Row click opens the detail dialog.
 */
import * as React from 'react';
import { Inbox, Search, SearchX } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/features/dashboard/components/kpi-card';
import { fmtInt } from '@/features/dashboard/components/format';
import { useNow } from '@/features/dashboard/components/use-now';
import { Banner } from '@/features/payments/components/pay-kit';
import { ListFooter } from '@/features/tenants/components/list/list-table';
import { CountChips, ErrorNote, MixBar, TableScroll, relTime, tdClass, thClass } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { useLeads } from '../hooks/use-leads';
import type { Lead, LeadStatus, LeadTopic } from '../types';
import { LEAD_STATUSES, LEAD_TOPICS, LeadStatusChip, LeadTopicChip, SIZE_LABEL, STATUS_COLOR, STATUS_LABEL, TOPIC_LABEL } from './lead-kit';
import { LeadDetailDialog } from './lead-detail-dialog';

/** Waits for typing to pause so every keystroke is not a request. */
function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function LeadsPage() {
  const now = useNow();
  const [status, setStatus] = React.useState<LeadStatus | 'ALL'>('ALL');
  const [topic, setTopic] = React.useState<LeadTopic | 'ALL'>('ALL');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(20);
  const [q, setQ] = React.useState('');
  const search = useDebounced(q.trim());
  const [opened, setOpened] = React.useState<Lead | null>(null);

  const list = useLeads({
    status: status === 'ALL' ? undefined : status,
    topic: topic === 'ALL' ? undefined : topic,
    search: search || undefined,
    page,
    limit,
  });
  const stats = list.data?.stats;
  // The dialog shows whichever copy is newest: the one in the live list, or the one it last saved itself.
  // So it keeps showing the right status even if the active filter then hides the lead from the table.
  const live = opened ? list.data?.items.find((l) => l.id === opened.id) : undefined;
  const open = opened && live && live.updatedAt >= opened.updatedAt ? live : opened;

  const statusChips = [{ value: 'ALL', label: 'All', count: stats?.total }, ...LEAD_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s], count: stats?.byStatus[s] }))];
  const topicChips = [{ value: 'ALL', label: 'Any topic' }, ...LEAD_TOPICS.map((t) => ({ value: t, label: TOPIC_LABEL[t] }))];
  const reset = () => {
    setStatus('ALL');
    setTopic('ALL');
    setQ('');
    setPage(1);
  };
  const filtered = status !== 'ALL' || topic !== 'ALL' || search !== '';

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <Banner>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Inbox className="size-6" aria-hidden />
          Leads
        </h1>
        <p className="mt-0.5 text-[13px] text-teal-100" aria-live="polite">
          {stats ? `${fmtInt(stats.total)} enquiries from the website · ${fmtInt(stats.byStatus.NEW)} waiting for a first reply` : 'Enquiries from the website contact form'}
        </p>
      </Banner>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard index={0} label="New" value={stats?.byStatus.NEW ?? 0} format={fmtInt} color="var(--chart-2)" fallbackCaption="not replied to yet" />
        <KpiCard index={1} label="Contacted" value={stats?.byStatus.CONTACTED ?? 0} format={fmtInt} color="var(--chart-4)" fallbackCaption="waiting on the lead" />
        <KpiCard index={2} label="Qualified" value={stats?.byStatus.QUALIFIED ?? 0} format={fmtInt} color="var(--chart-3)" fallbackCaption="real prospects" />
        <KpiCard index={3} label="Won" value={stats?.byStatus.WON ?? 0} format={fmtInt} color="var(--chart-6)" fallbackCaption={`${fmtInt(stats?.byStatus.LOST ?? 0)} lost`} />
      </div>

      {stats && stats.total > 0 ? (
        <section aria-label="Pipeline" className="rounded-[14px] border bg-card p-4">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Pipeline</p>
          <MixBar label="Leads by status" items={LEAD_STATUSES.map((s) => ({ label: STATUS_LABEL[s], value: stats.byStatus[s], color: STATUS_COLOR[s] }))} />
        </section>
      ) : null}

      <div className="space-y-3">
        <CountChips label="Lead status" value={status} options={statusChips} onChange={(v) => { setStatus(v as LeadStatus | 'ALL'); setPage(1); }} />
        <div className="flex flex-wrap items-center gap-2">
          <CountChips label="Lead topic" value={topic} options={topicChips} onChange={(v) => { setTopic(v as LeadTopic | 'ALL'); setPage(1); }} />
          <label className="relative ml-auto w-full sm:w-72">
            <span className="sr-only">Search leads by name, email, gym or phone</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Search name, email, gym, phone…"
              className="h-9 w-full rounded-[9px] border border-input bg-card pl-8 pr-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </div>

        <section aria-label="Leads" aria-busy={list.isFetching} className="overflow-hidden rounded-[14px] border bg-card">
          {list.isError && !list.data ? (
            <div className="p-4"><ErrorNote what="leads" message={list.error?.message} onRetry={() => void list.refetch()} /></div>
          ) : list.isPending ? (
            <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
          ) : list.data.items.length === 0 ? (
            <div className="grid place-items-center gap-2 px-4 py-14 text-center">
              {filtered ? <SearchX className="size-8 text-muted-foreground" aria-hidden /> : <Inbox className="size-8 text-muted-foreground" aria-hidden />}
              <p className="font-semibold">{filtered ? 'No leads match these filters' : 'No leads yet'}</p>
              {filtered ? (
                <button type="button" onClick={reset} className="text-[13px] font-medium text-primary hover:underline">Reset filters</button>
              ) : (
                <p className="max-w-sm text-[13px] text-muted-foreground">When someone fills in the contact form on the website home page, they will show up here.</p>
              )}
            </div>
          ) : (
            <TableScroll label="Leads">
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr>{['Name', 'Gym', 'Topic', 'Contact', 'Status', 'Received'].map((h) => <th key={h} scope="col" className={thClass}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {list.data.items.map((l) => (
                    <tr key={l.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setOpened(l)}>
                      <td className={`${tdClass} max-w-[240px]`}>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setOpened(l); }} className="block max-w-full truncate text-left font-semibold text-primary underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                          {l.name}
                        </button>
                      </td>
                      <td className={`${tdClass} max-w-[220px]`}>
                        <span className="block truncate">{l.gymName ?? l.gymSlug ?? <span className="text-muted-foreground">—</span>}</span>
                        {l.gymSize ? <span className="block truncate text-xs text-muted-foreground">{SIZE_LABEL[l.gymSize] ?? l.gymSize}</span> : null}
                      </td>
                      <td className={tdClass}><LeadTopicChip topic={l.topic} /></td>
                      <td className={`${tdClass} max-w-[240px]`}>
                        <span className="block truncate">{l.email}</span>
                        {l.phone ? <span className="block truncate text-xs text-muted-foreground">{l.phone}</span> : null}
                      </td>
                      <td className={tdClass}><LeadStatusChip status={l.status} /></td>
                      <td className={`${tdClass} whitespace-nowrap text-muted-foreground`} title={new Date(l.createdAt).toLocaleString()}>{relTime(l.createdAt, now)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
          {list.data ? <ListFooter page={list.data.page} limit={list.data.limit} total={list.data.total} totalPages={Math.max(1, list.data.totalPages)} onPage={setPage} onLimit={(n) => { setLimit(n); setPage(1); }} /> : null}
        </section>
      </div>

      <LeadDetailDialog lead={open} onChange={setOpened} onClose={() => setOpened(null)} />
    </div>
  );
}
