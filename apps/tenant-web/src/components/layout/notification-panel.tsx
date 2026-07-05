'use client';

import * as React from 'react';
import { Bell, BellRing, Megaphone, Settings2, ShieldAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/format-relative-time';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/features/notifications/hooks/use-notifications';
import type { NotificationCategory, TenantNotification } from '@/features/notifications/types';
import { notificationPanelClosed, notificationPanelToggled } from '@/features/notifications/store/notification-slice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

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

/** Notification Center: unread/read/announcements/system/subscription-alert feed, opened from the header bell. */
export function NotificationPanel() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((state) => state.notifications.panelOpen);
  const unreadCount = useAppSelector((state) => state.notifications.unreadCount);
  const [tab, setTab] = React.useState<FilterTab>('unread');

  const { data, isLoading } = useNotifications({ limit: 50 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = (data?.items ?? []).filter((n) => matchesTab(n, tab));

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Notifications"
        className="relative"
        onClick={() => dispatch(notificationPanelToggled())}
      >
        {unreadCount > 0 ? <BellRing className="size-4.5" /> : <Bell className="size-4.5" />}
        {unreadCount > 0 && (
          <Badge className="absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[10px]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      <Drawer open={open} onOpenChange={(next) => !next && dispatch(notificationPanelClosed())}>
        <DrawerContent side="right" className="w-full max-w-sm">
          <DrawerHeader className="flex-row items-center justify-between space-y-0">
            <DrawerTitle>Notifications</DrawerTitle>
            <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending || unreadCount === 0}>
              Mark all read
            </Button>
          </DrawerHeader>

          <div className="flex flex-wrap gap-1.5 border-b pb-3">
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

          <div className="flex-1 space-y-2 overflow-y-auto">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
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
                      'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent',
                      !notification.readAt && 'bg-primary/5',
                    )}
                  >
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 space-y-0.5">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{notification.title}</span>
                        {!notification.readAt && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                      </span>
                      <span className="block text-xs text-muted-foreground">{notification.body}</span>
                      <span className="block text-xs text-muted-foreground">{formatRelativeTime(notification.createdAt)}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
