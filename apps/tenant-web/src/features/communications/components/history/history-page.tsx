'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useBranches } from '@/features/branch/hooks/use-branches';
import { useAssignablePlans } from '@/features/members/hooks/use-members';
import { FilterChips, type ChipOption } from '@/features/reports/components/ui';
import { COMM_ACCENT } from '@/features/notifications/constants';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { COMMUNICATIONS_PERMISSIONS, COMMUNICATIONS_ROUTES } from '../../constants';
import { useCampaigns } from '../../hooks/use-communications';
import { describeLoadError } from '../../lib/errors';
import type { CampaignCounts, CampaignStatus } from '../../types';
import { CampaignDetailPanel } from './campaign-detail';
import { CampaignTable } from './campaign-table';

const PAGE_SIZE = 15;

const STATUS_CHIPS: Array<{ value: '' | CampaignStatus; label: string; key: keyof CampaignCounts }> = [
  { value: '', label: 'All', key: 'all' },
  { value: 'SENDING', label: 'Sending', key: 'sending' },
  { value: 'SCHEDULED', label: 'Scheduled', key: 'scheduled' },
  { value: 'SENT', label: 'Sent', key: 'sent' },
  { value: 'PARTIAL', label: 'Partly sent', key: 'partial' },
  { value: 'FAILED', label: 'Failed', key: 'failed' },
  { value: 'DRAFT', label: 'Drafts', key: 'draft' },
  { value: 'CANCELLED', label: 'Cancelled', key: 'cancelled' },
];

/** History tab: filterable campaign list (left) and live detail panel (right). Selection lives in `?campaign=` so a link opens straight to a message. */
export function HistoryPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { hasPermission } = usePermissions();
  const canSend = hasPermission(COMMUNICATIONS_PERMISSIONS.send);
  const selectedParam = params.get('campaign');

  const [status, setStatus] = React.useState<'' | CampaignStatus>('');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const debounced = useDebouncedValue(search.trim(), 300);

  const list = useCampaigns({ status: status || undefined, search: debounced || undefined, page, limit: PAGE_SIZE });
  const plans = useAssignablePlans();
  const branches = useBranches();
  const names = React.useMemo(() => ({ plans: plans.data, branches: branches.data }), [plans.data, branches.data]);

  const items = list.data?.items;
  const selectedId = selectedParam ?? items?.[0]?.id ?? null;
  const counts = list.data?.counts;
  const filtered = status !== '' || debounced !== '';

  const select = (id: string) => router.replace(`${COMMUNICATIONS_ROUTES.history}?campaign=${id}`, { scroll: false });

  const chips: ChipOption[] = STATUS_CHIPS.filter((c) => c.value === '' || c.value === status || (counts?.[c.key] ?? 0) > 0).map((c) => ({
    value: c.value,
    label: c.label,
    count: counts?.[c.key],
  }));

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section aria-label="Message history" className="min-w-0 rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <FilterChips
            accent={COMM_ACCENT}
            options={chips}
            value={status}
            onChange={(v) => {
              setStatus(v as '' | CampaignStatus);
              setPage(1);
            }}
          />
          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              aria-label="Search messages"
              placeholder="Search name or title"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="h-10 w-full rounded-lg border border-input bg-background pl-8 pr-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
        </div>
        <CampaignTable
          items={items}
          selectedId={selectedId}
          onSelect={select}
          loading={list.isLoading}
          error={list.isError ? describeLoadError(list.error, 'your messages') : null}
          onRetry={() => void list.refetch()}
          retrying={list.isFetching}
          page={page}
          totalPages={list.data?.totalPages ?? 1}
          total={list.data?.total ?? 0}
          pageSize={PAGE_SIZE}
          onPage={setPage}
          names={names}
          filtered={filtered}
          onClearFilters={() => {
            setStatus('');
            setSearch('');
            setPage(1);
          }}
        />
        {!list.isLoading && !list.isError && list.data?.counts.all === 0 && canSend ? (
          <div className="mt-3 text-center">
            <Button asChild>
              <Link href={COMMUNICATIONS_ROUTES.send}>
                <Send className="size-4" aria-hidden /> Send your first message
              </Link>
            </Button>
          </div>
        ) : null}
      </section>

      <aside aria-label="Message details" className="min-w-0 rounded-2xl border bg-card p-4 shadow-xs sm:p-5 xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto">
        {selectedId ? (
          <CampaignDetailPanel key={selectedId} id={selectedId} canSend={canSend} names={names} />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">{list.isLoading ? 'Loading…' : 'Select a message to see how it went.'}</p>
        )}
      </aside>
    </div>
  );
}
