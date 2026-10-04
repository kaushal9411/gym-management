'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { BellButton } from '@/features/notifications/components/bell-panel/bell-button';
import { BellPanelFeed } from '@/features/notifications/components/bell-panel/bell-panel-feed';
import { COMM_ACCENT } from '@/features/notifications/constants';
import { useDeleteNotification, useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/features/notifications/hooks/use-notifications';
import { notificationPanelClosed, notificationPanelToggled } from '@/features/notifications/store/notification-slice';
import { SegmentedTabs } from '@/features/reports/components/ui';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

const PAGE = 20;
const TONE = 'var(--chart-7)';

/** Notification Center: header bell + right Drawer. Unread/All are server params (`unreadOnly`), counts come from the list response. */
export function NotificationPanel() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((state) => state.notifications.panelOpen);
  const unreadCount = useAppSelector((state) => state.notifications.unreadCount);
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('notifications:manage');
  const [view, setView] = React.useState<'unread' | 'all'>('unread');
  const [limit, setLimit] = React.useState(PAGE);

  const { data, isLoading, isError, isFetching, refetch } = useNotifications({ limit, unreadOnly: view === 'unread' ? true : undefined });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();

  const items = data?.items ?? [];
  const unreadTotal = data?.counts?.unread ?? data?.unreadCount ?? unreadCount;
  const allTotal = data?.counts?.all;
  const withCount = (label: string, n?: number) => (n === undefined ? label : `${label} · ${n.toLocaleString()}`);
  const close = () => dispatch(notificationPanelClosed());

  return (
    <>
      <BellButton unreadCount={unreadCount} open={open} onClick={() => dispatch(notificationPanelToggled())} />

      <Drawer open={open} onOpenChange={(next) => !next && close()}>
        <DrawerContent side="right" className="w-full max-w-[min(100vw,420px)] gap-0 p-0 max-sm:max-w-full">
          <div className="shrink-0 border-b px-4 pb-3 pt-4 pr-12" style={{ backgroundImage: `linear-gradient(135deg, color-mix(in oklch, ${TONE} 20%, transparent), color-mix(in oklch, var(--chart-4) 8%, transparent) 55%, transparent)` }}>
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ backgroundImage: `linear-gradient(135deg, ${TONE}, color-mix(in oklch, ${TONE} 55%, var(--chart-4)))` }}>
                <Bell className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <DrawerTitle className="flex items-center gap-2 text-base font-extrabold">
                  Notifications
                  {unreadCount > 0 ? (
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ backgroundColor: TONE }}>
                      {unreadCount > 99 ? '99+' : unreadCount} new
                    </span>
                  ) : null}
                </DrawerTitle>
                <DrawerDescription className="truncate text-xs">Read status is shared across your team</DrawerDescription>
              </div>
              {canManage ? (
                <Link href="/notifications/settings" onClick={close} aria-label="Notification settings" title="Notification settings" className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Settings className="size-4" />
                </Link>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <SegmentedTabs
                accent={COMM_ACCENT}
                size="sm"
                ariaLabel="Notification filter"
                value={view}
                onChange={(v) => {
                  setView(v);
                  setLimit(PAGE);
                }}
                options={[
                  { value: 'unread', label: withCount('Unread', unreadTotal) },
                  { value: 'all', label: withCount('All', allTotal) },
                ]}
              />
              <Button variant="ghost" size="sm" className="h-8" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending || unreadCount === 0}>
                <CheckCheck className="size-4" /> Mark all read
              </Button>
            </div>
          </div>

          <BellPanelFeed
            items={items}
            isLoading={isLoading}
            isError={isError}
            onRetry={() => void refetch()}
            unreadView={view === 'unread'}
            canDelete={canManage}
            onMarkRead={(id) => markRead.mutate(id)}
            onDelete={(id) => deleteNotification.mutate(id)}
            hasMore={!!data && items.length < data.total}
            isFetching={isFetching}
            onLoadMore={() => setLimit((l) => l + PAGE)}
          />

          <div className="shrink-0 border-t bg-muted/30 p-3">
            <Link href="/notifications" onClick={close} className="flex w-full items-center justify-center rounded-xl py-2 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ backgroundColor: TONE }}>
              View all notifications
            </Link>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
