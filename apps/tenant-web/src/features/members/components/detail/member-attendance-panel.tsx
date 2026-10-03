'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CalendarCheck, CheckCircle2, ChevronLeft, ChevronRight, CircleSlash } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AttendanceMethodBadge, AttendanceStatusBadge } from '@/features/attendance/components/attendance-badges';
import { useAttendanceList } from '@/features/attendance/hooks/use-attendance';
import { cn } from '@/lib/utils';
import { PanelCard, accentVar, tint } from './detail-ui';
import { sameDay, toIsoDate } from './date-utils';

interface Props {
  memberId: string;
  eligible: boolean;
  canCheckIn: boolean;
  canCheckOut: boolean;
  checkInPending: boolean;
  checkOutPending: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function MemberAttendancePanel({ memberId, eligible, canCheckIn, canCheckOut, checkInPending, checkOutPending, onCheckIn, onCheckOut }: Props) {
  const today = new Date();
  const [month, setMonth] = React.useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const isCurrentMonth = sameDay(month, new Date(today.getFullYear(), today.getMonth(), 1));

  const list = useAttendanceList({
    memberId,
    dateFrom: toIsoDate(month),
    dateTo: toIsoDate(monthEnd),
    page: 1,
    limit: 100,
    sortBy: 'checkInTime',
    sortDir: 'desc',
  });
  const records = list.data?.items ?? [];

  const visitedDays = new Set(records.map((r) => new Date(r.checkInTime).getDate()));
  const daysInMonth = monthEnd.getDate();
  const elapsed = isCurrentMonth ? today.getDate() : daysInMonth;
  const rate = elapsed > 0 ? Math.round((visitedDays.size / elapsed) * 100) : 0;
  let best = 0;
  let run = 0;
  for (let d = 1; d <= daysInMonth; d += 1) {
    run = visitedDays.has(d) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  const visitedToday = records.some((r) => sameDay(new Date(r.checkInTime), today));
  const todayRecord = records.find((r) => sameDay(new Date(r.checkInTime), today));
  const leadingBlanks = (month.getDay() + 6) % 7;
  const label = month.toLocaleString(undefined, { month: 'short', year: 'numeric' });

  const shift = (delta: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  return (
    <PanelCard
      icon={CalendarCheck}
      accent="primary"
      title="Attendance"
      delay={0.3}
      right={
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="flex size-8 items-center justify-center rounded-lg border bg-card transition-colors hover:bg-accent">
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-[90px] text-center text-sm font-semibold tabular-nums">{label}</span>
          <button
            type="button"
            aria-label="Next month"
            disabled={isCurrentMonth}
            onClick={() => shift(1)}
            className="flex size-8 items-center justify-center rounded-lg border bg-card transition-colors hover:bg-accent disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      }
    >
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-xl px-3.5 py-2.5"
        style={{ backgroundColor: tint(visitedToday ? 'success' : 'warning', 13) }}
      >
        {visitedToday ? <CheckCircle2 className="size-5" style={{ color: accentVar('success') }} /> : <CircleSlash className="size-5" style={{ color: accentVar('warning') }} />}
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">{visitedToday ? 'Visited today' : 'Not visited today'}</p>
          <p className="text-xs text-muted-foreground">
            {todayRecord ? `Checked in ${new Date(todayRecord.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : eligible ? 'Eligible to check in' : 'Not eligible to check in right now'}
          </p>
        </div>
        <div className="flex basis-full gap-2">
          {canCheckIn ? (
            <Button size="sm" disabled={checkInPending} onClick={onCheckIn}>
              {checkInPending ? 'Checking in…' : 'Check in'}
            </Button>
          ) : null}
          {canCheckOut ? (
            <Button size="sm" variant="outline" disabled={checkOutPending} onClick={onCheckOut}>
              {checkOutPending ? 'Checking out…' : 'Check out'}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {[
          { v: list.data?.total ?? 0, l: 'Visits', c: 'primary' as const },
          { v: `${rate}%`, l: 'Of days so far', c: 'success' as const },
          { v: best, l: 'Day streak', c: 'warning' as const },
        ].map((m) => (
          <div key={m.l} className="rounded-xl border p-2.5" style={{ backgroundColor: tint(m.c, 9), borderColor: tint(m.c, 20) }}>
            <b className="block text-xl font-extrabold tabular-nums">{m.v}</b>
            <span className="text-[11.5px] text-muted-foreground">{m.l}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5" role="grid" aria-label={`Visits in ${label}`}>
        {WEEKDAYS.map((w, i) => (
          <div key={`${w}${i}`} className="text-center text-[10.5px] font-bold tracking-wider text-muted-foreground">
            {w}
          </div>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`b${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const visited = visitedDays.has(day);
          const isToday = isCurrentMonth && day === today.getDate();
          return (
            <motion.div
              key={day}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.012, 0.4) }}
              whileHover={visited ? { scale: 1.12 } : undefined}
              title={visited ? 'Visited' : undefined}
              className={cn(
                'grid aspect-square place-items-center rounded-lg text-xs font-semibold tabular-nums',
                visited ? 'text-white shadow-sm' : 'bg-muted/50 text-muted-foreground',
                isToday && 'ring-2 ring-destructive ring-offset-1 ring-offset-card',
              )}
              style={visited ? { backgroundImage: 'linear-gradient(140deg, var(--primary), var(--chart-7))' } : undefined}
            >
              {day}
            </motion.div>
          );
        })}
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Recent visits</h3>
          <Link href="/attendance/history" className="text-xs text-muted-foreground hover:underline">
            View full history
          </Link>
        </div>
        {list.isPending ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : records.length === 0 ? (
          <p className="text-sm text-muted-foreground">No visits in {label}.</p>
        ) : (
          <div className="space-y-0.5">
            {records.slice(0, 6).map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-lg px-1.5 py-2 transition-colors hover:bg-accent/50">
                <div className="w-11 text-center leading-tight">
                  <b className="block text-base font-bold tabular-nums">{new Date(r.checkInTime).getDate()}</b>
                  <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    {new Date(r.checkInTime).toLocaleString(undefined, { weekday: 'short' })}
                  </span>
                </div>
                <span className="flex-1 text-sm font-medium tabular-nums">
                  {new Date(r.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {r.checkOutTime ? ` – ${new Date(r.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                </span>
                <span className="flex items-center gap-1.5">
                  <AttendanceMethodBadge method={r.method} />
                  <AttendanceStatusBadge status={r.status} />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </PanelCard>
  );
}
