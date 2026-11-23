'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Hourglass, Star, Sunrise, Sunset } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { currentMonth, formatDay, formatMonth, formatRange, monthDates, monthEnd, monthStart, todayYmd, weekdayIndex, WEEKDAYS_SHORT } from '../../lib/dates';
import { leaveTypeColor, mix } from '../../lib/hr-palette';
import { DAY_PART_SHORT } from '../../lib/status';
import { groupLeavesByDay } from '../../lib/derive';
import { toHrError, useLeaveCalendar } from '../../hooks/use-hr';
import { HrAvatar, HrEmpty, HrError, HrPanel, MonthStepper, RowsSkeleton } from '../ui/hr-ui';

/** "Who is off when": a month grid; each cell lists avatars of employees on approved (solid) or pending (dashed) leave, with holidays marked. */
export function TeamLeaveCalendar() {
  const m = useMotionSafe();
  const [month, setMonth] = React.useState(currentMonth());
  const [picked, setPicked] = React.useState<string>(todayYmd());
  const from = monthStart(month);
  const to = monthEnd(month);
  const q = useLeaveCalendar(from, to);
  const byDay = React.useMemo(() => groupLeavesByDay(q.data?.items ?? [], from, to), [q.data, from, to]);
  const holidayByDay = React.useMemo(() => new Map((q.data?.holidays ?? []).map((h) => [h.date, h])), [q.data]);
  const dates = monthDates(month);
  const lead = weekdayIndex(from);
  const today = todayYmd();
  const dayList = byDay.get(picked) ?? [];
  const pickedHoliday = holidayByDay.get(picked);

  return (
    <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <HrPanel title="Team leave calendar" subtitle="Solid = approved, dashed = pending" icon={Hourglass} tone="var(--chart-7)" action={<MonthStepper value={month} onChange={(next) => { setMonth(next); setPicked(next === currentMonth() ? todayYmd() : `${next}-01`); }} />}>
        {q.isPending ? (
          <RowsSkeleton rows={1} height={380} />
        ) : q.isError ? (
          <HrError message={toHrError(q.error).message} onRetry={() => void q.refetch()} />
        ) : (
          <>
            {q.data && q.data.items.length === 0 ? <p className="mb-2 rounded-lg border border-dashed px-3 py-1.5 text-center text-xs text-muted-foreground">No approved or pending leave in {formatMonth(month)}{q.data.holidays.length ? '' : ' and no holidays'}.</p> : null}
            <div className="mb-1.5 grid grid-cols-7 gap-1 sm:gap-1.5" aria-hidden>
              {WEEKDAYS_SHORT.map((w) => (
                <div key={w} className="text-center text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                  {w}
                </div>
              ))}
            </div>
            <div role="group" aria-label={`Leave calendar for ${month}`} className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {Array.from({ length: lead }, (_, i) => (
                <div key={`l${i}`} aria-hidden />
              ))}
              {dates.map((date, i) => {
                const list = byDay.get(date) ?? [];
                const holiday = holidayByDay.get(date);
                const isSel = picked === date;
                return (
                  <motion.button
                    key={`${month}-${date}`}
                    type="button"
                    onClick={() => setPicked(date)}
                    aria-pressed={isSel}
                    aria-label={`${formatDay(date, 'weekday')}${holiday ? `, holiday ${holiday.name}` : ''}, ${list.length} on leave`}
                    initial={m.reduce ? false : { opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25, delay: Math.min(i, 31) * 0.01 }}
                    className={cn(
                      'flex min-h-[58px] min-w-0 flex-col items-stretch justify-between rounded-lg border p-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[84px] sm:rounded-xl sm:p-1.5',
                      date === today && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
                      isSel && 'shadow-md ring-2 ring-foreground/70',
                      list.length === 0 && !holiday && 'bg-card',
                    )}
                    style={holiday ? { backgroundColor: mix('var(--chart-3)', 12), borderColor: mix('var(--chart-3)', 40) } : list.length ? { backgroundColor: mix('var(--chart-7)', 6) } : undefined}
                  >
                    <span className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold tabular-nums sm:text-xs">{Number(date.slice(8))}</span>
                      {holiday ? <Star className="size-3 text-[color:var(--chart-3)]" aria-hidden /> : null}
                    </span>
                    <span className="flex flex-wrap items-center gap-0.5">
                      {list.slice(0, 3).map((l) => {
                        const c = leaveTypeColor(l.leaveType.color);
                        return (
                          <span
                            key={l.id}
                            className="relative inline-flex"
                            style={{ borderRadius: 999, outline: `2px ${l.status === 'PENDING' ? 'dashed' : 'solid'} ${c}`, outlineOffset: 1 }}
                          >
                            <HrAvatar name={l.employeeName} size={20} />
                          </span>
                        );
                      })}
                      {list.length > 3 ? <span className="text-[10px] font-extrabold text-muted-foreground">+{list.length - 3}</span> : null}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </>
        )}
      </HrPanel>

      <HrPanel title={formatDay(picked, 'long')} subtitle={pickedHoliday ? `Holiday: ${pickedHoliday.name}` : `${dayList.length} on leave`} icon={Star} tone="var(--chart-3)">
        {dayList.length === 0 ? (
          <HrEmpty icon={Star} title={pickedHoliday ? pickedHoliday.name : 'Everyone is in'} description={pickedHoliday ? 'Public holiday.' : 'Nobody is on leave this day.'} compact />
        ) : (
          <ul className="space-y-2">
            {dayList.map((l) => {
              const c = leaveTypeColor(l.leaveType.color);
              const half = l.dayPart !== 'FULL_DAY';
              return (
                <li key={l.id} className="flex items-center gap-2.5 rounded-xl border px-3 py-2" style={{ boxShadow: `inset 3px 0 0 ${c}`, borderStyle: l.status === 'PENDING' ? 'dashed' : 'solid' }}>
                  <HrAvatar name={l.employeeName} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-extrabold">{l.employeeName}</p>
                    <p className="text-[11.5px] text-muted-foreground">
                      <span style={{ color: c }} className="font-bold">
                        {l.leaveType.name}
                      </span>{' '}
                      · {formatRange(l.startDate, l.endDate)}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold">
                    {half ? l.dayPart === 'HALF_DAY_MORNING' ? <Sunrise className="size-3" aria-hidden /> : <Sunset className="size-3" aria-hidden /> : null}
                    {half ? DAY_PART_SHORT[l.dayPart] : l.status === 'PENDING' ? 'Pending' : 'Full day'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </HrPanel>
    </div>
  );
}
