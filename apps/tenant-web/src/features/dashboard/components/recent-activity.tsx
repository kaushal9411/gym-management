'use client';

import { Activity } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeTime } from '@/lib/format-relative-time';
import { useNotifications } from '@/features/notifications/hooks/use-notifications';

/** Reuses the real tenant-notification feed as the "Recent Activities" widget — genuine data, not a placeholder. */
export function RecentActivity() {
  const { data, isLoading } = useNotifications({ limit: 5 });
  const items = data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Activities</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
        ) : items.length === 0 ? (
          <EmptyState icon={Activity} title="No recent activity" />
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-start gap-3 text-sm">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{formatRelativeTime(item.createdAt)}</p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
