'use client';

/**
 * /support — gradient banner, KPI tiles, charts, status/priority chips, ticket table.
 * Data: GET /admin/support/tickets only. Status totals = four `limit=1` queries read for `total`. Charts/aging use the
 * latest 100 tickets (API max) and say so. Dropped: SLA targets (no SLA data), CSAT/response time (not stored), assignee filter UI
 * (the endpoint supports it but there is no admin picker endpoint wired here). Search filters the loaded page only.
 */
import * as React from 'react';
import Link from 'next/link';
import { useReducedMotion } from 'framer-motion';
import { LifeBuoy, Search, SearchX } from 'lucide-react';
import { Bar as RBar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/features/dashboard/components/kpi-card';
import { ChartTooltip, EmptyNote, Panel } from '@/features/dashboard/components/ui';
import { fmtInt, shortDate } from '@/features/dashboard/components/format';
import { useNow } from '@/features/dashboard/components/use-now';
import { BANNER_BTN, Banner } from '@/features/payments/components/pay-kit';
import { ListFooter } from '@/features/tenants/components/list/list-table';
import { CountChips, ErrorNote, MixBar, TableScroll, relTime, statusLabel, tdClass, thClass } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { useTickets } from '../hooks/use-tickets';
import type { TicketPriority, TicketStatus } from '../types';
import { AgeBadge, PRIORITIES, PRIORITY_COLOR, STATUSES, STATUS_COLOR, TicketPriorityChip, TicketStatusChip, ageDays, fmtAge, isLive } from './support-kit';

const AXIS = { fontSize: 11, fill: 'var(--muted-foreground)' } as const;

export function SupportPage() {
  const reduce = !!useReducedMotion();
  const now = useNow();
  const [status, setStatus] = React.useState<TicketStatus | 'ALL'>('ALL');
  const [priority, setPriority] = React.useState<TicketPriority | 'ALL'>('ALL');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(20);
  const [q, setQ] = React.useState('');

  const list = useTickets({ status: status === 'ALL' ? undefined : status, priority: priority === 'ALL' ? undefined : priority, page, limit });
  const open = useTickets({ status: 'OPEN', page: 1, limit: 1 });
  const prog = useTickets({ status: 'IN_PROGRESS', page: 1, limit: 1 });
  const resolved = useTickets({ status: 'RESOLVED', page: 1, limit: 1 });
  const closed = useTickets({ status: 'CLOSED', page: 1, limit: 1 });
  const sample = useTickets({ page: 1, limit: 100 });

  const counts: Record<TicketStatus, number | undefined> = { OPEN: open.data?.total, IN_PROGRESS: prog.data?.total, RESOLVED: resolved.data?.total, CLOSED: closed.data?.total };
  const all = STATUSES.every((s) => counts[s] !== undefined) ? STATUSES.reduce((a, s) => a + (counts[s] ?? 0), 0) : undefined;

  const rows = React.useMemo(() => {
    const items = list.data?.items ?? [];
    const t = q.trim().toLowerCase();
    return t ? items.filter((x) => `${x.subject} ${x.tenant?.name ?? ''} ${x.createdByEmail}`.toLowerCase().includes(t)) : items;
  }, [list.data, q]);

  // ---- charts from the latest-100 sample ----
  const items = React.useMemo(() => sample.data?.items ?? [], [sample.data]);
  const daily = React.useMemo(() => {
    if (now === null) return [];
    const days: Array<{ date: string; label: string; count: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * 86_400_000).toISOString().slice(0, 10);
      days.push({ date: d, label: shortDate(d), count: 0 });
    }
    for (const t of items) { const row = days.find((d) => d.date === t.createdAt.slice(0, 10)); if (row) row.count += 1; }
    return days;
  }, [items, now]);
  const live = items.filter((t) => isLive(t.status));
  const buckets = [
    { label: '< 1 day', color: 'var(--chart-6)', value: live.filter((t) => ageDays(t.createdAt, now) < 1).length },
    { label: '1–3 days', color: 'var(--chart-2)', value: live.filter((t) => { const d = ageDays(t.createdAt, now); return d >= 1 && d < 3; }).length },
    { label: '3–7 days', color: 'var(--chart-4)', value: live.filter((t) => { const d = ageDays(t.createdAt, now); return d >= 3 && d < 7; }).length },
    { label: '7+ days', color: 'var(--chart-5)', value: live.filter((t) => ageDays(t.createdAt, now) >= 7).length },
  ];
  const oldest = live.length && now !== null ? Math.max(...live.map((t) => ageDays(t.createdAt, now))) : null;
  const urgentLive = live.filter((t) => t.priority === 'URGENT' || t.priority === 'HIGH').length;
  const sampleNote = sample.data && sample.data.total > sample.data.items.length ? `latest ${sample.data.items.length} of ${fmtInt(sample.data.total)}` : `all ${fmtInt(sample.data?.total ?? 0)} tickets`;

  const statusChips = [{ value: 'ALL', label: 'All', count: all }, ...STATUSES.map((s) => ({ value: s, label: statusLabel(s), count: counts[s] }))];
  const priorityChips = [{ value: 'ALL', label: 'Any priority' }, ...PRIORITIES.map((p) => ({ value: p, label: statusLabel(p) }))];
  const reset = () => { setStatus('ALL'); setPriority('ALL'); setQ(''); setPage(1); };

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <Banner>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><LifeBuoy className="size-6" aria-hidden />Support</h1>
        <p className="mt-0.5 text-[13px] text-teal-100" aria-live="polite">
          {all === undefined ? 'View, assign and resolve support requests' : `${fmtInt(all)} tickets · ${fmtInt(counts.OPEN ?? 0)} open · ${fmtInt(counts.IN_PROGRESS ?? 0)} in progress`}
        </p>
      </Banner>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard index={0} label="Open" value={counts.OPEN ?? 0} format={fmtInt} color="var(--chart-2)" fallbackCaption="awaiting first response" />
        <KpiCard index={1} label="In progress" value={counts.IN_PROGRESS ?? 0} format={fmtInt} color="var(--chart-4)" fallbackCaption="being worked" />
        <KpiCard index={2} label="Resolved + closed" value={(counts.RESOLVED ?? 0) + (counts.CLOSED ?? 0)} format={fmtInt} color="var(--chart-6)" fallbackCaption={`${fmtInt(counts.RESOLVED ?? 0)} resolved · ${fmtInt(counts.CLOSED ?? 0)} closed`} />
        <KpiCard index={3} label="Oldest unresolved" value={oldest ?? 0} format={(v) => (oldest === null ? '—' : fmtAge(v))} color="var(--chart-5)" fallbackCaption={oldest === null ? 'nothing waiting' : `${urgentLive} high/urgent waiting (${sampleNote})`} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel title="Tickets created" hint="last 14 days" index={4} className="lg:col-span-2">
          {sample.isPending ? <Skeleton className="h-[200px]" /> : sample.isError ? <ErrorNote what="ticket trend" message={sample.error?.message} onRetry={() => void sample.refetch()} /> : !daily.some((d) => d.count) ? <EmptyNote>No tickets were created in the last 14 days.</EmptyNote> : (
            <div className="h-[200px] w-full" role="img" aria-label="Tickets created per day, last 14 days">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} minTickGap={16} />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.5 }} content={<ChartTooltip fmt={fmtInt} names={{ count: 'Created' }} />} />
                  <RBar dataKey="count" fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive={!reduce} animationDuration={250} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
        <Panel title="Mix & aging" hint={sampleNote} index={5}>
          {sample.isPending ? <Skeleton className="h-[200px]" /> : items.length === 0 ? <EmptyNote>No tickets yet.</EmptyNote> : (
            <div className="space-y-4">
              <div><p className="mb-1.5 text-xs font-medium text-muted-foreground">By status</p><MixBar label="Status mix" items={STATUSES.map((s) => ({ label: statusLabel(s), value: items.filter((t) => t.status === s).length, color: STATUS_COLOR[s] }))} /></div>
              <div><p className="mb-1.5 text-xs font-medium text-muted-foreground">By priority</p><MixBar label="Priority mix" items={PRIORITIES.map((p) => ({ label: statusLabel(p), value: items.filter((t) => t.priority === p).length, color: PRIORITY_COLOR[p] }))} /></div>
              <div><p className="mb-1.5 text-xs font-medium text-muted-foreground">Unresolved by age</p><MixBar label="Unresolved aging" items={buckets} /></div>
            </div>
          )}
        </Panel>
      </div>

      <div className="space-y-3">
        <CountChips label="Ticket status" value={status} options={statusChips} onChange={(v) => { setStatus(v as TicketStatus | 'ALL'); setPage(1); }} />
        <div className="flex flex-wrap items-center gap-2">
          <CountChips label="Ticket priority" value={priority} options={priorityChips} onChange={(v) => { setPriority(v as TicketPriority | 'ALL'); setPage(1); }} />
          <label className="relative ml-auto w-full sm:w-64">
            <span className="sr-only">Search this page of tickets</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search this page…" className="h-9 w-full rounded-[9px] border border-input bg-card pl-8 pr-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
        </div>
        <section aria-label="Tickets" aria-busy={list.isFetching} className="overflow-hidden rounded-[14px] border bg-card">
          {list.isError ? <div className="p-4"><ErrorNote what="tickets" message={list.error?.message} onRetry={() => void list.refetch()} /></div> : list.isPending ? (
            <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
          ) : rows.length === 0 ? (
            <div className="grid place-items-center gap-2 px-4 py-14 text-center">
              <SearchX className="size-8 text-muted-foreground" aria-hidden />
              <p className="font-semibold">No tickets match these filters</p>
              <button type="button" onClick={reset} className="text-[13px] font-medium text-primary hover:underline">Reset filters</button>
            </div>
          ) : (
            <TableScroll label="Support tickets">
              <table className="w-full min-w-[920px] border-collapse">
                <thead><tr>{['Subject', 'Tenant', 'Requester', 'Priority', 'Status', 'Age', 'Assigned to', 'Created'].map((h) => <th key={h} scope="col" className={thClass}>{h}</th>)}</tr></thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/40">
                      <td className={`${tdClass} max-w-[320px]`}><Link href={`/support/${t.id}`} className="block truncate font-semibold text-primary underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring">{t.subject}</Link></td>
                      <td className={tdClass}>{t.tenant?.name ?? '—'}</td>
                      <td className={`${tdClass} max-w-[220px] truncate`}>{t.createdByEmail}</td>
                      <td className={tdClass}><TicketPriorityChip priority={t.priority} /></td>
                      <td className={tdClass}><TicketStatusChip status={t.status} /></td>
                      <td className={tdClass}><AgeBadge iso={t.createdAt} status={t.status} now={now} /></td>
                      <td className={tdClass}>{t.assignedAdmin?.name ?? <span className="text-muted-foreground">Unassigned</span>}</td>
                      <td className={`${tdClass} whitespace-nowrap text-muted-foreground`} title={new Date(t.createdAt).toLocaleString()}>{relTime(t.createdAt, now)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
          {list.data ? <ListFooter page={list.data.page} limit={list.data.limit} total={list.data.total} totalPages={Math.max(1, list.data.totalPages)} onPage={setPage} onLimit={(n) => { setLimit(n); setPage(1); }} /> : null}
        </section>
      </div>
    </div>
  );
}
