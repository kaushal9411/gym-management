'use client';

import * as React from 'react';
import { Inbox, SearchX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { audienceLabel, type NameLookup } from '../../lib/composer';
import { campaignWhen } from '../../lib/format';
import type { Campaign } from '../../types';
import { Banner, CampaignStatusPill, ChannelDots } from '../common';
import { EmptyState } from '@/features/reports/components/ui';

/** History list: design table (Message / Audience / Channels / When / Status). Rows select the detail panel; the title is the keyboard target. */
export function CampaignTable({
  items,
  selectedId,
  onSelect,
  loading,
  error,
  onRetry,
  page,
  totalPages,
  total,
  pageSize,
  onPage,
  names,
  filtered,
  onClearFilters,
  retrying,
}: {
  items: Campaign[] | undefined;
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  retrying?: boolean;
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
  names: NameLookup;
  filtered: boolean;
  onClearFilters: () => void;
}) {
  if (error) {
    return (
      <Banner title="Couldn't load your messages" action={{ label: 'Try again', onClick: onRetry, busy: retrying }}>
        {error}
      </Banner>
    );
  }
  if (loading) {
    return (
      <div className="space-y-2" aria-busy aria-label="Loading messages">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  if (!items || items.length === 0) {
    return filtered ? (
      <EmptyState icon={SearchX} title="Nothing matches" description="No messages match this filter or search." action={<Button variant="outline" onClick={onClearFilters}>Clear filters</Button>} />
    ) : (
      <EmptyState icon={Inbox} title="No messages yet" description="Messages you send or schedule will appear here with their delivery results." />
    );
  }
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-sm">
          <caption className="sr-only">Messages sent from Communications</caption>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
              <th scope="col" className="px-2.5 py-2 font-bold">Message</th>
              <th scope="col" className="px-2.5 py-2 font-bold">Audience</th>
              <th scope="col" className="px-2.5 py-2 font-bold">Channels</th>
              <th scope="col" className="px-2.5 py-2 font-bold">When</th>
              <th scope="col" className="px-2.5 py-2 font-bold">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => {
              const sel = c.id === selectedId;
              return (
                <tr key={c.id} onClick={() => onSelect(c.id)} className={cn('cursor-pointer border-t align-middle hover:bg-accent/50', sel && 'bg-primary/8')} data-selected={sel || undefined}>
                  <td className="px-2.5 py-3">
                    <button type="button" aria-pressed={sel} onClick={(e) => { e.stopPropagation(); onSelect(c.id); }} className="max-w-[240px] truncate rounded text-left font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {c.name || c.title}
                    </button>
                  </td>
                  <td className="px-2.5 py-3">{audienceLabel(c, names)}</td>
                  <td className="px-2.5 py-3"><ChannelDots channels={c.channels} /></td>
                  <td className="whitespace-nowrap px-2.5 py-3 text-muted-foreground">{campaignWhen(c)}</td>
                  <td className="px-2.5 py-3"><CampaignStatusPill status={c.status} failed={c.failedCount} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPage} totalItems={total} pageSize={pageSize} className="mt-3" />
    </>
  );
}
