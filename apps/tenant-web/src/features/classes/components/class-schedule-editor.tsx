'use client';

import * as React from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ScheduleSlot, WeekDay } from '../types';
import { WEEK_DAYS } from '../types';

const timeInputClassName = cn(
  'h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm shadow-xs transition-all duration-150',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50',
);

const DAY_LABELS: Record<WeekDay, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
};

interface ClassScheduleEditorProps {
  initialSlots: ScheduleSlot[];
  disabled?: boolean;
  onChange: (slots: ScheduleSlot[], isDirty: boolean) => void;
}

/** Recurring weekly template — the source `GroupClassSchedule` rows the BullMQ sweep expands into dated `ClassSession`s. A day can hold more than one time slot (e.g. a 7am and a 6pm class). */
export function ClassScheduleEditor({ initialSlots, disabled, onChange }: ClassScheduleEditorProps) {
  const [slots, setSlots] = React.useState<ScheduleSlot[]>(initialSlots);
  const baseline = React.useMemo(() => initialSlots, [initialSlots]);
  const [addDay, setAddDay] = React.useState<WeekDay>('MONDAY');
  const [addTime, setAddTime] = React.useState('07:00');

  const sortKey = (s: ScheduleSlot) => `${WEEK_DAYS.indexOf(s.dayOfWeek)}-${s.startTime}`;
  const sortedSnapshot = (list: ScheduleSlot[]) => [...list].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  const emit = (next: ScheduleSlot[]) => {
    setSlots(next);
    const dirty = JSON.stringify(sortedSnapshot(next)) !== JSON.stringify(sortedSnapshot(baseline));
    onChange(next, dirty);
  };

  const addSlot = () => {
    if (slots.some((s) => s.dayOfWeek === addDay && s.startTime === addTime)) return;
    emit([...slots, { dayOfWeek: addDay, startTime: addTime }]);
  };

  const removeSlot = (day: WeekDay, time: string) => emit(slots.filter((s) => !(s.dayOfWeek === day && s.startTime === time)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor="scheduleAddDay">
            Day
          </label>
          <select
            id="scheduleAddDay"
            className={timeInputClassName}
            value={addDay}
            disabled={disabled}
            onChange={(e) => setAddDay(e.target.value as WeekDay)}
          >
            {WEEK_DAYS.map((d) => (
              <option key={d} value={d}>
                {DAY_LABELS[d]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-32 space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor="scheduleAddTime">
            Start time
          </label>
          <input id="scheduleAddTime" type="time" className={timeInputClassName} value={addTime} disabled={disabled} onChange={(e) => setAddTime(e.target.value)} />
        </div>
        <Button type="button" size="sm" disabled={disabled} onClick={addSlot}>
          Add slot
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {WEEK_DAYS.map((day) => {
          const dayTimes = slots.filter((s) => s.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
          return (
            <div key={day} className="rounded-xl border bg-card p-3.5 shadow-xs">
              <h4 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-foreground/90">
                <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: 'var(--chart-2)' }} aria-hidden="true" />
                {DAY_LABELS[day]}
              </h4>
              {dayTimes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No session on this day.</p>
              ) : (
                <ul className="space-y-1.5">
                  {dayTimes.map((slot) => (
                    <li
                      key={slot.startTime}
                      className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-2.5 py-2 text-sm"
                    >
                      <span>{slot.startTime}</span>
                      {!disabled ? (
                        <button
                          type="button"
                          aria-label={`Remove ${DAY_LABELS[day]} ${slot.startTime} slot`}
                          className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => removeSlot(day, slot.startTime)}
                        >
                          <X className="size-3.5" />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
