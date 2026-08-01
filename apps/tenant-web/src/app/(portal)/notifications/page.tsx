'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bell, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { SearchBar } from '@/components/ui/search-bar';
import { NotificationFeed } from '@/features/notifications/components/notification-feed';
import type { NotificationFilterTab } from '@/features/notifications/constants';
import { matchesNotificationTab } from '@/features/notifications/constants';
import { useDeleteNotification, useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/features/notifications/hooks/use-notifications';

export default function NotificationsPage() {
  const [tab, setTab] = React.useState<NotificationFilterTab>('unread');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);

  const { data, isLoading } = useNotifications({ page, limit: 20 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();

  const items = (data?.items ?? [])
    .filter((n) => matchesNotificationTab(n, tab))
    .filter((n) => !search.trim() || `${n.title} ${n.body}`.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-xl sm:size-11"
            style={{
              backgroundColor: 'color-mix(in oklch, var(--chart-2) 16%, transparent)',
              color: 'var(--chart-2)',
              boxShadow: '0 0 0 1px color-mix(in oklch, var(--chart-2) 18%, transparent)',
            }}
          >
            <Bell className="size-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
            <p className="text-muted-foreground">Everything sent to your gym, in one place.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/notifications/settings">
              <Settings2 className="size-4" /> Notification Settings
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending || (data?.unreadCount ?? 0) === 0}
          >
            Mark all read
          </Button>
        </div>
      </div>

      <SearchBar value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notifications..." />

      <NotificationFeed
        tab={tab}
        onTabChange={setTab}
        items={items}
        isLoading={isLoading}
        onMarkRead={(id) => markRead.mutate(id)}
        onDelete={(id) => deleteNotification.mutate(id)}
      />

      {data && data.totalPages > 1 ? (
        <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} totalItems={data.total} pageSize={20} />
      ) : null}
    </div>
  );
}
