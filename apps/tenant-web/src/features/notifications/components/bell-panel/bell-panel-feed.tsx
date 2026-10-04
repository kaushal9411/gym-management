'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, PartyPopper, Trash2 } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/features/reports/components/ui';
import { EASE, staggerDelay, useMotionSafe } from '@/features/reports/lib/motion';
import { formatRelativeTime } from '@/lib/format-relative-time';
import { cn } from '@/lib/utils';
import { CATEGORY_COLOR, CATEGORY_ICON, CATEGORY_LABEL, COMM_ACCENT, dayGroupLabel } from '../../constants';
import type { TenantNotification } from '../../types';

function BellRow({ n, index, canDelete, onMarkRead, onDelete }: { n: TenantNotification; index: number; canDelete: boolean; onMarkRead: (id: string) => void; onDelete: (id: string) => void }) {
  const m = useMotionSafe();
  const Icon = CATEGORY_ICON[n.category];
  const tone = CATEGORY_COLOR[n.category];
  const unread = !n.readAt;
  return (
    <motion.li
      layout={m.reduce ? false : 'position'}
      initial={m.reduce ? false : { opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={m.reduce ? { opacity: 0 } : { opacity: 0, x: 24, height: 0, marginTop: 0, transition: { duration: 0.22 } }}
      transition={{ duration: 0.3, ease: EASE, delay: staggerDelay(index, 0.03, 8) }}
      className="group relative flex items-start gap-3 overflow-hidden rounded-xl border bg-card p-3 transition-shadow hover:shadow-md"
      style={unread ? { backgroundImage: `linear-gradient(100deg, color-mix(in oklch, ${tone} 10%, transparent), transparent 65%)`, borderColor: `color-mix(in oklch, ${tone} 28%, var(--border))` } : undefined}
    >
      {unread ? <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: tone }} /> : null}
      <button
        type="button"
        onClick={() => unread && onMarkRead(n.id)}
        className="flex min-w-0 flex-1 items-start gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `color-mix(in oklch, ${tone} 16%, transparent)`, color: tone, boxShadow: `0 0 0 1px color-mix(in oklch, ${tone} 20%, transparent)` }}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="flex items-center gap-2">
            <span className={cn('truncate text-sm', unread ? 'font-bold' : 'font-semibold text-foreground/80')}>{n.title}</span>
            {unread ? (
              <span className="relative flex size-2 shrink-0" role="img" aria-label="Unread">
                {m.reduce ? null : <span className="absolute inline-flex size-full animate-ping rounded-full opacity-60" style={{ backgroundColor: tone }} />}
                <span className="relative inline-flex size-2 rounded-full" style={{ backgroundColor: tone }} />
              </span>
            ) : null}
          </span>
          <span className="line-clamp-2 block break-words text-xs text-muted-foreground">{n.body}</span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground/90">
            <span className="font-semibold" style={{ color: tone }}>{CATEGORY_LABEL[n.category]}</span>
            <span aria-hidden>·</span>
            <span>{formatRelativeTime(n.createdAt)}</span>
          </span>
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
        {unread ? (
          <button type="button" aria-label="Mark as read" title="Mark as read" onClick={() => onMarkRead(n.id)} className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Check className="size-3.5" />
          </button>
        ) : null}
        {canDelete ? (
          <button type="button" aria-label="Delete notification" title="Delete" onClick={() => onDelete(n.id)} className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
      </div>
    </motion.li>
  );
}

/** Scrollable compact feed for the header bell Drawer: day groups with sticky headers, skeleton, empty + error states, Load more. */
export function BellPanelFeed({
  items,
  isLoading,
  isError,
  onRetry,
  unreadView,
  canDelete,
  onMarkRead,
  onDelete,
  hasMore,
  isFetching,
  onLoadMore,
}: {
  items: TenantNotification[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  unreadView: boolean;
  canDelete: boolean;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  hasMore: boolean;
  isFetching: boolean;
  onLoadMore: () => void;
}) {
  const groups = React.useMemo(() => {
    const out: Array<{ label: string; rows: Array<{ n: TenantNotification; i: number }> }> = [];
    items.forEach((n, i) => {
      const label = dayGroupLabel(n.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.rows.push({ n, i });
      else out.push({ label, rows: [{ n, i }] });
    });
    return out;
  }, [items]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3">
      {isError && items.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          accent="staff"
          compact
          title="Could not load notifications"
          action={
            <button type="button" onClick={onRetry} className="rounded-lg border px-3 py-1.5 text-xs font-bold hover:bg-accent">
              Try again
            </button>
          }
        />
      ) : isLoading ? (
        <div className="space-y-2 pt-3" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={PartyPopper}
          accent={COMM_ACCENT}
          compact
          title={unreadView ? "You're all caught up" : 'No notifications yet'}
          description={unreadView ? 'Nothing unread right now. New alerts will show up here.' : 'Alerts about members, payments and more will appear here.'}
        />
      ) : (
        <>
          {groups.map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h3 className="sticky top-0 z-10 -mx-3 bg-card/90 px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground backdrop-blur">{g.label}</h3>
              <ul className="space-y-2">
                <AnimatePresence initial={false}>
                  {g.rows.map(({ n, i }) => (
                    <BellRow key={n.id} n={n} index={i} canDelete={canDelete} onMarkRead={onMarkRead} onDelete={onDelete} />
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          ))}
          {hasMore ? (
            <button
              type="button"
              onClick={onLoadMore}
              disabled={isFetching}
              className="mt-3 w-full rounded-xl border py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isFetching ? 'Loading...' : 'Load more'}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
