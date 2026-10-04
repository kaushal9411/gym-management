'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';

import { Pagination } from '@/components/ui/pagination';
import { SearchBar } from '@/components/ui/search-bar';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { ChartCard, EmptyState, FilterChips, SegmentedTabs } from '@/features/reports/components/ui';
import { useDeleteNotification, useMarkNotificationRead, useNotifications } from '../hooks/use-notifications';
import { CATEGORY_COLOR, CATEGORY_LABEL, COMM_ACCENT, NOTIFICATION_CATEGORIES } from '../constants';
import type { NotificationCategory, NotificationStats } from '../types';
import { NotificationFeed } from './notification-feed';

const PAGE_SIZE = 20;

/**
 * Inbox: category chips (counts = the selected period, from stats.categories), Unread/All tabs (counts from the list response, all time),
 * debounced server-side search; every filter is a server param so Unread/search cover the whole feed, not just the loaded page.
 */
export function NotificationInbox({ stats, canDelete }: { stats?: NotificationStats; canDelete: boolean }) {
  const [view, setView] = React.useState<'unread' | 'all'>('unread');
  const [category, setCategory] = React.useState<'' | NotificationCategory>('');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const debounced = useDebouncedValue(search.trim(), 300);

  const { data, isLoading, isError, refetch } = useNotifications({
    page,
    limit: PAGE_SIZE,
    unreadOnly: view === 'unread' ? true : undefined,
    category: category || undefined,
    search: debounced || undefined,
  });
  const markRead = useMarkNotificationRead();
  const deleteNotification = useDeleteNotification();

  // Deleting/reading the last row of the last page can leave `page` past the end.
  React.useEffect(() => {
    if (data && data.totalPages > 0 && page > data.totalPages) setPage(data.totalPages);
  }, [data, page]);

  const chipOptions = React.useMemo(() => {
    const byCat = new Map((stats?.categories ?? []).map((c) => [c.category, c.count]));
    const cats = NOTIFICATION_CATEGORIES.filter((c) => !stats || (byCat.get(c) ?? 0) > 0 || c === category).sort((a, b) => (byCat.get(b) ?? 0) - (byCat.get(a) ?? 0));
    return [
      { value: '', label: 'All categories' },
      ...cats.map((c) => ({ value: c, label: CATEGORY_LABEL[c], dotColor: CATEGORY_COLOR[c], count: stats ? byCat.get(c) ?? 0 : undefined })),
    ];
  }, [stats, category]);

  const counts = data?.counts;
  const unreadTotal = counts?.unread ?? data?.unreadCount;
  const withCount = (label: string, n?: number) => (n === undefined ? label : `${label} · ${n.toLocaleString()}`);

  const filtered = view === 'unread' || category !== '' || debounced !== '';
  return (
    <ChartCard
      title="Inbox"
      subtitle="Everything sent to your gym. Read status is shared across your team."
      actions={
        <SegmentedTabs
          accent={COMM_ACCENT}
          ariaLabel="Inbox filter"
          value={view}
          onChange={(v) => {
            setView(v);
            setPage(1);
          }}
          options={[
            { value: 'unread', label: withCount('Unread', unreadTotal) },
            { value: 'all', label: withCount('All', counts?.all) },
          ]}
        />
      }
    >
      <div className="space-y-4">
        <SearchBar
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search notifications..."
        />
        <div>
          <FilterChips
            accent={COMM_ACCENT}
            options={chipOptions}
            value={category}
            onChange={(v) => {
              setCategory(v as '' | NotificationCategory);
              setPage(1);
            }}
          />
          {stats ? <p className="mt-1.5 text-[11px] text-muted-foreground">Category counts reflect the selected period; the list below covers all time.</p> : null}
        </div>

        {isError ? (
          <EmptyState
            icon={AlertTriangle}
            accent="staff"
            title="Could not load notifications"
            action={
              <button type="button" onClick={() => void refetch()} className="rounded-lg border px-3 py-1.5 text-xs font-bold hover:bg-accent">
                Try again
              </button>
            }
          />
        ) : (
          <NotificationFeed
            showTabs={false}
            grouped
            items={data?.items ?? []}
            isLoading={isLoading}
            canDelete={canDelete}
            onMarkRead={(id) => markRead.mutate(id)}
            onDelete={(id) => deleteNotification.mutate(id)}
            emptyTitle={filtered ? 'No matching notifications' : 'Nothing here'}
            emptyDescription={view === 'unread' && !category && !debounced ? "You're all caught up." : 'Try a different filter or search.'}
          />
        )}

        {data && data.totalPages > 1 ? <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} totalItems={data.total} pageSize={PAGE_SIZE} /> : null}
      </div>
    </ChartCard>
  );
}
