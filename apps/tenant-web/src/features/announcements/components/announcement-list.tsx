'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Search, Send, X } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { EmptyState, FilterChips, SegmentedTabs, SkeletonBlock } from '@/features/reports/components/ui';
import { toAnnouncementError, useAnnouncements, usePublishAnnouncement } from '../hooks/use-announcements';
import { STATUS_META } from '../lib/announcement-meta';
import type { AnnouncementAudience, AnnouncementStatus, TenantAnnouncement } from '../types';
import { AnnouncementCard, type AnnouncementCardActions } from './announcement-card';

const PAGE_SIZE = 12;
type StatusTab = 'ALL' | AnnouncementStatus;
type AudienceTab = 'ALL' | AnnouncementAudience;

const AUDIENCE_TABS: Array<{ value: AudienceTab; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'MEMBERS', label: 'Members' },
  { value: 'STAFF', label: 'Staff' },
];

const EMPTY_COPY: Record<StatusTab, { title: string; description: string }> = {
  ALL: { title: 'No announcements', description: 'Create one to broadcast news to your gym.' },
  DRAFT: { title: 'No drafts', description: 'Drafts you save will wait here until you publish or schedule them.' },
  SCHEDULED: { title: 'Nothing scheduled', description: 'Schedule a draft to have it go out automatically.' },
  PUBLISHED: { title: 'Nothing published yet', description: 'Published announcements show up here.' },
  EXPIRED: { title: 'No expired announcements', description: 'Announcements move here after their expiry date.' },
};

/** Filters (status tabs with server counts, audience, debounced search) + animated announcement grid + pagination. */
export function AnnouncementList({
  actions,
  onCreate,
}: {
  actions: Omit<AnnouncementCardActions, 'publishing' | 'onPublish'>;
  /** Present only when the user may create. */
  onCreate?: () => void;
}) {
  const [status, setStatus] = React.useState<StatusTab>('ALL');
  const [audience, setAudience] = React.useState<AudienceTab>('ALL');
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  // Page is tied to the filter signature, so changing a filter lands on page 1 without a reset effect.
  const filterKey = `${status}|${audience}|${debouncedSearch}`;
  const [pageState, setPageState] = React.useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;

  const { data, isPending, isFetching } = useAnnouncements({
    status: status === 'ALL' ? undefined : status,
    audience: audience === 'ALL' ? undefined : audience,
    search: debouncedSearch || undefined,
    page,
    limit: PAGE_SIZE,
  });
  const publish = usePublishAnnouncement();
  const items = data?.items ?? [];
  const counts = data?.counts;
  const filtered = status !== 'ALL' || audience !== 'ALL' || debouncedSearch !== '';

  const cardActions: AnnouncementCardActions = {
    ...actions,
    publishing: publish.isPending,
    onPublish: (a: TenantAnnouncement) =>
      publish.mutate(a.id, {
        onSuccess: () => toast.success('Announcement published.'),
        onError: (err) => toast.error(toAnnouncementError(err).message),
      }),
  };

  const statusOptions = [
    { value: 'ALL', label: 'All', count: counts?.all },
    ...(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'EXPIRED'] as const).map((s) => ({
      value: s,
      label: STATUS_META[s].label,
      dotColor: STATUS_META[s].color,
      count: counts?.[s.toLowerCase() as 'draft' | 'scheduled' | 'published' | 'expired'],
    })),
  ];

  return (
    <section className="space-y-4" aria-label="Announcements list">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips options={statusOptions} value={status} onChange={(v) => setStatus(v as StatusTab)} accent="staff" />
        <div className="flex flex-wrap items-center gap-2.5">
          <SegmentedTabs ariaLabel="Audience" size="sm" accent="staff" options={AUDIENCE_TABS} value={audience === 'ALL' ? 'ALL' : audience} onChange={setAudience} />
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input aria-label="Search announcements" placeholder="Search title or body…" className="h-9 w-[220px] rounded-full pl-9 pr-8" value={search} onChange={(e) => setSearch(e.target.value)} />
            {search ? (
              <button type="button" aria-label="Clear search" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {isPending ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} height={190} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Send}
          accent="staff"
          title={filtered ? EMPTY_COPY[status].title : EMPTY_COPY.ALL.title}
          description={debouncedSearch ? `Nothing matches "${debouncedSearch}".` : EMPTY_COPY[status].description}
          action={
            onCreate && status !== 'EXPIRED' ? (
              <Button size="sm" onClick={onCreate}>
                <Plus className="size-4" /> New announcement
              </Button>
            ) : null
          }
        />
      ) : (
        <motion.div animate={{ opacity: isFetching ? 0.7 : 1 }} transition={{ duration: 0.15 }} className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {items.map((a) => (
              <AnnouncementCard key={a.id} announcement={a} actions={cardActions} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {data && data.totalPages > 1 ? (
        <Pagination page={page} totalPages={data.totalPages} totalItems={data.total} pageSize={PAGE_SIZE} onPageChange={(p) => setPageState({ key: filterKey, page: p })} />
      ) : null}
    </section>
  );
}
