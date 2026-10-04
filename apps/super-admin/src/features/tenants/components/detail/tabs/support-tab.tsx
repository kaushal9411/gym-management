'use client';

/**
 * Support tab. Data: GET …/support/tickets (server-side status filter + pagination; `counts` ignore the filter).
 * Rows link to the existing /support/[ticketId] page. Oldest-open age is computed client-side from the loaded page
 * (exact when all open tickets fit on it — the KPI caption says so otherwise).
 */
import * as React from 'react';
import Link from 'next/link';

import { Chip, EmptyNote, Panel } from '@/features/dashboard/components/ui';
import { useNow } from '@/features/dashboard/components/use-now';
import { useTenantTickets, type TabTicketStatus } from '../../../api/tabs';
import { CountChips, ErrorNote, PagerBar, Stat, StatRow, TabSkeleton, TableScroll, fmtDateTime, relTime, statusLabel, statusTone, tdClass, thClass, type TabProps } from './_shared/kit';

const LIMIT = 20;
type Filter = 'ALL' | TabTicketStatus;

export function SupportTab({ tenantId }: TabProps) {
  const [filter, setFilter] = React.useState<Filter>('ALL');
  const [page, setPage] = React.useState(1);
  const now = useNow(60_000);
  const q = useTenantTickets(tenantId, { status: filter === 'ALL' ? undefined : filter, page, limit: LIMIT });

  if (q.isLoading) return <TabSkeleton rows={4} />;
  if (q.isError) return <ErrorNote what="support tickets" message={q.error?.message} onRetry={() => void q.refetch()} />;
  const data = q.data;
  if (!data) return null;
  const c = data.counts;
  if (c.all === 0) return <EmptyNote>No tickets from this tenant.</EmptyNote>;

  const open = data.items.filter((t) => t.status === 'OPEN');
  const oldest = open.length ? Math.min(...open.map((t) => new Date(t.createdAt).getTime())) : null;
  const age = oldest === null || now === null ? '—' : relTime(new Date(oldest).toISOString(), now).replace(' ago', '');

  return (
    <div className="space-y-4">
      <StatRow>
        <Stat index={0} label="Open" value={String(c.open)} caption="not yet picked up" tone={c.open ? 'bad' : undefined} />
        <Stat index={1} label="In progress" value={String(c.inProgress)} />
        <Stat index={2} label="Resolved" value={String(c.resolved)} caption={`${c.closed} closed`} />
        <Stat index={3} label="Oldest open" value={c.open === 0 ? 'None' : age} caption={c.open === 0 ? 'No open tickets' : filter === 'ALL' || filter === 'OPEN' ? 'on loaded page' : 'switch to All to compute'} />
      </StatRow>
      <Panel title="Tickets" hint={`${data.total}`} index={1}>
        <div className="mb-3">
          <CountChips<Filter> label="Ticket status" value={filter} onChange={(v) => { setFilter(v); setPage(1); }} options={[
            { value: 'ALL', label: 'All', count: c.all }, { value: 'OPEN', label: 'Open', count: c.open }, { value: 'IN_PROGRESS', label: 'In progress', count: c.inProgress },
            { value: 'RESOLVED', label: 'Resolved', count: c.resolved }, { value: 'CLOSED', label: 'Closed', count: c.closed },
          ]} />
        </div>
        {data.items.length === 0 ? <EmptyNote>No {statusLabel(filter).toLowerCase()} tickets.</EmptyNote> : (
          <div className={q.isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <TableScroll label="Support tickets">
              <table className="w-full min-w-[640px] border-collapse">
                <thead><tr><th className={thClass}>Subject</th><th className={thClass}>Priority</th><th className={thClass}>Status</th><th className={thClass}>Created</th><th className={thClass}>Last update</th></tr></thead>
                <tbody>
                  {data.items.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/40">
                      <td className={tdClass}>
                        <Link href={`/support/${t.id}`} className="font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring">{t.subject}</Link>
                        <span className="block text-xs text-muted-foreground">{t.createdByName ?? t.createdByEmail}{t.assignedAdmin ? ` · assigned to ${t.assignedAdmin.name}` : ''}</span>
                      </td>
                      <td className={tdClass}><Chip tone={statusTone(t.priority)}>{statusLabel(t.priority)}</Chip></td>
                      <td className={tdClass}><Chip tone={statusTone(t.status)}>{statusLabel(t.status)}</Chip></td>
                      <td className={`${tdClass} whitespace-nowrap`}>{fmtDateTime(t.createdAt)}</td>
                      <td className={`${tdClass} whitespace-nowrap`}>{relTime(t.updatedAt, now)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
            <PagerBar page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />
          </div>
        )}
      </Panel>
    </div>
  );
}
