'use client';

import * as React from 'react';
import { Mail, Phone, Search, Smartphone, Users, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/utils';
import { MAX_RECIPIENTS } from '../../constants';
import { useAudienceMembers } from '../../hooks/use-communications';
import { describeLoadError } from '../../lib/errors';
import type { PickedMember } from '../../lib/composer';
import type { AudienceMember } from '../../types';
import { Banner } from '../common';

const PAGE_SIZE = 20;
const CHIP_LIMIT = 12;

function ContactFlags({ m }: { m: AudienceMember }) {
  const items = [
    { ok: m.hasEmail, Icon: Mail, label: 'email' },
    { ok: m.hasPhone, Icon: Phone, label: 'phone' },
    { ok: m.hasDevice, Icon: Smartphone, label: 'app' },
  ];
  return (
    <span className="flex items-center gap-1.5" role="img" aria-label={`Can be reached by: ${items.filter((i) => i.ok).map((i) => i.label).join(', ') || 'in-app only'}`}>
      {items.map(({ ok, Icon, label }) => (
        <Icon key={label} className={cn('size-3.5', ok ? 'text-foreground' : 'text-muted-foreground/35')} aria-hidden />
      ))}
    </span>
  );
}

/** Step 1, "Pick members": search + paginated list from `GET /communications/audience/members`, select shown / clear, removable chips. */
export function MemberPicker({
  picked,
  onPick,
  onUnpick,
  onClear,
  error,
}: {
  picked: Record<string, PickedMember>;
  onPick: (members: PickedMember[]) => void;
  onUnpick: (ids: string[]) => void;
  onClear: () => void;
  error?: string;
}) {
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const debounced = useDebouncedValue(search.trim(), 300);
  const { data, isLoading, isError, error: loadError, refetch, isFetching } = useAudienceMembers({ search: debounced || undefined, page, limit: PAGE_SIZE });

  const pickedList = Object.values(picked);
  const known = pickedList.filter((p) => p.name);
  const unnamed = pickedList.length - known.length;
  const shown = data?.items ?? [];
  const allShownPicked = shown.length > 0 && shown.every((m) => picked[m.id]);
  const overMax = pickedList.length > MAX_RECIPIENTS;

  const toggle = (m: AudienceMember, checked: boolean) => {
    if (checked) onPick([{ id: m.id, memberId: m.memberId, name: m.name }]);
    else onUnpick([m.id]);
  };

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, member ID or phone"
            aria-label="Search members"
            className="h-11 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:h-10"
          />
        </div>
        <Button type="button" variant="outline" className="min-h-11 sm:min-h-10" disabled={!shown.length || allShownPicked} onClick={() => onPick(shown.map((m) => ({ id: m.id, memberId: m.memberId, name: m.name })))}>
          Select shown
        </Button>
        <Button type="button" variant="outline" className="min-h-11 sm:min-h-10" disabled={pickedList.length === 0} onClick={onClear}>
          Clear
        </Button>
      </div>

      {isError ? (
        <Banner title="Couldn't load members" action={{ label: 'Try again', onClick: () => void refetch(), busy: isFetching }}>
          {describeLoadError(loadError, 'the member list')}
        </Banner>
      ) : (
        <div className="max-h-[290px] overflow-y-auto rounded-xl border bg-muted/30" aria-busy={isLoading || isFetching}>
          {isLoading ? (
            <div className="space-y-2 p-3" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <p className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
              <Users className="size-4" aria-hidden />
              {debounced ? 'No member found. Try a name, member ID or phone number.' : 'There are no members you can message yet.'}
            </p>
          ) : (
            <ul>
              {shown.map((m) => (
                <li key={m.id} className="border-t first:border-t-0">
                  <label className="grid min-h-11 cursor-pointer grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2.5 px-3 py-2 hover:bg-primary/8">
                    <Checkbox checked={!!picked[m.id]} onCheckedChange={(c) => toggle(m, c === true)} aria-label={`Select ${m.name}`} className="size-[18px]" />
                    <span className="min-w-0">
                      <b className="font-semibold">{m.name}</b> <small className="text-muted-foreground">{m.memberId}</small>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[m.planName ?? 'No plan', m.branchName].join(' · ')}
                      </span>
                    </span>
                    <ContactFlags m={m} />
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {data && data.totalPages > 1 ? (
        <div className="mt-2 flex items-center justify-between gap-2 text-[13px] text-muted-foreground">
          <span>
            Page {data.page} of {data.totalPages} · {data.total.toLocaleString('en-IN')} members
          </span>
          <span className="flex gap-1.5">
            <Button type="button" size="sm" variant="outline" className="min-h-11 sm:min-h-9" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button type="button" size="sm" variant="outline" className="min-h-11 sm:min-h-9" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </span>
        </div>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5" aria-live="polite">
        {known.slice(0, CHIP_LIMIT).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onUnpick([p.id])}
            aria-label={`Remove ${p.name}`}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-primary/10 py-1 pl-3 pr-1.5 text-[12.5px] font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {p.name}
            <span className="grid size-[18px] place-items-center rounded-full bg-primary text-primary-foreground">
              <X className="size-3" aria-hidden />
            </span>
          </button>
        ))}
        {known.length > CHIP_LIMIT ? <span className="text-[12.5px] text-muted-foreground">+ {known.length - CHIP_LIMIT} more</span> : null}
        {unnamed > 0 ? <span className="text-[12.5px] text-muted-foreground">{known.length ? '+ ' : ''}{unnamed.toLocaleString('en-IN')} saved with this draft</span> : null}
        {pickedList.length === 0 ? <span className="text-[13px] text-muted-foreground">Nobody picked yet. Tick members in the list.</span> : null}
      </div>
      {overMax ? <p role="alert" className="mt-2 text-[13px] font-medium text-destructive">You can pick at most {MAX_RECIPIENTS.toLocaleString('en-IN')} members.</p> : null}
      {error ? <p role="alert" className="mt-2 text-[13px] font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
