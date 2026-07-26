'use client';

import * as React from 'react';
import { Bell, BellRing } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import type { NotificationFilterTab } from '@/features/notifications/constants';
import { matchesNotificationTab } from '@/features/notifications/constants';
import { NotificationFeed } from '@/features/notifications/components/notification-feed';
import { useDeleteNotification, useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/features/notifications/hooks/use-notifications';
import { notificationPanelClosed, notificationPanelToggled } from '@/features/notifications/store/notification-slice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

/** Notification Center: unread/read/category feed, opened from the header bell. */
export function NotificationPanel() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((state) => state.notifications.panelOpen);
  const unreadCount = useAppSelector((state) => state.notifications.unreadCount);
  const [tab, setTab] = React.useState<NotificationFilterTab>('unread');

  const { data, isLoading } = useNotifications({ limit: 50 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();

  const items = (data?.items ?? []).filter((n) => matchesNotificationTab(n, tab));

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
        <DrawerContent side="right" className="flex w-full max-w-sm flex-col">
          <DrawerHeader className="flex-row items-center justify-between space-y-0">
            <DrawerTitle>Notifications</DrawerTitle>
            <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending || unreadCount === 0}>
              Mark all read
            </Button>
          </DrawerHeader>

          <NotificationFeed
            tab={tab}
            onTabChange={setTab}
            items={items}
            isLoading={isLoading}
            onMarkRead={(id) => markRead.mutate(id)}
            onDelete={(id) => deleteNotification.mutate(id)}
            compact
          />
        </DrawerContent>
      </Drawer>
    </>
  );
}
