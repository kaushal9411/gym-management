'use client';

import * as React from 'react';
import { Bell, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeTime } from '@/lib/format-relative-time';
import { cn } from '@/lib/utils';
import { CATEGORY_ICON, NOTIFICATION_TABS, type NotificationFilterTab } from '../constants';
import type { NotificationCategory, TenantNotification } from '../types';

/**
 * Subtle per-category tint for the icon circle — kept to the handful of
 * categories members see most often so a dense feed doesn't turn into a
 * rainbow; everything else keeps the original neutral `bg-muted` treatment.
 */
const CATEGORY_TONE_VAR: Partial<Record<NotificationCategory, string>> = {
  PAYMENT: 'var(--success)',
  ATTENDANCE: 'var(--chart-3)',
  ANNOUNCEMENT: 'var(--chart-2)',
};

interface NotificationFeedProps {
  tab: NotificationFilterTab;
  onTabChange: (tab: NotificationFilterTab) => void;
  items: TenantNotification[];
  isLoading: boolean;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  /** Smaller icons/padding for the header Drawer; the full History page uses the roomier default. */
  compact?: boolean;
}

/**
 * Shared between the header's Notification Center drawer and the full
 * `/notifications` History page — previously these were two near-identical
 * copies of the same tab/list markup (see FRONTEND-GUIDE.md's note on this);
 * extracted here once this module added 7 more categories and a delete
 * action, since a third copy would have made the divergence worse.
 */
export function NotificationFeed({ tab, onTabChange, items, isLoading, onMarkRead, onDelete, compact = false }: NotificationFeedProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {NOTIFICATION_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => onTabChange(t.value)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150',
              tab === t.value
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={cn('space-y-2', compact && 'flex-1 overflow-y-auto')}>
        {isLoading ? (
          Array.from({ length: compact ? 4 : 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
        ) : items.length === 0 ? (
          <EmptyState icon={Bell} title="Nothing here" description="You're all caught up." />
        ) : (
          items.map((notification) => {
            const Icon = CATEGORY_ICON[notification.category];
            const toneVar = CATEGORY_TONE_VAR[notification.category];
            return (
              <div
                key={notification.id}
                className={cn(
                  'group flex w-full items-start gap-3 rounded-lg border border-border text-left shadow-xs transition-all duration-150 hover:border-accent-foreground/20 hover:shadow-sm',
                  compact ? 'p-3' : 'p-4',
                  !notification.readAt && 'border-primary/20 bg-primary/5',
                )}
              >
                <button
                  type="button"
                  onClick={() => !notification.readAt && onMarkRead(notification.id)}
                  className="flex min-w-0 flex-1 items-start gap-3 text-left"
                >
                  <span
                    className={cn(
                      'mt-0.5 flex shrink-0 items-center justify-center rounded-full',
                      compact ? 'size-8' : 'size-9',
                      !toneVar && 'bg-muted text-muted-foreground',
                    )}
                    style={
                      toneVar
                        ? { backgroundColor: `color-mix(in oklch, ${toneVar} 16%, transparent)`, color: toneVar }
                        : undefined
                    }
                  >
                    <Icon className={compact ? 'size-4' : 'size-4.5'} />
                  </span>
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="flex items-center gap-2">
                      <span className={cn('truncate font-medium', compact ? 'text-sm' : '')}>{notification.title}</span>
                      {!notification.readAt && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                    </span>
                    <span className={cn('block text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>{notification.body}</span>
                    <span className="block text-xs text-muted-foreground">{formatRelativeTime(notification.createdAt)}</span>
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                  aria-label="Delete notification"
                  onClick={() => onDelete(notification.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
