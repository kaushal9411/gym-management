'use client';

import { Bell } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeTime } from '@/lib/format-relative-time';
import { cn } from '@/lib/utils';
import {
  useMarkAllMemberNotificationsRead,
  useMarkMemberNotificationRead,
  useMemberNotifications,
} from '@/features/member-portal/hooks/use-member-portal';

export default function MemberNotificationsPage() {
  const { data, isLoading } = useMemberNotifications({ page: 1, limit: 20 });
  const markRead = useMarkMemberNotificationRead();
  const markAllRead = useMarkAllMemberNotificationsRead();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Notifications</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending || (data?.unreadCount ?? 0) === 0}
        >
          Mark all read
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={Bell} title="Nothing here yet" description="Updates about your membership, payments, and gym announcements will show up here." />
      ) : (
        <div className="space-y-2">
          {data.items.map((notification) => (
            <Card
              key={notification.id}
              className={cn(!notification.readAt && 'border-primary/20 bg-primary/5')}
            >
              <CardContent
                className="flex cursor-pointer items-start gap-3 py-3"
                role="button"
                tabIndex={0}
                onClick={() => !notification.readAt && markRead.mutate(notification.id)}
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{notification.title}</p>
                    {!notification.readAt && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                  </div>
                  <p className="text-sm text-muted-foreground">{notification.body}</p>
                  <p className="text-xs text-muted-foreground">{formatRelativeTime(notification.createdAt)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
