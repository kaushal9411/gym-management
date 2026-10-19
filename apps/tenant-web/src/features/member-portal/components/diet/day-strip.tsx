'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';
import { weekdayShort, type NutritionDay } from '../../lib/diet-nutrition';
import { PressButton } from './motion-bits';

/** Last 7 days (oldest first): tap a day to log or review it. A dot marks days with anything logged. */
export function DayStrip({ days, today, selected, onSelect }: { days: NutritionDay[]; today: string; selected: string; onSelect: (d: string) => void }) {
  return (
    <div role="tablist" aria-label="Choose a day to log" className="grid grid-cols-7 gap-1.5">
      {days.map((d) => {
        const on = d.date === selected;
        return (
          <PressButton
            key={d.date}
            role="tab"
            aria-selected={on}
            aria-label={d.date === today ? 'Today' : d.date}
            onClick={() => onSelect(d.date)}
            className={cn(
              'relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl border px-0.5 py-2 text-center transition-colors',
              on ? 'border-transparent bg-primary text-primary-foreground shadow-md' : 'bg-card text-muted-foreground hover:bg-accent',
            )}
          >
            <span className="text-[10px] font-medium uppercase tracking-wide">{d.date === today ? 'Today' : weekdayShort(d.date)}</span>
            <span className="text-base font-semibold tabular-nums leading-none">{Number(d.date.slice(8, 10))}</span>
            <span className={cn('mt-0.5 size-1.5 rounded-full', d.allDone ? (on ? 'bg-white' : 'bg-success') : d.logged ? (on ? 'bg-white/70' : 'bg-warning') : 'bg-transparent')} aria-hidden />
          </PressButton>
        );
      })}
    </div>
  );
}
