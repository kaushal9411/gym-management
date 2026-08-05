'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ClassSession } from '../types';

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Sunday of the week containing `date`, at UTC midnight — matches the backend's `WEEKDAY_JS_INDEX` (SUNDAY=0) so a session's `sessionDate` always lands in the column its day-of-week implies. */
export function startOfWeekUtc(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d;
}

export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });
}

const dayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' });
const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
const rangeFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

interface ClassCalendarProps {
  weekStart: Date;
  onWeekChange: (nextWeekStart: Date) => void;
  sessions: ClassSession[];
  loading?: boolean;
  onSessionClick?: (session: ClassSession) => void;
  /** Highlights a session (e.g. "you're booked into this one") beyond the default booked/capacity badge. */
  isHighlighted?: (session: ClassSession) => boolean;
}

/** Hand-built week grid — no calendar library exists in this codebase (or gets added here); 7 columns of `Card`/`Badge` primitives plus native `Date`/`Intl`. Shared by the staff booking-management page and the member portal's simplified book/cancel view. */
export function ClassCalendar({ weekStart, onWeekChange, sessions, loading, onSessionClick, isHighlighted }: ClassCalendarProps) {
  const days = weekDays(weekStart);
  const sessionsByDay = React.useMemo(() => {
    const map = new Map<string, ClassSession[]>();
    for (const session of sessions) {
      const list = map.get(session.sessionDate) ?? [];
      list.push(session);
      map.set(session.sessionDate, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return map;
  }, [sessions]);

  const today = toDateKey(new Date());
  const goToday = () => onWeekChange(startOfWeekUtc(new Date()));
  const goPrev = () => {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() - 7);
    onWeekChange(d);
  };
  const goNext = () => {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + 7);
    onWeekChange(d);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon" className="size-8" aria-label="Previous week" onClick={goPrev}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" className="size-8" aria-label="Next week" onClick={goNext}>
            <ChevronRight className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={goToday}>
            Today
          </Button>
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          {rangeFormatter.format(days[0])} – {rangeFormatter.format(days[6])}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
        {days.map((day) => {
          const key = toDateKey(day);
          const daySessions = sessionsByDay.get(key) ?? [];
          const isToday = key === today;
          return (
            <div key={key} className={cn('rounded-xl border p-2', isToday && 'border-primary/50 bg-primary/5')}>
              <div className="mb-2 flex items-baseline justify-between px-1">
                <span className="text-xs font-semibold text-foreground/90">{dayFormatter.format(day)}</span>
                <span className="text-xs text-muted-foreground">{dateFormatter.format(day)}</span>
              </div>
              <div className="space-y-1.5 sm:min-h-24">
                {loading ? (
                  <p className="px-1 text-xs text-muted-foreground">…</p>
                ) : daySessions.length === 0 ? (
                  <p className="px-1 text-xs text-muted-foreground">No sessions</p>
                ) : (
                  daySessions.map((session) => {
                    const full = session.bookedCount >= session.capacity;
                    const highlighted = isHighlighted?.(session) ?? false;
                    return (
                      <Card
                        key={session.id}
                        role={onSessionClick ? 'button' : undefined}
                        tabIndex={onSessionClick ? 0 : undefined}
                        onClick={() => onSessionClick?.(session)}
                        onKeyDown={(e) => {
                          if (onSessionClick && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            onSessionClick(session);
                          }
                        }}
                        className={cn(
                          'space-y-1 rounded-lg border p-2 text-xs shadow-none transition-colors',
                          onSessionClick && 'cursor-pointer hover:border-primary/40 hover:bg-muted/40',
                          highlighted && 'border-primary bg-primary/10',
                          session.status === 'CANCELLED' && 'opacity-50',
                        )}
                      >
                        <p className="font-medium leading-tight">{session.groupClass.name}</p>
                        <p className="text-muted-foreground">{session.startTime}–{session.endTime}</p>
                        <div className="flex items-center justify-between gap-1 pt-0.5">
                          <Badge variant={full ? 'outline' : 'secondary'} className="text-[10px]">
                            {session.bookedCount}/{session.capacity}
                          </Badge>
                          {session.status !== 'SCHEDULED' ? (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              {session.status}
                            </Badge>
                          ) : null}
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
