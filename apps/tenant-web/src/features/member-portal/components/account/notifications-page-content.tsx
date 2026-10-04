'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Bell, BellOff, CalendarCheck, CheckCheck, CreditCard, Dumbbell, IdCard, Info, Megaphone, Salad, UserRound, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { formatRelativeTime } from '@/lib/format-relative-time';
import { useMarkAllMemberNotificationsRead, useMarkMemberNotificationRead, useMemberNotifications } from '../../hooks/use-member-portal';
import { formatDate, localDateKey } from '../../lib/format';
import type { MemberNotificationCategory, MemberPortalNotification } from '../../services/member-portal.service';
import { EmptyBlock, HeroAction, HeroChip, PortalHero, SkeletonCard, SkeletonHero } from '../kit';
import { toneChipStyle, toneColor, toneTint, type PortalTone } from '../kit/tones';

const CAT: Record<MemberNotificationCategory, { icon: LucideIcon; tone: PortalTone; label: string }> = {
  ANNOUNCEMENT: { icon: Megaphone, tone: 'orange', label: 'Announcements' },
  MEMBERSHIP: { icon: IdCard, tone: 'primary', label: 'Membership' },
  PAYMENT: { icon: CreditCard, tone: 'success', label: 'Payments' },
  ATTENDANCE: { icon: CalendarCheck, tone: 'info', label: 'Attendance' },
  WORKOUT: { icon: Dumbbell, tone: 'violet', label: 'Workout' },
  DIET: { icon: Salad, tone: 'success', label: 'Diet' },
  STAFF: { icon: UserRound, tone: 'info', label: 'From staff' },
  GENERAL: { icon: Bell, tone: 'muted', label: 'General' },
  SYSTEM: { icon: Info, tone: 'muted', label: 'System' },
  SUBSCRIPTION: { icon: CreditCard, tone: 'primary', label: 'Subscription' },
  MEMBER: { icon: UserRound, tone: 'primary', label: 'Account' },
};
const CHIPS: MemberNotificationCategory[] = ['ANNOUNCEMENT', 'MEMBERSHIP', 'PAYMENT', 'ATTENDANCE', 'WORKOUT', 'DIET', 'STAFF', 'GENERAL'];
const PAGE = 20;

function dayLabel(iso: string): string {
  const key = localDateKey(new Date(iso));
  const today = new Date();
  const y = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (key === localDateKey(today)) return 'Today';
  if (key === localDateKey(y)) return 'Yesterday';
  return formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function NotificationsPageContent() {
  const m = useMotionSafe();
  const [limit, setLimit] = React.useState(PAGE);
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [category, setCategory] = React.useState<MemberNotificationCategory | undefined>(undefined);
  const q = useMemberNotifications({ page: 1, limit, unreadOnly: unreadOnly || undefined, category });
  const markRead = useMarkMemberNotificationRead();
  const markAll = useMarkAllMemberNotificationsRead();
  const items = React.useMemo(() => q.data?.items ?? [], [q.data]);
  const unread = q.data?.unreadCount ?? 0;

  const groups = React.useMemo(() => {
    const out: { label: string; rows: MemberPortalNotification[] }[] = [];
    for (const n of items) {
      const label = dayLabel(n.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.rows.push(n);
      else out.push({ label, rows: [n] });
    }
    return out;
  }, [items]);

  if (q.isLoading && !q.data) {
    return (
      <div className="space-y-4">
        <SkeletonHero />
        <SkeletonCard lines={3} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PortalHero
        eyebrow="Inbox"
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread ${unread === 1 ? 'update' : 'updates'}` : "You're all caught up"}
        chips={unread > 0 ? <HeroChip><span className="size-1.5 rounded-full bg-white" /> {unread} new</HeroChip> : <HeroChip><CheckCheck className="size-3" /> All read</HeroChip>}
        aside={
          <span className="relative grid size-16 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25">
            <Bell className="size-7" />
            {unread > 0 ? <span className="absolute -right-1.5 -top-1.5 grid min-w-6 place-items-center rounded-full bg-white px-1.5 text-xs font-bold text-[color:var(--primary)]">{unread > 99 ? '99+' : unread}</span> : null}
          </span>
        }
        actions={
          <HeroAction variant={unread > 0 ? 'solid' : 'ghost'} onClick={() => markAll.mutate()} disabled={markAll.isPending || unread === 0}>
            <CheckCheck className="size-4" /> Mark all read
          </HeroAction>
        }
      />

      <div className="space-y-2">
        <div role="tablist" aria-label="Read state" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          {[{ v: false, l: 'All' }, { v: true, l: `Unread${unread ? ` (${unread})` : ''}` }].map((t) => (
            <button key={t.l} type="button" role="tab" aria-selected={unreadOnly === t.v} onClick={() => setUnreadOnly(t.v)} className={cn('relative min-h-11 rounded-lg text-sm font-semibold transition-colors', unreadOnly === t.v ? 'text-foreground' : 'text-muted-foreground')}>
              {unreadOnly === t.v ? <motion.span layoutId="notif-read-pill" className="absolute inset-0 rounded-lg bg-card shadow-sm" transition={{ type: 'spring', stiffness: 420, damping: 34 }} /> : null}
              <span className="relative">{t.l}</span>
            </button>
          ))}
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0">
          {[undefined, ...CHIPS].map((c) => {
            const active = category === c;
            const meta = c ? CAT[c] : null;
            return (
              <button
                key={c ?? 'all'}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(c)}
                className={cn('inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition active:scale-95', !active && 'bg-card hover:bg-accent')}
                style={active ? { background: toneTint(meta?.tone ?? 'primary', 16), borderColor: toneColor(meta?.tone ?? 'primary'), color: toneColor(meta?.tone ?? 'primary') } : undefined}
              >
                {meta ? <meta.icon className="size-4" /> : null}
                {meta ? meta.label : 'Everything'}
              </button>
            );
          })}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border bg-card">
          <EmptyBlock icon={unreadOnly ? BellOff : Bell} title={unreadOnly ? 'No unread notifications' : 'Nothing here yet'} description="Updates about your membership, payments, and gym announcements will show up here." />
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</h2>
              <motion.ul variants={m.staggerContainer(0.05)} initial={m.initial} animate="show" className="space-y-2">
                {g.rows.map((n) => {
                  const meta = CAT[n.category] ?? CAT.GENERAL;
                  const isUnread = !n.readAt;
                  return (
                    <motion.li key={n.id} variants={m.fadeUp} layout={!m.reduce}>
                      <button
                        type="button"
                        onClick={() => isUnread && markRead.mutate(n.id)}
                        className={cn('relative flex min-h-16 w-full items-start gap-3 overflow-hidden rounded-2xl border p-3.5 text-left transition active:scale-[0.99]', isUnread ? 'bg-card shadow-sm' : 'bg-card/60')}
                        style={isUnread ? { borderColor: toneTint(meta.tone, 40) } : undefined}
                      >
                        {isUnread ? <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: toneColor(meta.tone) }} /> : null}
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={toneChipStyle(isUnread ? meta.tone : 'muted')}>
                          <meta.icon className="size-[18px]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className={cn('min-w-0 flex-1 truncate text-sm', isUnread ? 'font-semibold' : 'font-medium text-muted-foreground')}>{n.title}</span>
                            {isUnread ? <span className="size-2 shrink-0 rounded-full" style={{ background: toneColor(meta.tone) }} aria-label="Unread" /> : null}
                          </span>
                          <span className={cn('mt-0.5 block break-words text-sm', isUnread ? 'text-foreground/80' : 'text-muted-foreground')}>{n.body}</span>
                          <span className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={toneChipStyle(meta.tone)}>{meta.label}</span>
                            {formatRelativeTime(n.createdAt)}
                          </span>
                        </span>
                      </button>
                    </motion.li>
                  );
                })}
              </motion.ul>
            </section>
          ))}
          {q.data && q.data.total > items.length ? (
            <button type="button" onClick={() => setLimit((l) => l + PAGE)} disabled={q.isFetching} className="min-h-11 w-full rounded-xl border bg-card text-sm font-semibold hover:bg-accent disabled:opacity-60">
              {q.isFetching ? 'Loading…' : `Load more (${q.data.total - items.length} left)`}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
