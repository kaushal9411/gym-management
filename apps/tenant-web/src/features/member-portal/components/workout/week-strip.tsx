'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, Minus, SkipForward } from 'lucide-react';

import { cn } from '@/lib/utils';
import { toneColor } from '../kit';
import { shortDay, type DayState, type TrackingDay } from '../../lib/workout-tracking';
import { PressButton, useBounce } from './workout-motion';

const SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The day's status mark under its date. */
function DayMark({ state, active }: { state: DayState; active: boolean }) {
  const base = 'grid size-5 place-items-center rounded-full';
  switch (state) {
    case 'DONE':
      return (
        <span className={cn(base, active ? 'bg-white text-[color:var(--success)]' : 'bg-success text-white')}>
          <Check className="size-3" strokeWidth={3} aria-label="done" />
        </span>
      );
    case 'PARTIAL':
      return <span className={cn(base, 'border-2')} style={{ borderColor: active ? '#fff' : toneColor('warning'), background: `linear-gradient(90deg, ${active ? '#fff' : toneColor('warning')} 50%, transparent 50%)` }} aria-label="in progress" />;
    case 'SKIPPED':
      return (
        <span className={cn(base, active ? 'bg-white/30 text-white' : 'bg-muted text-muted-foreground')}>
          <SkipForward className="size-3" aria-label="skipped" />
        </span>
      );
    case 'MISSED':
      return <span className={cn(base, 'border-2')} style={{ borderColor: active ? '#fff' : toneColor('danger') }} aria-label="missed" />;
    case 'TODAY':
      return <span className={cn(base, 'border-2')} style={{ borderColor: active ? '#fff' : toneColor('primary') }} aria-label="to do" />;
    case 'UPCOMING':
      return <span className={cn(base, 'border border-dashed')} style={{ borderColor: active ? 'rgb(255 255 255 / 0.7)' : 'var(--muted-foreground)' }} aria-label="upcoming" />;
    default:
      return (
        <span className={cn(base, active ? 'text-white/70' : 'text-muted-foreground/60')}>
          <Minus className="size-3" aria-label="rest" />
        </span>
      );
  }
}

/**
 * One week of the schedule: tap a day to see (and log) its exercises. The week
 * can be paged back as far as the API sends days (the back-date window).
 */
export function WeekStrip({
  days,
  selected,
  onSelect,
  weekStart,
  onWeekChange,
  currentWeekStart,
}: {
  days: TrackingDay[];
  selected: string;
  onSelect: (date: string) => void;
  weekStart: string;
  onWeekChange: (weekStart: string) => void;
  currentWeekStart: string;
}) {
  const b = useBounce();
  const week = days.filter((d) => d.date >= weekStart && d.date <= addDays(weekStart, 6));
  const earliest = days[0]?.date ?? weekStart;
  const canPrev = addDays(weekStart, -7) >= earliest;
  const canNext = weekStart < currentWeekStart;
  const last = addDays(weekStart, 6);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label="Previous week" disabled={!canPrev} onClick={() => onWeekChange(addDays(weekStart, -7))} className="grid size-11 place-items-center rounded-xl text-muted-foreground transition active:scale-90 hover:bg-accent disabled:opacity-30">
          <ChevronLeft className="size-5" />
        </button>
        <p className="text-sm font-semibold">
          {weekStart === currentWeekStart ? 'This week' : `${shortDay(weekStart)} - ${shortDay(last)}`}
        </p>
        <button type="button" aria-label="Next week" disabled={!canNext} onClick={() => onWeekChange(addDays(weekStart, 7))} className="grid size-11 place-items-center rounded-xl text-muted-foreground transition active:scale-90 hover:bg-accent disabled:opacity-30">
          <ChevronRight className="size-5" />
        </button>
      </div>
      <div role="tablist" aria-label="Day of the week" className="grid grid-cols-7 gap-1.5">
        {week.map((d, i) => {
          const active = d.date === selected;
          return (
            <PressButton
              key={d.date}
              role="tab"
              aria-selected={active}
              aria-label={`${d.label} ${shortDay(d.date)}${d.isToday ? ', today' : ''}, ${d.plannedCount ? `${d.completedCount} of ${d.plannedCount} done` : 'rest day'}`}
              onClick={() => onSelect(d.date)}
              className={cn(
                'relative flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border px-0.5 py-2 text-center transition-colors',
                active ? 'border-transparent text-primary-foreground shadow-md' : 'bg-card text-muted-foreground hover:bg-accent',
              )}
            >
              {active ? <motion.span layoutId="workout-day-pill" className="absolute inset-0 rounded-2xl bg-primary" transition={b.reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 30 }} /> : null}
              <span className="relative text-[10px] font-medium uppercase tracking-wide">{SHORT[i] ?? d.label.slice(0, 3)}</span>
              <span className="relative text-base font-semibold tabular-nums leading-none">{Number(d.date.slice(8, 10))}</span>
              <span className="relative">
                <DayMark state={d.state} active={active} />
              </span>
              {d.isToday ? <span className={cn('absolute right-1.5 top-1.5 size-1.5 rounded-full', active ? 'bg-white' : 'bg-primary')} aria-hidden /> : null}
            </PressButton>
          );
        })}
      </div>
    </div>
  );
}

/** `YYYY-MM-DD` + n days (calendar arithmetic, no timezone shift). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + n)).toISOString().slice(0, 10);
}

/** The Monday of the week containing `day`. */
export function weekStartOf(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const dow = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  return addDays(day, -((dow + 6) % 7));
}
