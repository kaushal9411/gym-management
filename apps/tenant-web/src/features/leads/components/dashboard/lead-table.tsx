'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import { Pagination } from '@/components/ui/pagination';
import { EmptyState, SkeletonBlock } from '@/features/reports/components/ui';
import { cn } from '@/lib/utils';
import { formatDateTime, formatDay, relativeTime } from '../../lib/lead-meta';
import type { LeadListResponse, LeadSortBy } from '../../types';
import { TABLE_LIMIT, type LeadsPageState } from '../../hooks/use-leads-page-state';
import { FollowUpBadge, LeadAvatar, SourceChip, StatusPill } from '../shared/lead-ui';

function Th({ label, col, s, className }: { label: string; col?: LeadSortBy; s: LeadsPageState; className?: string }) {
  const active = col && s.sortBy === col;
  const Icon = !col ? null : active ? (s.sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th scope="col" aria-sort={active ? (s.sortDir === 'asc' ? 'ascending' : 'descending') : undefined} className={cn('whitespace-nowrap px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground', className)}>
      {col ? (
        <button type="button" className="inline-flex items-center gap-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => s.set({ sort: col, dir: active ? (s.sortDir === 'asc' ? 'desc' : 'asc') : col === 'name' ? 'asc' : 'desc' })}>
          {label} {Icon ? <Icon className={cn('size-3', !active && 'opacity-40')} aria-hidden /> : null}
        </button>
      ) : (
        label
      )}
    </th>
  );
}

export function LeadTable({ data, loading, s }: { data: LeadListResponse | undefined; loading: boolean; s: LeadsPageState }) {
  const router = useRouter();
  if (loading && !data) return <SkeletonBlock height={420} />;
  if (!data || data.items.length === 0) {
    return <EmptyState title="No leads match" description="Try clearing filters, or add a new lead." action={s.activeFilterCount ? <button type="button" onClick={s.clearFilters} className="text-sm font-bold text-primary underline">Clear filters</button> : undefined} />;
  }
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <Th label="Lead" col="name" s={s} />
              <Th label="Stage" s={s} />
              <Th label="Source" s={s} />
              <Th label="Plan" s={s} />
              <Th label="Assigned" s={s} />
              <Th label="Follow-up" col="nextFollowUpAt" s={s} />
              <Th label="Last activity" col="lastActivityAt" s={s} />
              <Th label="Created" col="createdAt" s={s} />
            </tr>
          </thead>
          <tbody className={cn('divide-y', loading && 'opacity-60')}>
            {data.items.map((l) => (
              <tr key={l.id} onClick={() => router.push(`/leads/${l.id}`)} className="cursor-pointer transition-colors hover:bg-accent/50">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <LeadAvatar name={l.name} size={30} />
                    <div className="min-w-0">
                      <Link href={`/leads/${l.id}`} onClick={(e) => e.stopPropagation()} className="block max-w-[200px] truncate font-bold hover:underline">{l.name}</Link>
                      <span className="text-xs text-muted-foreground">{l.phone}</span>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5"><StatusPill status={l.status} /></td>
                <td className="px-3 py-2.5"><SourceChip source={l.source} /></td>
                <td className="max-w-[140px] truncate px-3 py-2.5">{l.interestedPlan?.name ?? <span className="text-muted-foreground">-</span>}</td>
                <td className="max-w-[140px] truncate px-3 py-2.5">{l.assignedTo?.name ?? <span className="text-muted-foreground">Unassigned</span>}</td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  {l.nextFollowUpAt ? (
                    <div className="space-y-0.5">
                      <FollowUpBadge state={l.followUpState} at={l.nextFollowUpAt} />
                      <div className="text-[11px] text-muted-foreground">{formatDateTime(l.nextFollowUpAt)}</div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{relativeTime(l.lastActivityAt)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{formatDay(l.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={data.page} totalPages={data.totalPages} totalItems={data.total} pageSize={TABLE_LIMIT} onPageChange={(p) => s.set({ page: p === 1 ? null : String(p) }, false)} />
    </div>
  );
}
