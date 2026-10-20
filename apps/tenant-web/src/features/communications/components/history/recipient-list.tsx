'use client';

import * as React from 'react';
import { Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/utils';
import { CHANNEL_META } from '../../constants';
import { useCampaignRecipients } from '../../hooks/use-communications';
import { describeLoadError } from '../../lib/errors';
import { formatWhen } from '../../lib/format';
import type { Channel, RecipientStatus } from '../../types';
import { Banner, ChannelDot, RecipientStatusPill } from '../common';

const PAGE_SIZE = 10;

type StatusFilter = 'ALL' | RecipientStatus;

const SKIP_LABEL: Record<string, string> = {
  SKIPPED_OPTED_OUT: 'Opted out',
  SKIPPED_NO_CONTACT: 'No contact',
  SKIPPED_QUOTA: 'Over limit',
  SKIPPED_DISABLED: 'Channel off',
};

/** Per-recipient delivery list of one campaign: status filter chips, channel filter, name search, pagination. */
export function RecipientList({ campaignId, channels, skippedByReason, cancelledCount }: { campaignId: string; channels: Channel[]; skippedByReason: Partial<Record<string, number>>; cancelledCount: number }) {
  const [status, setStatus] = React.useState<StatusFilter>('ALL');
  const [channel, setChannel] = React.useState<'' | Channel>('');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const debounced = useDebouncedValue(search.trim(), 300);

  const q = useCampaignRecipients(campaignId, { status: status === 'ALL' ? undefined : status, channel: channel || undefined, search: debounced || undefined, page, limit: PAGE_SIZE });
  const items = q.data?.items ?? [];
  const filters: Array<{ value: StatusFilter; label: string }> = [
    { value: 'ALL', label: 'All' },
    { value: 'SENT', label: 'Sent' },
    { value: 'FAILED', label: 'Failed' },
    { value: 'QUEUED', label: 'Waiting' },
    ...Object.entries(SKIP_LABEL).filter(([k]) => (skippedByReason[k] ?? 0) > 0).map(([k, label]) => ({ value: k as StatusFilter, label })),
    ...(cancelledCount > 0 ? [{ value: 'CANCELLED' as StatusFilter, label: 'Cancelled' }] : []),
  ];

  const reset = () => setPage(1);

  return (
    <section aria-label="Recipients" className="mt-4">
      <h4 className="mb-2 text-sm font-bold">Recipients</h4>
      <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Filter recipients by status">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={status === f.value}
            onClick={() => {
              setStatus(f.value);
              reset();
            }}
            className={cn(
              'min-h-9 rounded-full border px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              status === f.value ? 'border-primary bg-primary text-primary-foreground' : 'bg-muted/50 hover:bg-accent',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="mb-2 flex flex-wrap gap-2">
        <div className="relative min-w-[140px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            aria-label="Search recipients by name or member ID"
            placeholder="Search name or ID"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              reset();
            }}
            className="h-10 w-full rounded-lg border border-input bg-background pl-8 pr-2 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
        {channels.length > 1 ? (
          <select
            aria-label="Filter by channel"
            value={channel}
            onChange={(e) => {
              setChannel(e.target.value as '' | Channel);
              reset();
            }}
            className="h-10 rounded-lg border border-input bg-background px-2 text-[13px]"
          >
            <option value="">All channels</option>
            {channels.map((c) => (
              <option key={c} value={c}>
                {CHANNEL_META[c].label}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {q.isError ? (
        <Banner title="Couldn't load recipients" action={{ label: 'Try again', onClick: () => void q.refetch(), busy: q.isFetching }}>
          {describeLoadError(q.error, 'the recipient list')}
        </Banner>
      ) : q.isLoading ? (
        <div className="space-y-1.5" aria-busy>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-5 text-center text-[13px] text-muted-foreground">
          {status !== 'ALL' || debounced || channel ? 'No recipients match this filter.' : 'No recipients yet. They appear once sending starts.'}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border" aria-busy={q.isFetching}>
          {items.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-2 px-3 py-2 text-[13px]">
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <ChannelDot channel={r.channel} size="sm" />
                  <span className="truncate font-semibold">{r.memberName}</span>
                  <span className="text-xs text-muted-foreground">{r.memberCode}</span>
                </span>
                {r.error ? <span className="mt-0.5 block break-words text-xs text-muted-foreground">{r.error}</span> : null}
                {r.status === 'QUEUED' && r.heldUntil ? <span className="mt-0.5 block text-xs text-muted-foreground">Held for quiet hours until {formatWhen(r.heldUntil)}</span> : null}
              </span>
              <RecipientStatusPill status={r.status} />
            </li>
          ))}
        </ul>
      )}

      {q.data && q.data.totalPages > 1 ? (
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Page {q.data.page} of {q.data.totalPages} · {q.data.total.toLocaleString('en-IN')} messages
          </span>
          <span className="flex gap-1.5">
            <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={page >= q.data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </span>
        </div>
      ) : null}
    </section>
  );
}
