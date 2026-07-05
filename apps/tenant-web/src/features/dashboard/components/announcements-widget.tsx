'use client';

import { Megaphone } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeTime } from '@/lib/format-relative-time';
import { useAnnouncements } from '../hooks/use-announcements';

export function AnnouncementsWidget() {
  const { data, isLoading } = useAnnouncements();
  const items = data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Announcements</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
        ) : items.length === 0 ? (
          <EmptyState icon={Megaphone} title="No announcements" description="Platform announcements will appear here." />
        ) : (
          items.map((announcement) => (
            <div key={announcement.id} className="rounded-lg border p-3">
              <p className="text-sm font-medium">{announcement.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{announcement.body}</p>
              {announcement.publishedAt && (
                <p className="mt-1 text-xs text-muted-foreground">{formatRelativeTime(announcement.publishedAt)}</p>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
