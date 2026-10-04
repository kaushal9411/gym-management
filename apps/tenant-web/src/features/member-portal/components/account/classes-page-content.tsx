'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { CalendarCheck, CalendarClock, CalendarRange, ChevronLeft, ChevronRight, Clock, MapPin, UserRound, Users } from 'lucide-react';

import { cn } from '@/lib/utils';
import { LoadingButton } from '@/components/ui/loading-button';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { useBookClass, useCancelMemberBooking, useMemberBookings, useMemberClasses } from '../../hooks/use-member-portal';
import { formatDate, formatDay, formatTime, localDateKey, plural } from '../../lib/format';
import type { MemberPortalBooking, MemberPortalClassSession } from '../../services/member-portal.service';
import { EmptyBlock, HeroChip, ListRow, PortalHero, PortalList, SectionCard, SheetModal, SkeletonCard, StatusChip } from '../kit';
import { toneColor, toneTint } from '../kit/tones';
import { useNow } from './use-now';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
const dayKey = (iso: string) => iso.slice(0, 10);
function startOf(s: { sessionDate: string; startTime: string }): Date {
  return new Date(`${dayKey(s.sessionDate)}T${s.startTime.slice(0, 5)}:00`);
}
function endOf(s: { sessionDate: string; endTime: string }): Date {
  return new Date(`${dayKey(s.sessionDate)}T${s.endTime.slice(0, 5)}:00`);
}
function countdown(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60_000));
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `in ${h}h ${mins % 60}m`;
  const d = Math.floor(h / 24);
  return `in ${d}d ${h % 24}h`;
}

type Target = { kind: 'cancel'; bookingId: string; title: string; when: string } | null;

export function ClassesPageContent() {
  const m = useMotionSafe();
  const now = useNow();
  const [weekStart, setWeekStart] = React.useState(() => mondayOf(new Date()));
  const [selected, setSelected] = React.useState(() => localDateKey(new Date()));
  const [confirm, setConfirm] = React.useState<Target>(null);

  const days = React.useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const keys = days.map(localDateKey);
  const sessions = useMemberClasses(keys[0]!, keys[6]!);
  const bookings = useMemberBookings();
  const book = useBookClass();
  const cancel = useCancelMemberBooking();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const bookedBySession = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const b of bookings.data ?? []) if (b.status === 'BOOKED') map.set(b.session.id, b.id);
    return map;
  }, [bookings.data]);

  const countByDay = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions.data ?? []) if (s.status === 'SCHEDULED') map.set(dayKey(s.sessionDate), (map.get(dayKey(s.sessionDate)) ?? 0) + 1);
    return map;
  }, [sessions.data]);

  const daySessions = React.useMemo(
    () => (sessions.data ?? []).filter((s) => dayKey(s.sessionDate) === selected).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [sessions.data, selected],
  );

  const upcoming = React.useMemo(() => {
    const t = now?.getTime() ?? 0;
    return (bookings.data ?? [])
      .filter((b) => b.status === 'BOOKED' && endOf(b.session).getTime() >= t)
      .sort((a, b) => startOf(a.session).getTime() - startOf(b.session).getTime());
  }, [bookings.data, now]);
  const past = React.useMemo(() => {
    const ids = new Set(upcoming.map((b) => b.id));
    return (bookings.data ?? []).filter((b) => !ids.has(b.id)).sort((a, b) => startOf(b.session).getTime() - startOf(a.session).getTime()).slice(0, 8);
  }, [bookings.data, upcoming]);

  const thisWeekCount = React.useMemo(() => {
    const a = localDateKey(mondayOf(new Date()));
    const b = localDateKey(addDays(mondayOf(new Date()), 6));
    return (bookings.data ?? []).filter((x) => x.status === 'BOOKED' && dayKey(x.session.sessionDate) >= a && dayKey(x.session.sessionDate) <= b).length;
  }, [bookings.data]);

  const next = upcoming[0];

  const handleBook = (s: MemberPortalClassSession) => {
    setPendingId(s.id);
    book.mutate(s.id, {
      onSuccess: () => toast.success('Booked in!'),
      onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Could not book this session.'),
      onSettled: () => setPendingId(null),
    });
  };
  const handleCancel = () => {
    if (!confirm) return;
    cancel.mutate(confirm.bookingId, {
      onSuccess: () => {
        toast.success('Booking cancelled.');
        setConfirm(null);
      },
      onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Could not cancel this booking.'),
    });
  };
  const askCancel = (bookingId: string, s: { groupClass: { name: string }; sessionDate: string; startTime: string; endTime: string }) =>
    setConfirm({ kind: 'cancel', bookingId, title: s.groupClass.name, when: `${formatDay(s.sessionDate)} · ${formatTime(s.startTime)}–${formatTime(s.endTime)}` });

  const todayKey = localDateKey(new Date());
  const weekLabel = `${formatDate(keys[0], { day: 'numeric', month: 'short' })} – ${formatDate(keys[6], { day: 'numeric', month: 'short' })}`;
  const shiftWeek = (n: number) => {
    const ws = addDays(weekStart, n * 7);
    setWeekStart(ws);
    const t = mondayOf(new Date()).getTime() === ws.getTime();
    setSelected(t ? localDateKey(new Date()) : localDateKey(ws));
  };

  return (
    <div className="space-y-4">
      <PortalHero
        eyebrow="Group classes"
        title={next ? next.session.groupClass.name : 'Book a class'}
        subtitle={
          next
            ? `${formatDay(next.session.sessionDate)} · ${formatTime(next.session.startTime)}–${formatTime(next.session.endTime)} · ${next.session.branch.name}`
            : 'Pick a day below and reserve your spot.'
        }
        chips={
          <>
            {next && now ? <HeroChip><Clock className="size-3" /> Starts {countdown(startOf(next.session).getTime() - now.getTime())}</HeroChip> : null}
            {!next && !bookings.isLoading ? <HeroChip>No upcoming bookings</HeroChip> : null}
          </>
        }
        stats={[
          { label: 'This week', value: thisWeekCount },
          { label: 'Upcoming', value: upcoming.length },
          { label: 'Attended', value: (bookings.data ?? []).filter((b) => b.status === 'ATTENDED').length },
        ]}
      />

      <section className="rounded-2xl border bg-card p-3 shadow-xs">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button type="button" aria-label="Previous week" onClick={() => shiftWeek(-1)} className="grid size-11 place-items-center rounded-xl hover:bg-accent active:scale-95">
            <ChevronLeft className="size-5" />
          </button>
          <p className="text-sm font-semibold">{weekLabel}</p>
          <button type="button" aria-label="Next week" onClick={() => shiftWeek(1)} className="grid size-11 place-items-center rounded-xl hover:bg-accent active:scale-95">
            <ChevronRight className="size-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            const k = keys[i]!;
            const active = k === selected;
            const n = countByDay.get(k) ?? 0;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setSelected(k)}
                aria-pressed={active}
                className={cn('relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 transition-colors', active ? 'text-primary-foreground' : 'hover:bg-accent')}
              >
                {active ? <motion.span layoutId="classes-day-pill" className="absolute inset-0 rounded-xl bg-primary shadow-md" transition={{ type: 'spring', stiffness: 420, damping: 34 }} /> : null}
                <span className="relative text-[10px] font-medium uppercase tracking-wide opacity-80">{DOW[i]}</span>
                <span className={cn('relative text-base font-semibold tabular-nums', k === todayKey && !active && 'text-primary')}>{d.getDate()}</span>
                <span className="relative flex h-1.5 gap-0.5">
                  {Array.from({ length: Math.min(n, 3) }).map((_, j) => (
                    <span key={j} className="size-1.5 rounded-full" style={{ background: active ? 'currentColor' : toneColor('primary') }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="space-y-3">
        <h2 className="px-1 text-sm font-semibold text-muted-foreground">{formatDay(selected)} · {plural(daySessions.length, 'class', 'classes')}</h2>
        {sessions.isLoading ? (
          <div className="space-y-3"><SkeletonCard lines={3} /><SkeletonCard lines={3} /></div>
        ) : daySessions.length === 0 ? (
          <div className="rounded-2xl border bg-card"><EmptyBlock icon={CalendarRange} title="No classes this day" description="Try another day in the strip, or check next week." /></div>
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={selected} variants={m.staggerContainer(0.06)} initial={m.initial} animate="show" className="space-y-3">
              {daySessions.map((s) => {
                const bookingId = bookedBySession.get(s.id);
                const full = s.bookedCount >= s.capacity;
                const ended = !!now && endOf(s).getTime() < now.getTime();
                const pct = s.capacity ? Math.min(100, (s.bookedCount / s.capacity) * 100) : 0;
                const tone = bookingId ? 'success' : full ? 'danger' : pct >= 75 ? 'warning' : 'primary';
                const busy = pendingId === s.id && book.isPending;
                return (
                  <motion.article key={s.id} variants={m.fadeUp} className="overflow-hidden rounded-2xl border bg-card shadow-xs" style={bookingId ? { borderColor: toneTint('success', 45) } : undefined}>
                    <div className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold">{s.groupClass.name}</h3>
                          <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-primary"><Clock className="size-3.5" />{formatTime(s.startTime)} – {formatTime(s.endTime)}</p>
                        </div>
                        {bookingId ? <StatusChip tone="success">Booked</StatusChip> : s.status !== 'SCHEDULED' ? <StatusChip tone="muted">{s.status === 'CANCELLED' ? 'Cancelled' : 'Completed'}</StatusChip> : ended ? <StatusChip tone="muted">Ended</StatusChip> : full ? <StatusChip tone="danger">Full</StatusChip> : null}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {s.trainer ? <span className="flex items-center gap-1"><UserRound className="size-3.5" />{s.trainer.name}</span> : null}
                        <span className="flex items-center gap-1"><MapPin className="size-3.5" />{s.branch.name}</span>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 text-muted-foreground"><Users className="size-3.5" />{s.bookedCount}/{s.capacity} booked</span>
                          <span className="font-medium tabular-nums" style={{ color: toneColor(tone) }}>{full ? 'Full' : plural(Math.max(s.capacity - s.bookedCount, 0), 'spot left', 'spots left')}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full" style={{ background: toneTint(tone, 15) }}>
                          <motion.div className="h-full origin-left rounded-full" style={{ background: toneColor(tone), width: `${pct}%` }} initial={m.reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }} />
                        </div>
                      </div>
                      {bookingId ? (
                        <button type="button" onClick={() => askCancel(bookingId, s)} className="min-h-11 w-full rounded-xl border border-destructive/30 text-sm font-semibold text-destructive transition active:scale-[0.98] hover:bg-destructive/10">
                          Cancel booking
                        </button>
                      ) : s.status === 'SCHEDULED' && !full && !ended ? (
                        <LoadingButton type="button" className="min-h-11 w-full rounded-xl" loading={busy} loadingText="Booking…" onClick={() => handleBook(s)}>
                          Book this class
                        </LoadingButton>
                      ) : null}
                    </div>
                  </motion.article>
                );
              })}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <SectionCard title="My bookings" subtitle={upcoming.length ? plural(upcoming.length, 'upcoming booking') : 'Nothing booked yet'} icon={CalendarCheck} tone="success" flush>
        {bookings.isLoading ? (
          <div className="p-4"><SkeletonCard lines={2} /></div>
        ) : upcoming.length === 0 && past.length === 0 ? (
          <EmptyBlock compact icon={CalendarClock} title="No bookings yet" description="Book a class above and it will show up here." />
        ) : (
          <PortalList>
              {upcoming.map((b) => (
                <BookingRow key={b.id} booking={b} onClick={() => askCancel(b.id, b.session)} />
              ))}
              {past.length ? (
                <li className="bg-muted/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Past</li>
              ) : null}
              {past.map((b) => (
                <BookingRow key={b.id} booking={b} past />
              ))}
          </PortalList>
        )}
      </SectionCard>

      <SheetModal open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)} title="Cancel this booking?" description={confirm ? `${confirm.title} · ${confirm.when}` : undefined}>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setConfirm(null)} className="min-h-11 rounded-xl border text-sm font-semibold hover:bg-accent">Keep it</button>
          <LoadingButton type="button" variant="destructive" className="min-h-11 rounded-xl" loading={cancel.isPending} loadingText="Cancelling…" onClick={handleCancel}>Cancel booking</LoadingButton>
        </div>
      </SheetModal>
    </div>
  );
}

const BOOKING_TONE: Record<MemberPortalBooking['status'], { tone: 'success' | 'muted' | 'danger' | 'info'; label: string }> = {
  BOOKED: { tone: 'info', label: 'Booked' },
  ATTENDED: { tone: 'success', label: 'Attended' },
  CANCELLED: { tone: 'muted', label: 'Cancelled' },
  NO_SHOW: { tone: 'danger', label: 'Missed' },
};

function BookingRow({ booking, past, onClick }: { booking: MemberPortalBooking; past?: boolean; onClick?: () => void }) {
  const t = BOOKING_TONE[booking.status];
  const s = booking.session;
  // A BOOKED row whose session already ended (never marked) reads as plain past.
  return (
    <ListRow
      icon={CalendarRange}
      tone={past ? 'muted' : 'primary'}
      title={s.groupClass.name}
      subtitle={`${formatDay(s.sessionDate)} · ${formatTime(s.startTime)}–${formatTime(s.endTime)} · ${s.branch.name}`}
      trailing={<StatusChip tone={t.tone}>{t.label}</StatusChip>}
      onClick={onClick}
      hideChevron={!onClick}
    />
  );
}
