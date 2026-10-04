'use client';

/**
 * /audit-logs — banner, KPI tiles, activity chart, action breakdown, filters, table | timeline view with inline row details.
 * Data: GET /admin/audit-logs (server filter = exact `action`, paged 25) plus a latest-100 sample (same action filter) for charts/KPIs/
 * action picker. Actor/entity/date filters run client-side on the loaded page (the API has no such params).
 * Dropped: before/after diff viewer — the list endpoint does not return the before/after JSON (nothing is faked); IP/user-agent likewise.
 */
import * as React from 'react';
import { useReducedMotion } from 'framer-motion';
import { ChevronDown, ChevronRight, ScrollText, SearchX } from 'lucide-react';
import { Bar as RBar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/features/dashboard/components/kpi-card';
import { ChartTooltip, EmptyNote, Panel, Segmented } from '@/features/dashboard/components/ui';
import { actionColor, fmtInt, shortDate } from '@/features/dashboard/components/format';
import { useNow } from '@/features/dashboard/components/use-now';
import { Banner } from '@/features/payments/components/pay-kit';
import { ListFooter } from '@/features/tenants/components/list/list-table';
import { ErrorNote, TableScroll, fmtDateTime, relTime, tdClass, thClass } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { useAuditLogs } from '../hooks/use-audit';
import type { AuditLogEntry } from '../types';

const AXIS = { fontSize: 11, fill: 'var(--muted-foreground)' } as const;
const FIELD = 'h-9 rounded-[9px] border border-input bg-card px-2.5 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring';

function Details({ log }: { log: AuditLogEntry }) {
  const rows: Array<[string, string]> = [['Action', log.action], ['Entity type', log.entityType ?? '—'], ['Entity ID', log.entityId ?? '—'], ['Actor', log.adminUser ? `${log.adminUser.name} <${log.adminUser.email}>` : 'System'], ['Role', log.actorRole ?? '—'], ['Time', fmtDateTime(log.createdAt)], ['Entry ID', log.id]];
  return (
    <dl className="grid gap-x-6 gap-y-2 text-[12.5px] sm:grid-cols-2">
      {rows.map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-[11px] font-medium text-muted-foreground">{k}</dt><dd className="break-all font-mono">{v}</dd></div>)}
    </dl>
  );
}

export function AuditPage() {
  const reduce = !!useReducedMotion();
  const now = useNow();
  const [action, setAction] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(25);
  const [actor, setActor] = React.useState('');
  const [entity, setEntity] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [view, setView] = React.useState<'table' | 'timeline'>('table');
  const [openId, setOpenId] = React.useState<string | null>(null);

  const list = useAuditLogs({ action: action || undefined, page, limit });
  const sample = useAuditLogs({ action: action || undefined, page: 1, limit: 100 });
  const sItems = React.useMemo(() => sample.data?.items ?? [], [sample.data]);

  const actions = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const l of sItems) m.set(l.action, (m.get(l.action) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [sItems]);
  const daily = React.useMemo(() => {
    if (now === null) return [];
    const days: Array<{ date: string; label: string; count: number }> = [];
    for (let i = 13; i >= 0; i--) { const d = new Date(now - i * 86_400_000).toISOString().slice(0, 10); days.push({ date: d, label: shortDate(d), count: 0 }); }
    for (const l of sItems) { const r = days.find((d) => d.date === l.createdAt.slice(0, 10)); if (r) r.count += 1; }
    return days;
  }, [sItems, now]);
  const actors = new Set(sItems.map((l) => l.adminUser?.email ?? 'system'));
  const last24 = now === null ? 0 : sItems.filter((l) => now - new Date(l.createdAt).getTime() < 86_400_000).length;
  const risky = sItems.filter((l) => /suspend|delete|fail|revoke|force|impersonate/i.test(l.action)).length;
  const sampleNote = sample.data && sample.data.total > sItems.length ? `latest ${sItems.length} of ${fmtInt(sample.data.total)}` : `all ${fmtInt(sample.data?.total ?? 0)} entries`;

  const rows = React.useMemo(() => {
    const a = actor.trim().toLowerCase(); const e = entity.trim().toLowerCase();
    return (list.data?.items ?? []).filter((l) => {
      if (a && !`${l.adminUser?.name ?? 'system'} ${l.adminUser?.email ?? ''} ${l.actorRole ?? ''}`.toLowerCase().includes(a)) return false;
      if (e && !`${l.entityType ?? ''} ${l.entityId ?? ''}`.toLowerCase().includes(e)) return false;
      const day = l.createdAt.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    });
  }, [list.data, actor, entity, from, to]);
  const clientFiltered = !!(actor || entity || from || to);
  const reset = () => { setAction(''); setActor(''); setEntity(''); setFrom(''); setTo(''); setPage(1); };
  const topMax = actions[0]?.[1] ?? 1;
  const entityText = (l: AuditLogEntry) => (l.entityType ? `${l.entityType}${l.entityId ? ` · ${l.entityId.slice(0, 8)}…` : ''}` : '—');
  const toggle = (id: string) => setOpenId((c) => (c === id ? null : id));

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <Banner>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><ScrollText className="size-6" aria-hidden />Audit logs</h1>
        <p className="mt-0.5 text-[13px] text-teal-100" aria-live="polite">{sample.data ? `${fmtInt(sample.data.total)} recorded admin actions${action ? ` matching ${action}` : ''}` : 'Every admin action — login, tenant, subscription, payment and settings changes'}</p>
      </Banner>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard index={0} label="Total entries" value={sample.data?.total ?? 0} format={fmtInt} color="var(--chart-1)" fallbackCaption={action ? 'for this action' : 'all time'} />
        <KpiCard index={1} label="Last 24 hours" value={last24} format={fmtInt} color="var(--chart-2)" fallbackCaption={`from ${sampleNote}`} />
        <KpiCard index={2} label="Distinct actors" value={actors.size} format={fmtInt} color="var(--chart-3)" fallbackCaption={sampleNote} />
        <KpiCard index={3} label="Sensitive actions" value={risky} format={fmtInt} color="var(--chart-5)" fallbackCaption="suspend / delete / revoke / force" />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel title="Activity" hint="last 14 days" index={4} className="lg:col-span-2">
          {sample.isPending ? <Skeleton className="h-[200px]" /> : !daily.some((d) => d.count) ? <EmptyNote>No recorded activity in the last 14 days.</EmptyNote> : (
            <div className="h-[200px] w-full" role="img" aria-label="Audit entries per day, last 14 days">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} minTickGap={16} />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.5 }} content={<ChartTooltip fmt={fmtInt} names={{ count: 'Entries' }} />} />
                  <RBar dataKey="count" fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive={!reduce} animationDuration={250} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
        <Panel title="Top actions" hint={sampleNote} index={5}>
          {sample.isPending ? <Skeleton className="h-[200px]" /> : actions.length === 0 ? <EmptyNote>No entries.</EmptyNote> : (
            <ul className="space-y-2">
              {actions.slice(0, 7).map(([a, c]) => (
                <li key={a}>
                  <button type="button" onClick={() => { setAction(a); setPage(1); }} className="block w-full rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" title="Filter by this action">
                    <span className="flex items-center justify-between gap-2 text-xs"><span className="truncate font-mono">{a}</span><b className="tabular-nums">{c}</b></span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${(c / topMax) * 100}%`, background: actionColor(a) }} /></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">Action (server filter)
          <select className={FIELD} value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
            <option value="">All actions</option>
            {action && !actions.some(([a]) => a === action) ? <option value={action}>{action}</option> : null}
            {actions.map(([a]) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">Actor<input className={`${FIELD} w-40`} placeholder="Name, email, role" value={actor} onChange={(e) => setActor(e.target.value)} /></label>
        <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">Entity<input className={`${FIELD} w-40`} placeholder="Type or ID" value={entity} onChange={(e) => setEntity(e.target.value)} /></label>
        <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">From<input type="date" className={FIELD} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">To<input type="date" className={FIELD} value={to} onChange={(e) => setTo(e.target.value)} /></label>
        {(action || clientFiltered) ? <button type="button" onClick={reset} className="h-9 text-[13px] font-medium text-primary hover:underline">Reset</button> : null}
        <div className="ml-auto"><Segmented label="View" value={view} onChange={setView} options={[{ value: 'table', label: 'Table' }, { value: 'timeline', label: 'Timeline' }]} /></div>
      </div>
      {clientFiltered ? <p className="text-xs text-muted-foreground">Actor, entity and date filters apply to the {list.data?.items.length ?? 0} entries on this page.</p> : null}

      <section aria-label="Audit entries" aria-busy={list.isFetching} className="overflow-hidden rounded-[14px] border bg-card">
        {list.isError ? <div className="p-4"><ErrorNote what="audit logs" message={list.error?.message} onRetry={() => void list.refetch()} /></div> : list.isPending ? (
          <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
        ) : rows.length === 0 ? (
          <div className="grid place-items-center gap-2 px-4 py-14 text-center"><SearchX className="size-8 text-muted-foreground" aria-hidden /><p className="font-semibold">No audit entries match</p><button type="button" onClick={reset} className="text-[13px] font-medium text-primary hover:underline">Reset filters</button></div>
        ) : view === 'table' ? (
          <TableScroll label="Audit log entries">
            <table className="w-full min-w-[820px] border-collapse">
              <thead><tr><th className={thClass} aria-label="Expand" />{['Action', 'Entity', 'Actor', 'Role', 'When'].map((h) => <th key={h} scope="col" className={thClass}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((l) => (
                  <React.Fragment key={l.id}>
                    <tr className="hover:bg-muted/40">
                      <td className={`${tdClass} w-8`}><button type="button" aria-expanded={openId === l.id} aria-label={`Details for ${l.action}`} onClick={() => toggle(l.id)} className="grid size-6 place-items-center rounded-md hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">{openId === l.id ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}</button></td>
                      <td className={tdClass}><span className="inline-flex items-center gap-2 font-mono text-xs"><i className="size-2 rounded-full" style={{ background: actionColor(l.action) }} aria-hidden />{l.action}</span></td>
                      <td className={tdClass}>{entityText(l)}</td>
                      <td className={tdClass}>{l.adminUser?.name ?? 'System'}</td>
                      <td className={tdClass}>{l.actorRole ?? '—'}</td>
                      <td className={`${tdClass} whitespace-nowrap text-muted-foreground`} title={fmtDateTime(l.createdAt)}>{relTime(l.createdAt, now)}</td>
                    </tr>
                    {openId === l.id ? <tr><td colSpan={6} className="border-b bg-muted/30 px-4 py-3"><Details log={l} /></td></tr> : null}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </TableScroll>
        ) : (
          <ol className="relative space-y-1 px-4 py-4">
            <span aria-hidden className="absolute bottom-4 left-[27px] top-4 w-px bg-border" />
            {rows.map((l) => (
              <li key={l.id} className="relative pl-9">
                <i className="absolute left-[7px] top-3 size-3 rounded-full ring-4 ring-card" style={{ background: actionColor(l.action) }} aria-hidden />
                <button type="button" aria-expanded={openId === l.id} onClick={() => toggle(l.id)} className="w-full rounded-lg px-2 py-1.5 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3"><span className="font-mono text-[12.5px] font-semibold">{l.action}</span><span className="text-xs text-muted-foreground">{relTime(l.createdAt, now)}</span></span>
                  <span className="block text-xs text-muted-foreground">{l.adminUser?.name ?? 'System'}{l.actorRole ? ` (${l.actorRole})` : ''} · {entityText(l)}</span>
                </button>
                {openId === l.id ? <div className="mb-2 ml-2 rounded-lg border bg-muted/30 p-3"><Details log={l} /></div> : null}
              </li>
            ))}
          </ol>
        )}
        {list.data ? <ListFooter page={list.data.page} limit={list.data.limit} total={list.data.total} totalPages={Math.max(1, list.data.totalPages)} onPage={setPage} onLimit={(n) => { setLimit(n); setPage(1); }} /> : null}
      </section>
    </div>
  );
}
