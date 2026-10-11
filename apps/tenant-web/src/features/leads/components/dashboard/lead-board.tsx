'use client';

import * as React from 'react';

import { EmptyState, SkeletonBlock } from '@/features/reports/components/ui';
import { STATUS_META } from '../../lib/lead-meta';
import { LEAD_STATUSES, type LeadCounts, type LeadListItem, type LeadStatus } from '../../types';
import { LeadCard } from './lead-card';

/** Kanban board: one column per status. Counts come from the API `counts` (all filters except status). */
export function LeadBoard({ items, counts, total, status, loading, canUpdate }: { items: LeadListItem[]; counts: LeadCounts | undefined; total: number; status: LeadStatus | ''; loading: boolean; canUpdate: boolean }) {
  const columns = status ? [status] : LEAD_STATUSES;
  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} height={280} />)}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {total > items.length ? <p className="text-xs text-muted-foreground">Showing the {items.length} most recently active of {total} matching leads. Narrow the filters or use the table to see the rest.</p> : null}
      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]" role="list" aria-label="Pipeline board">
        {columns.map((st) => {
          const m = STATUS_META[st];
          const col = items.filter((l) => l.status === st);
          return (
            <section key={st} role="listitem" aria-label={m.label} className="flex w-[272px] shrink-0 flex-col rounded-2xl border bg-muted/30">
              <header className="flex items-center justify-between gap-2 border-b px-3 py-2.5" style={{ backgroundImage: `linear-gradient(100deg, color-mix(in oklch, ${m.color} 14%, transparent), transparent 85%)` }}>
                <h3 className="flex items-center gap-1.5 text-[13px] font-extrabold">
                  <span className="size-2 rounded-full" style={{ backgroundColor: m.color }} aria-hidden />
                  {m.label}
                </h3>
                <span className="rounded-full bg-card px-2 py-0.5 text-xs font-bold tabular-nums shadow-xs">{counts ? counts[st] : col.length}</span>
              </header>
              <div className="flex max-h-[640px] flex-1 flex-col gap-2.5 overflow-y-auto p-2.5">
                {col.length ? col.map((l) => <LeadCard key={l.id} lead={l} canUpdate={canUpdate} />) : <EmptyState compact title="No leads" className="border-0 py-4" />}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
