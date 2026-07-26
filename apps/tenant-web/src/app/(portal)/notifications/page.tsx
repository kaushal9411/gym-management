'use client';

import * as React from 'react';
import Link from 'next/link';
import { Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">Everything sent to your gym, in one place.</p>
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
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.page} of {data.totalPages} · {data.total} notifications
          </span>
          <span className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </span>
        </div>
      ) : null}
    </div>
  );
}
