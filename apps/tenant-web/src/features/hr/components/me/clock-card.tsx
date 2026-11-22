'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarOff, Flame, LogIn, LogOut, MapPin, ShieldCheck, Sun, TimerReset } from 'lucide-react';
import { toast } from 'sonner';

import { LoadingButton } from '@/components/ui/loading-button';
import { cn } from '@/lib/utils';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { clockParts, formatDay, formatMinutes, formatTime, greeting } from '../../lib/dates';
import { HR_HERO_BG, mix, TONES } from '../../lib/hr-palette';
import { DAY_STATUS_LABEL, DAY_STATUS_TONE } from '../../lib/status';
import { hrKeys, toHrError, useCheckIn, useCheckOut } from '../../hooks/use-hr';
import type { AttendanceDay, MeSummary } from '../../types';
import { ToneChip } from '../ui/hr-ui';

/** Seconds-ticking IST clock. Renders a stable placeholder on the server/first paint to avoid a hydration mismatch. */
function useNow(intervalMs = 1000): Date | null {
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Consecutive worked days up to today within the loaded month; weekly offs / holidays / approved leave do not break it, an absent day does. */
export function computeStreak(days: AttendanceDay[], today: string): number {
  const sorted = [...days].filter((d) => d.date <= today).sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  for (const d of sorted) {
    if (d.status === 'PRESENT' || d.status === 'LATE' || d.status === 'HALF_DAY') streak += 1;
    else if (d.status === 'WEEKLY_OFF' || d.status === 'HOLIDAY' || d.status === 'ON_LEAVE' || d.status === 'NOT_JOINED') continue;
    else if (d.status === 'NOT_MARKED' && d.date === today) continue;
    else break;
  }
  return streak;
}

function ElapsedSince({ since, now }: { since: string; now: Date | null }) {
  if (!now) return <span>--</span>;
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / 60_000));
  return <span>{formatMinutes(minutes)}</span>;
}

export function ClockCard({ summary, streak }: { summary: MeSummary; streak: number }) {
  const m = useMotionSafe();
  const qc = useQueryClient();
  const now = useNow();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const { today } = summary;
  const att = today.attendance;
  const tone = DAY_STATUS_TONE[att.status];
  const checkedIn = !!att.checkInAt;
  const done = checkedIn && !!att.checkOutAt;
  const parts = now ? clockParts(now) : null;

  const run = async (fn: () => Promise<AttendanceDay>, ok: string) => {
    try {
      const res = await fn();
      toast.success(res.status === 'LATE' && ok.startsWith('Checked in') ? `${ok} (marked late)` : ok);
    } catch (e) {
      toast.error(toHrError(e).message);
      void qc.invalidateQueries({ queryKey: hrKeys.me });
    }
  };

  let blocked: { icon: typeof Sun; text: string } | null = null;
  if (!today.canCheckIn && !today.canCheckOut && !done) {
    if (att.status === 'ON_LEAVE') blocked = { icon: CalendarOff, text: 'You are on approved leave today.' };
    else if (att.source === 'MANUAL') blocked = { icon: ShieldCheck, text: 'HR has already marked your attendance for today.' };
    else if (today.holidayName) blocked = { icon: Sun, text: `Holiday today - ${today.holidayName}.` };
    else if (today.isWeeklyOff) blocked = { icon: Sun, text: 'Weekly off today - enjoy the rest.' };
    else blocked = { icon: ShieldCheck, text: 'Check-in is not available right now.' };
  }

  return (
    <section className="relative overflow-hidden rounded-[28px] p-5 text-white shadow-lg sm:p-7" style={{ backgroundImage: HR_HERO_BG }} aria-label="Today's attendance">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 2px, transparent 2px 14px)' }} />
      {m.reduce ? null : <motion.div aria-hidden className="pointer-events-none absolute -right-10 -top-16 size-64 rounded-full bg-white/10 blur-2xl" animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} />}
      <div className="relative grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/80">
              {greeting(now ?? undefined)}, {summary.employee.name.split(' ')[0]}
            </p>
            {streak > 1 ? (
              <motion.span
                initial={m.reduce ? false : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.3 }}
                className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-extrabold"
                title="Consecutive worked days this month"
              >
                <Flame className="size-3.5 text-amber-300" aria-hidden /> {streak}-day streak
              </motion.span>
            ) : null}
          </div>
          <div className="mt-1.5 flex items-baseline gap-1 font-mono text-[44px] font-extrabold leading-none tabular-nums sm:text-[60px]" role="timer" aria-label="Current time in India">
            {parts ? (
              <>
                <span>{parts.hh}</span>
                <span className={cn(!m.reduce && 'animate-pulse')}>:</span>
                <span>{parts.mm}</span>
                <span className="ml-1 text-[22px] text-white/70 sm:text-[28px]">{parts.ss}</span>
              </>
            ) : (
              <span className="text-white/50">--:--</span>
            )}
          </div>
          <p className="mt-1.5 text-sm font-semibold text-white/85">
            {formatDay(today.date, 'long')} · IST
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1">
              <MapPin className="size-3.5" aria-hidden />
              {summary.employee.shift ? `${summary.employee.shift.name} shift ${summary.employee.shift.startTime}-${summary.employee.shift.endTime}` : 'No shift assigned'}
            </span>
            <span className="inline-flex items-center rounded-full bg-white px-1 py-0.5" style={{ color: TONES[tone].color }}>
              <ToneChip tone={tone} label={DAY_STATUS_LABEL[att.status]} small />
            </span>
          </div>
        </div>

        <div className="flex min-w-[220px] flex-col items-stretch gap-2.5 md:items-center">
          <AnimatePresence mode="wait" initial={false}>
            {today.canCheckIn ? (
              <motion.div key="in" initial={m.reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={m.reduce ? undefined : { opacity: 0, y: -10 }} className="relative">
                {m.reduce ? null : <span aria-hidden className="absolute inset-0 animate-ping rounded-2xl bg-white/25" />}
                <LoadingButton
                  type="button"
                  size="lg"
                  loading={checkIn.isPending}
                  onClick={() => run(() => checkIn.mutateAsync(undefined), 'Checked in. Have a great shift!')}
                  className="relative h-16 w-full rounded-2xl bg-white px-8 text-lg font-extrabold text-emerald-700 shadow-xl hover:bg-white/90"
                >
                  <LogIn className="size-5" aria-hidden /> Check in
                </LoadingButton>
              </motion.div>
            ) : today.canCheckOut ? (
              <motion.div key="out" initial={m.reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={m.reduce ? undefined : { opacity: 0, y: -10 }} className="w-full space-y-2 text-center">
                <p className="text-sm font-semibold text-white/90">
                  In since <span className="font-extrabold">{formatTime(att.checkInAt)}</span> · working <ElapsedSince since={att.checkInAt!} now={now} />
                </p>
                <LoadingButton
                  type="button"
                  size="lg"
                  loading={checkOut.isPending}
                  onClick={() => run(() => checkOut.mutateAsync(), 'Checked out. See you tomorrow!')}
                  className="h-16 w-full rounded-2xl bg-white px-8 text-lg font-extrabold text-rose-700 shadow-xl hover:bg-white/90"
                >
                  <LogOut className="size-5" aria-hidden /> Check out
                </LoadingButton>
              </motion.div>
            ) : done ? (
              <motion.div key="done" initial={m.reduce ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl bg-white/15 px-6 py-4 text-center">
                <TimerReset className="mx-auto size-6" aria-hidden />
                <p className="mt-1 text-lg font-extrabold">Day complete</p>
                <p className="text-sm text-white/90">
                  {formatTime(att.checkInAt)} - {formatTime(att.checkOutAt)} · {formatMinutes(att.workedMinutes)}
                </p>
              </motion.div>
            ) : (
              <motion.div key="blocked" initial={m.reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="max-w-[260px] rounded-2xl bg-white/15 px-5 py-4 text-center text-sm font-semibold">
                {blocked ? <blocked.icon className="mx-auto mb-1 size-6" aria-hidden /> : null}
                {blocked?.text}
              </motion.div>
            )}
          </AnimatePresence>
          {att.status === 'LATE' && att.lateMinutes > 0 ? (
            <p className="rounded-full px-3 py-1 text-center text-xs font-bold" style={{ backgroundColor: mix('var(--chart-2)', 35), color: 'white' }}>
              Marked late by {formatMinutes(att.lateMinutes)}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
