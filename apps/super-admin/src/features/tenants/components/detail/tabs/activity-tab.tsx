'use client';

/**
 * Activity tab. Data: GET …/activity (tenant-side audit_logs; filters action prefix, actor, from/to, page/limit — server side).
 * "Actions in this range" is computed client-side over the loaded page. Dropped: free-text "summary" (the endpoint returns
 * action + entity type/id only, so the row shows those instead of an invented sentence). Rows link to /audit-logs (platform log)
 * for admin-plane actions (actor null + SUPER_ADMIN).
 */
import * as React from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { actionColor } from '@/features/dashboard/components/format';
import { EmptyNote, Panel } from '@/features/dashboard/components/ui';
import { useTenantActivity } from '../../../api/tabs';
import { ErrorNote, MixBar, PagerBar, TabSkeleton, TableScroll, fieldClass, fmtDateTime, statusLabel, tdClass, thClass, type TabProps } from './_shared/kit';

const LIMIT = 25;
const FAMILY_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-8)', 'var(--chart-6)', 'var(--chart-7)'];

export function ActivityTab({ tenantId }: TabProps) {
  const [action, setAction] = React.useState('');
  const [actor, setActor] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [seen, setSeen] = React.useState<string[]>([]);
  const [actorDraft, setActorDraft] = React.useState('');

  React.useEffect(() => { const t = window.setTimeout(() => { setActor(actorDraft.trim()); setPage(1); }, 350); return () => window.clearTimeout(t); }, [actorDraft]);

  const bad = !!from && !!to && from > to;
  const q = useTenantActivity(tenantId, { action: action || undefined, actor: actor || undefined, from: bad ? undefined : from || undefined, to: bad ? undefined : to || undefined, page, limit: LIMIT });
  const items = q.data?.items;
  React.useEffect(() => {
    if (!items) return;
    setSeen((prev) => { const s = new Set([...prev, ...items.map((i) => i.action)]); return s.size === prev.length ? prev : [...s].sort(); });
  }, [items]);

  const families = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items ?? []) { const f = i.action.split(/[._]/)[0] ?? i.action; m.set(f, (m.get(f) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: FAMILY_COLORS[i % FAMILY_COLORS.length]! }));
  }, [items]);

  const reset = () => { setAction(''); setActor(''); setActorDraft(''); setFrom(''); setTo(''); setPage(1); };
  const filtered = !!(action || actor || from || to);

  return (
    <div className="space-y-4">
      <Panel title="Filters" index={0}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <label htmlFor="act-action" className="text-xs font-medium text-muted-foreground">Action</label>
            <select id="act-action" className={fieldClass} value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
              <option value="">All actions</option>
              {seen.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="act-actor" className="text-xs font-medium text-muted-foreground">Actor (name, email or role)</label>
            <input id="act-actor" className={fieldClass} value={actorDraft} onChange={(e) => setActorDraft(e.target.value)} placeholder="e.g. owner" />
          </div>
          <div className="space-y-1">
            <label htmlFor="act-from" className="text-xs font-medium text-muted-foreground">From</label>
            <input id="act-from" type="date" className={fieldClass} value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          </div>
          <div className="space-y-1">
            <label htmlFor="act-to" className="text-xs font-medium text-muted-foreground">To</label>
            <input id="act-to" type="date" className={fieldClass} value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </div>
          <div className="flex items-end"><Button variant="outline" size="sm" className="h-9" disabled={!filtered} onClick={reset}>Clear filters</Button></div>
        </div>
        {bad ? <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-400">&ldquo;From&rdquo; is after &ldquo;To&rdquo; — the date range is ignored until fixed.</p> : null}
      </Panel>

      {q.isLoading ? <TabSkeleton kpis={0} rows={6} /> : q.isError ? <ErrorNote what="activity" message={q.error?.message} onRetry={() => void q.refetch()} /> : q.data ? (
        <>
          {families.length > 0 ? <Panel title="Actions in this range" hint={`on this page · ${items!.length} of ${q.data.total}`} index={1}><MixBar label="Actions by family" items={families} /></Panel> : null}
          <Panel title="Activity log" hint={`${q.data.total} entr${q.data.total === 1 ? 'y' : 'ies'}`} index={2} right={<Link href="/audit-logs" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring">Platform audit log <ExternalLink className="size-3" aria-hidden /></Link>}>
            {q.data.items.length === 0 ? <EmptyNote>{filtered ? 'No activity matches these filters.' : 'No activity recorded for this tenant yet.'}</EmptyNote> : (
              <div className={q.isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
                <TableScroll label="Activity log">
                  <table className="w-full min-w-[640px] border-collapse">
                    <thead><tr><th className={thClass}>When</th><th className={thClass}>Action</th><th className={thClass}>Actor</th><th className={thClass}>Entity</th><th className={thClass}>IP</th></tr></thead>
                    <tbody>
                      {q.data.items.map((i) => {
                        const platform = !i.actor && i.actorRole === 'SUPER_ADMIN';
                        return (
                          <tr key={i.id}>
                            <td className={`${tdClass} whitespace-nowrap`}>{fmtDateTime(i.at)}</td>
                            <td className={tdClass}>
                              <span className="inline-flex items-center gap-2 font-mono text-xs"><i className="size-2.5 shrink-0 rounded-full" style={{ background: actionColor(i.action) }} aria-hidden />{i.action}</span>
                            </td>
                            <td className={tdClass}>
                              {i.actor ? <><span className="font-medium">{i.actor.name}</span><span className="block text-xs text-muted-foreground">{statusLabel(i.actorRole ?? '')}</span></>
                                : platform ? <Link href="/audit-logs" className="font-medium text-primary hover:underline">Platform admin</Link>
                                : <span className="text-muted-foreground">{i.actorRole ? statusLabel(i.actorRole) : 'System'}</span>}
                            </td>
                            <td className={`${tdClass} text-xs text-muted-foreground`}>{i.entityType ?? '—'}{i.entityId ? <span className="block max-w-[120px] truncate font-mono" title={i.entityId}>{i.entityId}</span> : null}</td>
                            <td className={`${tdClass} font-mono text-xs`}>{i.ipAddress ?? '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TableScroll>
                <PagerBar page={q.data.page} totalPages={q.data.totalPages} total={q.data.total} onPage={setPage} />
              </div>
            )}
          </Panel>
        </>
      ) : null}
    </div>
  );
}
