'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { Chip, FieldLabel } from '@/features/finance/components/payments/payments-ui';
import { PERIODS, type PeriodKey } from '@/features/finance/components/payments/payments-period';
import { cn } from '@/lib/utils';

interface Props {
  period: PeriodKey;
  onPeriod: (p: PeriodKey) => void;
  customFrom: string;
  customTo: string;
  onCustom: (from: string, to: string) => void;
  compare: boolean;
  onCompare: (v: boolean) => void;
}

/** `PeriodBar` without the branch select (the notification feed is tenant-wide, not per branch). Same look, same chips. */
export function NotificationPeriodBar({ period, onPeriod, customFrom, customTo, onCustom, compare, onCompare }: Props) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-3.5 rounded-[20px] border bg-card px-4 py-3.5 shadow-xs sm:px-[18px]">
      <div className="flex flex-wrap items-center gap-2">
        <FieldLabel className="mr-1.5">Period</FieldLabel>
        {PERIODS.map((p) => (
          <Chip key={p.key} active={period === p.key} onClick={() => onPeriod(p.key)}>
            {p.label}
          </Chip>
        ))}
        {period === 'custom' ? (
          <span className="flex items-center gap-1.5">
            <Input type="date" aria-label="Period start" className="h-[34px] w-[140px]" value={customFrom} max={customTo || undefined} onChange={(e) => onCustom(e.target.value, customTo)} />
            <span className="text-muted-foreground">–</span>
            <Input type="date" aria-label="Period end" className="h-[34px] w-[140px]" value={customTo} min={customFrom || undefined} onChange={(e) => onCustom(customFrom, e.target.value)} />
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2.5 text-[13px] font-bold text-foreground/80">
        <button
          type="button"
          role="switch"
          aria-checked={compare}
          aria-label="Compare with previous period"
          onClick={() => onCompare(!compare)}
          className={cn('relative h-6 w-[42px] shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', compare ? 'bg-primary' : 'bg-muted-foreground/30')}
        >
          <span className={cn('absolute top-[3px] size-[18px] rounded-full bg-white transition-all', compare ? 'right-[3px]' : 'left-[3px]')} />
        </button>
        <span>Compare with previous period</span>
      </div>
    </section>
  );
}
