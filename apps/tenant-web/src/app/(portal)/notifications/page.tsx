'use client';

import * as React from 'react';
import { Bell, Megaphone, Settings2, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/format-relative-time';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/features/notifications/hooks/use-notifications';
import type { NotificationCategory, TenantNotification } from '@/features/notifications/types';

type FilterTab = 'unread' | 'read' | 'ANNOUNCEMENT' | 'SYSTEM' | 'SUBSCRIPTION';

const TABS: Array<{ value: FilterTab; label: string }> = [
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
  { value: 'ANNOUNCEMENT', label: 'Announcements' },
  { value: 'SYSTEM', label: 'System' },
  { value: 'SUBSCRIPTION', label: 'Subscription' },
];

const CATEGORY_ICON: Record<NotificationCategory, React.ElementType> = {
  ANNOUNCEMENT: Megaphone,
  SYSTEM: Settings2,
  SUBSCRIPTION: ShieldAlert,
  GENERAL: Bell,
};

function matchesTab(notification: TenantNotification, tab: FilterTab): boolean {
  if (tab === 'unread') return notification.readAt === null;
  if (tab === 'read') return notification.readAt !== null;
  return notification.category === tab;
}

export default function NotificationsPage() {
  const [tab, setTab] = React.useState<FilterTab>('unread');
  const { data, isLoading } = useNotifications({ limit: 50 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = (data?.items ?? []).filter((n) => matchesTab(n, tab));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">Everything sent to your gym, in one place.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending || (data?.unreadCount ?? 0) === 0}
        >
          Mark all read
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              tab === t.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
        ) : items.length === 0 ? (
          <EmptyState icon={Bell} title="Nothing here" description="You're all caught up." />
        ) : (
          items.map((notification) => {
            const Icon = CATEGORY_ICON[notification.category];
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => !notification.readAt && markRead.mutate(notification.id)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent',
                  !notification.readAt && 'bg-primary/5',
                )}
              >
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Icon className="size-4.5" />
                </span>
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{notification.title}</span>
                    {!notification.readAt && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                  </span>
                  <span className="block text-sm text-muted-foreground">{notification.body}</span>
                  <span className="block text-xs text-muted-foreground">{formatRelativeTime(notification.createdAt)}</span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
