'use client';

import * as React from 'react';
import { Bell, CalendarCheck, CalendarHeart, Plane, Star } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { currentMonth, formatDateTime, formatDay, formatRange, todayYmd } from '../../lib/dates';
import { leaveTypeColor, mix } from '../../lib/hr-palette';
import { DAY_PART_SHORT } from '../../lib/status';
import { useMarkNotificationsRead, useMeAttendance, useMeNotifications, useMeSummary } from '../../hooks/use-hr';
import type { AttendanceDay } from '../../types';
import { AttendanceCalendar, DayDetail, StatsStrip, StatusLegend } from '../ui/attendance-calendar';
import { HrEmpty, HrError, HrPanel, MonthStepper, RowsSkeleton } from '../ui/hr-ui';
import { ClockCard, computeStreak } from './clock-card';

export function MyTodayTab({ canAttend, canLeave }: { canAttend: boolean; canLeave: boolean }) {
  const summary = useMeSummary({ enabled: canAttend });
  const nowMonth = currentMonth();
  const [month, setMonth] = React.useState(nowMonth);
  const [picked, setPicked] = React.useState<string | null>(null);
  const ready = canAttend && summary.isSuccess;
  const att = useMeAttendance(month, { enabled: ready });
  const curAtt = useMeAttendance(nowMonth, { enabled: ready && month !== nowMonth });
  const streakDays = (month === nowMonth ? att.data : curAtt.data)?.days ?? [];
  const streak = computeStreak(streakDays, todayYmd());
  const notes = useMeNotifications({ page: 1, limit: 6 }, { enabled: canLeave && (!canAttend || summary.isSuccess) });
  const markRead = useMarkNotificationsRead();

  const selectedDay: AttendanceDay | undefined = att.data?.days.find((d) => d.date === (picked ?? todayYmd())) ?? undefined;

  if (!canAttend) {
    return <HrEmpty icon={CalendarCheck} title="Attendance is not enabled for your role" description="Ask HR to grant you self attendance access." />;
  }

  return (
    <div className="space-y-3.5">
      {summary.isPending ? <RowsSkeleton rows={1} height={200} /> : summary.isError ? <HrError message="Could not load today's status." onRetry={() => void summary.refetch()} /> : <ClockCard summary={summary.data} streak={streak} />}

      <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <HrPanel
          title="My attendance"
          subtitle="Tap a day for the details. Colour, shape and label all show the status."
          icon={CalendarCheck}
          tone="var(--success)"
          action={<MonthStepper value={month} onChange={(m) => { setMonth(m); setPicked(null); }} max={nowMonth} />}
        >
          {att.isPending ? (
            <RowsSkeleton rows={1} height={320} />
          ) : att.isError ? (
            <HrError onRetry={() => void att.refetch()} />
          ) : (
            <div className="space-y-3.5">
              <StatsStrip stats={att.data.stats} />
              <AttendanceCalendar month={month} days={att.data.days} selected={picked ?? (month === nowMonth ? todayYmd() : null)} onSelect={(d) => setPicked(d.date)} />
              <StatusLegend />
              {selectedDay ? <DayDetail day={selectedDay} /> : null}
            </div>
          )}
        </HrPanel>

        <div className="space-y-3.5">
          {summary.data ? (
            <>
              <HrPanel title="Upcoming leave" icon={Plane} tone="var(--chart-7)">
                {summary.data.upcomingLeaves.length === 0 && summary.data.pendingLeaves.length === 0 ? (
                  <HrEmpty icon={Plane} title="Nothing planned" description="Approved and pending leave shows here." compact />
                ) : (
                  <ul className="space-y-2">
                    {[...summary.data.pendingLeaves, ...summary.data.upcomingLeaves].map((l) => (
                      <li key={l.id} className="flex items-center gap-2.5 rounded-xl border px-3 py-2 text-[13px]" style={{ boxShadow: `inset 3px 0 0 ${leaveTypeColor(l.leaveType.color)}` }}>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold">{l.leaveType.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatRange(l.startDate, l.endDate)}
                            {l.dayPart !== 'FULL_DAY' ? ` · ${DAY_PART_SHORT[l.dayPart]}` : ''}
                          </p>
                        </div>
                        <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: mix(l.status === 'PENDING' ? 'var(--warning)' : 'var(--success)', 18) }}>
                          {l.status === 'PENDING' ? 'Pending' : 'Approved'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </HrPanel>
              <HrPanel title="Upcoming holidays" icon={Star} tone="var(--chart-3)">
                {summary.data.upcomingHolidays.length === 0 ? (
                  <HrEmpty icon={CalendarHeart} title="No holidays soon" compact />
                ) : (
                  <ul className="space-y-1.5">
                    {summary.data.upcomingHolidays.slice(0, 5).map((h) => (
                      <li key={h.id} className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="flex items-center gap-2 font-semibold">
                          <Star className="size-3.5 text-[color:var(--chart-3)]" aria-hidden /> {h.name}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatDay(h.date, 'weekday')}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </HrPanel>
            </>
          ) : null}

          {canLeave ? (
            <HrPanel
              title="Updates"
              subtitle={notes.data ? `${notes.data.unreadCount} unread` : undefined}
              icon={Bell}
              tone="var(--chart-2)"
              action={
                notes.data && notes.data.unreadCount > 0 ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => markRead.mutate(undefined)} disabled={markRead.isPending}>
                    Mark all read
                  </Button>
                ) : null
              }
            >
              {notes.isPending ? (
                <RowsSkeleton rows={2} height={48} />
              ) : notes.isError ? (
                <HrError onRetry={() => void notes.refetch()} />
              ) : notes.data.items.length === 0 ? (
                <HrEmpty icon={Bell} title="All quiet" description="Leave decisions and payslips show up here." compact />
              ) : (
                <ul className="space-y-2">
                  {notes.data.items.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => !n.readAt && markRead.mutate(n.id)}
                        className="flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className={n.readAt ? 'mt-1.5 size-2 shrink-0 rounded-full bg-muted-foreground/30' : 'mt-1.5 size-2 shrink-0 rounded-full bg-primary'} aria-label={n.readAt ? 'Read' : 'Unread'} />
                        <span className="min-w-0">
                          <span className="block text-[13px] font-bold">{n.title}</span>
                          <span className="block text-xs text-muted-foreground">{n.body}</span>
                          <span className="block text-[11px] text-muted-foreground/80">{formatDateTime(n.createdAt)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </HrPanel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
