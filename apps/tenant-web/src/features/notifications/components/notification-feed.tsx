'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Bell, Check, Trash2 } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/features/reports/components/ui';
import { staggerDelay, useMotionSafe } from '@/features/reports/lib/motion';
import { formatRelativeTime } from '@/lib/format-relative-time';
import { cn } from '@/lib/utils';
import { CATEGORY_COLOR, CATEGORY_ICON, COMM_ACCENT, NOTIFICATION_TABS, dayGroupLabel, type NotificationFilterTab } from '../constants';
import type { TenantNotification } from '../types';

interface NotificationFeedProps {
  /** Only used when `showTabs` (the header drawer); the page filters on the server instead. */
  tab?: NotificationFilterTab;
  onTabChange?: (tab: NotificationFilterTab) => void;
  items: TenantNotification[];
  isLoading: boolean;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  /** Smaller icons/padding for the header Drawer; the full page uses the roomier default. */
  compact?: boolean;
  /** Render the built-in tab chips (drawer). The page sets this false and owns its filters. */
  showTabs?: boolean;
  /** Group rows under Today / Yesterday / date headings (page). */
  grouped?: boolean;
  /** Delete needs `notifications:manage` on the API; hide the action without it. */
  canDelete?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

function FeedRow({
  notification,
  index,
  compact,
  canDelete,
  onMarkRead,
  onDelete,
}: {
  notification: TenantNotification;
  index: number;
  compact: boolean;
  canDelete: boolean;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const m = useMotionSafe();
  const Icon = CATEGORY_ICON[notification.category];
  const tone = CATEGORY_COLOR[notification.category];
  const unread = !notification.readAt;
  return (
    <motion.div
      initial={m.reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1], delay: staggerDelay(index, 0.03, 10) }}
      whileHover={m.reduce ? undefined : { x: 2 }}
      className={cn(
        'group relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border bg-card text-left shadow-xs transition-shadow duration-150 hover:shadow-md',
        compact ? 'p-3' : 'p-4',
      )}
      style={unread ? { backgroundImage: `linear-gradient(100deg, color-mix(in oklch, ${tone} 9%, transparent), transparent 60%)`, borderColor: `color-mix(in oklch, ${tone} 28%, var(--border))` } : undefined}
    >
      {unread ? <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: tone }} /> : null}
      <button type="button" onClick={() => unread && onMarkRead(notification.id)} className="flex min-w-0 flex-1 items-start gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span
          className={cn('mt-0.5 flex shrink-0 items-center justify-center rounded-xl', compact ? 'size-8' : 'size-10')}
          style={{ backgroundColor: `color-mix(in oklch, ${tone} 16%, transparent)`, color: tone, boxShadow: `0 0 0 1px color-mix(in oklch, ${tone} 20%, transparent)` }}
        >
          <Icon className={compact ? 'size-4' : 'size-5'} aria-hidden />
        </span>
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="flex items-center gap-2">
            <span className={cn('truncate', compact ? 'text-sm' : 'text-[15px]', unread ? 'font-bold' : 'font-semibold text-foreground/85')}>{notification.title}</span>
            {unread ? (
              <span className="relative flex size-2 shrink-0" aria-label="Unread">
                {m.reduce ? null : <span className="absolute inline-flex size-full animate-ping rounded-full opacity-60" style={{ backgroundColor: tone }} />}
                <span className="relative inline-flex size-2 rounded-full" style={{ backgroundColor: tone }} />
              </span>
            ) : null}
          </span>
          <span className={cn('block text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>{notification.body}</span>
          <span className="block text-xs text-muted-foreground/90">{formatRelativeTime(notification.createdAt)}</span>
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        {unread ? (
          <button
            type="button"
            aria-label="Mark as read"
            title="Mark as read"
            onClick={() => onMarkRead(notification.id)}
            className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Check className="size-3.5" />
          </button>
        ) : null}
        {canDelete ? (
          <button
            type="button"
            aria-label="Delete notification"
            title="Delete"
            onClick={() => onDelete(notification.id)}
            className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
      </div>
    </motion.div>
  );
}

/**
 * Shared by the header Notification Center drawer (`compact`, built-in tabs, client-filtered 50 rows)
 * and the `/notifications` page (`grouped`, no tabs: server-side filters live in the page).
 */
export function NotificationFeed({
  tab,
  onTabChange,
  items,
  isLoading,
  onMarkRead,
  onDelete,
  compact = false,
  showTabs = true,
  grouped = false,
  canDelete = true,
  emptyTitle = 'Nothing here',
  emptyDescription = "You're all caught up.",
}: NotificationFeedProps) {
  const groups = React.useMemo(() => {
    if (!grouped) return [{ label: '', rows: items.map((n, i) => ({ n, i })) }];
    const out: Array<{ label: string; rows: Array<{ n: TenantNotification; i: number }> }> = [];
    items.forEach((n, i) => {
      const label = dayGroupLabel(n.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.rows.push({ n, i });
      else out.push({ label, rows: [{ n, i }] });
    });
    return out;
  }, [items, grouped]);

  return (
    <div className={cn('space-y-3', compact && 'flex min-h-0 flex-1 flex-col gap-3 space-y-0')}>
      {showTabs ? (
        <div className={cn('flex flex-wrap gap-1.5', compact && 'shrink-0')}>
          {NOTIFICATION_TABS.map((t) => {
            const active = tab === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => onTabChange?.(t.value)}
                aria-pressed={active}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active ? 'text-white shadow-sm' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
                style={active ? { backgroundColor: 'var(--chart-7)' } : undefined}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className={cn('space-y-2', compact && 'min-h-0 flex-1 overflow-y-auto')}>
        {isLoading ? (
          Array.from({ length: compact ? 4 : 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)
        ) : items.length === 0 ? (
          <EmptyState icon={Bell} title={emptyTitle} description={emptyDescription} accent={COMM_ACCENT} compact={compact} />
        ) : (
          groups.map((g) => (
            <div key={g.label || 'all'} className="space-y-2">
              {g.label ? <p className="px-1 pt-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{g.label}</p> : null}
              {g.rows.map(({ n, i }) => (
                <FeedRow key={n.id} notification={n} index={i} compact={compact} canDelete={canDelete} onMarkRead={onMarkRead} onDelete={onDelete} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
