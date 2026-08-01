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
            <div
              key={announcement.id}
              className="flex gap-3 rounded-xl border bg-card p-3.5 transition-colors hover:bg-accent/30"
            >
              <span
                className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full"
                style={{
                  backgroundColor: 'color-mix(in oklch, var(--chart-7) 16%, transparent)',
                  color: 'var(--chart-7)',
                }}
              >
                <Megaphone className="size-3.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{announcement.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{announcement.body}</p>
                {announcement.publishedAt && (
                  <p className="mt-1.5 text-xs text-muted-foreground/70">{formatRelativeTime(announcement.publishedAt)}</p>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
