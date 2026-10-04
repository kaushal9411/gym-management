'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, LifeBuoy, Plus } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { initials } from '@/features/finance/components/payments/payments-ui';
import { ChartCard, EmptyState, FilterChips, type ChipOption } from '@/features/reports/components/ui';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { relativeTo } from '@/features/announcements/lib/announcement-meta';
import { useTicketList } from '../hooks/use-tickets';
import { PRIORITY_META, STATUS_META, SUPPORT_COLOR, tint } from '../lib/ticket-meta';
import type { TicketStatus } from '../types';
import { TicketPriorityBadge, TicketStatusBadge } from './ticket-badges';

type Filter = 'all' | TicketStatus;

const LIMIT = 10;

/** Tickets table card: status chips with server counts, animated rows, pagination. Page index is tied to the filter (no reset effect). */
export function TicketList({ enabled, onView, onCreate }: { enabled: boolean; onView: (id: string) => void; onCreate?: () => void }) {
  const m = useMotionSafe();
  const [filter, setFilter] = React.useState<Filter>('all');
  const [pageState, setPageState] = React.useState<{ key: Filter; page: number }>({ key: 'all', page: 1 });
  const page = pageState.key === filter ? pageState.page : 1;
  const query = useTicketList({ page, limit: LIMIT, ...(filter === 'all' ? {} : { status: filter }) }, enabled);
  const data = query.data;
  const counts = data?.counts;

  const options: ChipOption[] = [
    { value: 'all', label: 'All', count: counts?.all },
    { value: 'OPEN', label: 'Open', count: counts?.open, dotColor: STATUS_META.OPEN.color },
    { value: 'IN_PROGRESS', label: 'In progress', count: counts?.inProgress, dotColor: STATUS_META.IN_PROGRESS.color },
    { value: 'RESOLVED', label: 'Resolved', count: counts?.resolved, dotColor: STATUS_META.RESOLVED.color },
    { value: 'CLOSED', label: 'Closed', count: counts?.closed, dotColor: STATUS_META.CLOSED.color },
  ];
  const items = data?.items ?? [];
  const now = Date.now();

  return (
    <ChartCard
      title="Support tickets"
      subtitle="Track and raise issues directly with our team."
      actions={onCreate ? (
        <Button size="sm" onClick={onCreate}>
          <Plus className="size-4" /> New ticket
        </Button>
      ) : undefined}
      minHeight={260}
    >
      <div className="space-y-4">
        <FilterChips options={options} value={filter} onChange={(v) => setFilter(v as Filter)} accent="operations" />
        {query.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[68px] animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : query.error ? (
          <EmptyState title="Could not load tickets" description="Please try again." accent="staff" action={<Button variant="outline" size="sm" onClick={() => void query.refetch()}>Retry</Button>} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={LifeBuoy}
            title={filter === 'all' ? 'No tickets yet' : `No ${STATUS_META[filter].label.toLowerCase()} tickets`}
            description={filter === 'all' ? 'Raise one if you run into an issue.' : 'Try another status.'}
          />
        ) : (
          <ul className="space-y-2" aria-busy={query.isFetching}>
            <AnimatePresence initial={false} mode="popLayout">
              {items.map((t, i) => {
                const pr = PRIORITY_META[t.priority];
                return (
                  <motion.li
                    key={t.id}
                    layout={m.reduce ? false : 'position'}
                    initial={m.reduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 8) * 0.04, duration: 0.3 } }}
                    exit={{ opacity: 0 }}
                  >
                    <button
                      type="button"
                      onClick={() => onView(t.id)}
                      className="group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border bg-card py-3 pl-5 pr-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: pr.color }} />
                      <span className="hidden size-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold sm:flex" style={{ backgroundColor: tint(SUPPORT_COLOR, 16), color: SUPPORT_COLOR }}>
                        {initials(t.createdByName ?? t.createdByEmail)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{t.subject}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{t.description}</span>
                        <span className="mt-1 block text-[11px] font-semibold text-muted-foreground">Raised {relativeTo(t.createdAt, now)} · {new Date(t.createdAt).toLocaleDateString()}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                        <TicketPriorityBadge priority={t.priority} />
                        <TicketStatusBadge status={t.status} />
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
        {data ? <Pagination page={page} totalPages={data.totalPages} onPageChange={(p) => setPageState({ key: filter, page: p })} totalItems={data.total} pageSize={data.limit} /> : null}
      </div>
    </ChartCard>
  );
}
