'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Clock, FileEdit, Fingerprint, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { formatDay, formatMinutes, formatTime, monthDates, monthStart, todayYmd, weekdayIndex, WEEKDAYS_SHORT } from '../../lib/dates';
import { mix, TONES, type HrTone } from '../../lib/hr-palette';
import { DAY_STATUS_LABEL, DAY_STATUS_TONE, DAY_PART_SHORT } from '../../lib/status';
import type { AttendanceDay, DayStatus } from '../../types';
import { ToneChip } from './hr-ui';

/** The tone a calendar cell is painted with; a day that is checked in but late reads as LATE etc. */
export function dayTone(status: DayStatus): HrTone {
  return DAY_STATUS_TONE[status];
}

/** Legend that doubles as a key to the shapes used in the calendar cells. */
export function StatusLegend({ tones = ['present', 'late', 'half', 'leave', 'absent', 'holiday', 'off', 'none'] as HrTone[], className }: { tones?: HrTone[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap gap-x-3.5 gap-y-1.5', className)} aria-label="Legend">
      {tones.map((t) => {
        const meta = TONES[t];
        const Icon = meta.icon;
        return (
          <li key={t} className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground">
            <span className="flex size-5 items-center justify-center rounded-md" style={{ backgroundColor: mix(meta.color, 16), color: meta.color }}>
              <Icon className="size-3" aria-hidden />
            </span>
            {meta.label}
          </li>
        );
      })}
    </ul>
  );
}

function cellLabel(d: AttendanceDay): string {
  const parts = [formatDay(d.date, 'weekday'), DAY_STATUS_LABEL[d.status]];
  if (d.holidayName) parts.push(d.holidayName);
  if (d.leaveType) parts.push(d.leaveType.name);
  if (d.checkInTime) parts.push(`in ${d.checkInTime}${d.checkOutTime ? ` out ${d.checkOutTime}` : ''}`);
  return parts.join(', ');
}

/**
 * Month heat-map calendar. Status is encoded THREE ways — tint, an icon shape and a text glyph/label — so it is
 * readable without colour. Cells animate in with a short stagger and morph (spring) when a status changes.
 */
export function AttendanceCalendar({
  month,
  days,
  selected,
  onSelect,
  compact,
}: {
  month: string;
  days: AttendanceDay[];
  selected?: string | null;
  onSelect?: (day: AttendanceDay) => void;
  compact?: boolean;
}) {
  const m = useMotionSafe();
  const today = todayYmd();
  const byDate = React.useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const dates = React.useMemo(() => monthDates(month), [month]);
  const lead = weekdayIndex(monthStart(month));

  return (
    <div>
      <div className="mb-1.5 grid grid-cols-7 gap-1 sm:gap-1.5" aria-hidden>
        {WEEKDAYS_SHORT.map((w) => (
          <div key={w} className="text-center text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
            {w}
          </div>
        ))}
      </div>
      <div role="group" aria-label={`Attendance for ${month}`} className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {Array.from({ length: lead }, (_, i) => (
          <div key={`lead-${i}`} aria-hidden />
        ))}
        {dates.map((date, i) => {
          const d = byDate.get(date);
          const status: DayStatus = d?.status ?? 'NOT_MARKED';
          const tone = dayTone(status);
          const meta = TONES[tone];
          const Icon = meta.icon;
          const isToday = date === today;
          const isSel = selected === date;
          const future = date > today;
          const clickable = !!onSelect && !!d;
          return (
            <motion.button
              key={`${month}-${date}`}
              type="button"
              disabled={!clickable}
              aria-label={d ? cellLabel(d) : formatDay(date, 'weekday')}
              aria-pressed={onSelect ? isSel : undefined}
              onClick={() => d && onSelect?.(d)}
              initial={m.reduce ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, delay: Math.min(i, 31) * 0.01 }}
              whileHover={m.reduce || !clickable ? undefined : { y: -2, scale: 1.04 }}
              className={cn(
                'relative flex aspect-square min-w-0 flex-col items-center justify-between overflow-hidden rounded-lg border p-1 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:rounded-xl sm:p-1.5',
                compact ? 'sm:aspect-[5/4]' : 'sm:aspect-[6/5]',
                status === 'NOT_MARKED' && 'border-dashed',
                isToday && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
                isSel && 'shadow-md ring-2 ring-foreground/70',
                future && 'opacity-80',
                !clickable && 'cursor-default',
              )}
              style={{ backgroundColor: mix(meta.color, status === 'NOT_MARKED' ? 4 : 15), borderColor: mix(meta.color, status === 'NOT_MARKED' ? 28 : 38) }}
            >
              <span className="flex w-full items-start justify-between">
                <span className={cn('text-[11px] font-extrabold leading-none tabular-nums sm:text-xs', isToday && 'text-primary')}>{Number(date.slice(8))}</span>
                {d?.status === 'LATE' ? <Clock className="size-3 text-[color:var(--chart-2)]" aria-hidden /> : null}
              </span>
              <motion.span key={status} initial={m.reduce ? false : { scale: 0.4, rotate: -25 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }} style={{ color: meta.color }}>
                <Icon className="size-3.5 sm:size-4" aria-hidden strokeWidth={2.6} />
              </motion.span>
              <span className="hidden w-full truncate text-center text-[9.5px] font-bold leading-none sm:block" style={{ color: meta.color }}>
                {d?.checkInTime && !compact ? d.checkInTime : meta.glyph}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-dashed py-1.5 text-[13px] last:border-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-semibold">{children}</dd>
    </div>
  );
}

/** Facts about one attendance day: times, worked hours, who marked it and why. */
export function DayDetail({ day, actions }: { day: AttendanceDay; actions?: React.ReactNode }) {
  const tone = dayTone(day.status);
  const SourceIcon = day.source === 'SELF' ? Fingerprint : day.source === 'MANUAL' ? FileEdit : Sparkles;
  return (
    <div className="rounded-2xl border bg-muted/30 p-3.5">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-extrabold">{formatDay(day.date, 'long')}</p>
        <ToneChip tone={tone} label={DAY_STATUS_LABEL[day.status]} />
      </div>
      <dl>
        {day.checkInAt || day.checkOutAt ? (
          <>
            <Row label="Check in">{formatTime(day.checkInAt)}</Row>
            <Row label="Check out">{formatTime(day.checkOutAt)}</Row>
            {day.workedMinutes != null ? <Row label="Worked">{formatMinutes(day.workedMinutes)}</Row> : null}
            {day.lateMinutes > 0 ? <Row label="Late by">{formatMinutes(day.lateMinutes)}</Row> : null}
            {day.overtimeMinutes > 0 ? <Row label="Overtime">{formatMinutes(day.overtimeMinutes)}</Row> : null}
          </>
        ) : null}
        {day.holidayName ? <Row label="Holiday">{day.holidayName}</Row> : null}
        {day.leaveType ? (
          <Row label="Leave">
            {day.leaveType.name}
            {day.leaveDayPart && day.leaveDayPart !== 'FULL_DAY' ? ` (${DAY_PART_SHORT[day.leaveDayPart]})` : ''}
          </Row>
        ) : null}
        {day.shift ? (
          <Row label="Shift">
            {day.shift.name} ({day.shift.startTime}-{day.shift.endTime})
          </Row>
        ) : null}
        {day.source ? (
          <Row label="Source">
            <span className="inline-flex items-center gap-1">
              <SourceIcon className="size-3.5" aria-hidden />
              {day.source === 'SELF' ? 'Self check-in' : day.source === 'MANUAL' ? 'Marked by HR' : 'System (leave)'}
            </span>
          </Row>
        ) : null}
        {day.markedBy ? <Row label="Marked by">{day.markedBy.name}</Row> : null}
        {day.remark ? <Row label="Remark">{day.remark}</Row> : null}
        {!day.recorded ? <Row label="Record">{day.status === 'NOT_MARKED' ? 'Nothing recorded yet' : 'Computed from the roster'}</Row> : null}
      </dl>
      {actions ? <div className="mt-2.5 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** Mini stat strip for a month's `AttendanceStats`. */
export function StatsStrip({ stats }: { stats: { present: number; late: number; halfDay: number; onLeave: number; absent: number; weeklyOff: number; holiday: number } }) {
  const items: { tone: HrTone; value: number }[] = [
    { tone: 'present', value: stats.present },
    { tone: 'late', value: stats.late },
    { tone: 'half', value: stats.halfDay },
    { tone: 'leave', value: stats.onLeave },
    { tone: 'absent', value: stats.absent },
    { tone: 'off', value: stats.weeklyOff + stats.holiday },
  ];
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {items.map((it) => {
        const meta = TONES[it.tone];
        const Icon = meta.icon;
        return (
          <li key={it.tone} className="rounded-xl border px-2.5 py-2" style={{ backgroundColor: mix(meta.color, 8) }}>
            <div className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: meta.color }}>
              <Icon className="size-3" aria-hidden />
              {it.tone === 'off' ? 'Off / holiday' : meta.label}
            </div>
            <div className="mt-0.5 text-xl font-extrabold tabular-nums">{it.value}</div>
          </li>
        );
      })}
    </ul>
  );
}
