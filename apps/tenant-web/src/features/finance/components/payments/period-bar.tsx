'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useBranches } from '@/features/branch/hooks/use-branches';
import { cn } from '@/lib/utils';
import { Chip, FieldLabel } from './payments-ui';
import { PERIODS, type PeriodKey } from './payments-period';

interface PeriodBarProps {
  period: PeriodKey;
  onPeriod: (p: PeriodKey) => void;
  customFrom: string;
  customTo: string;
  onCustom: (from: string, to: string) => void;
  branchId: string;
  onBranch: (id: string) => void;
  compare: boolean;
  onCompare: (v: boolean) => void;
}

export function PeriodBar({ period, onPeriod, customFrom, customTo, onCustom, branchId, onBranch, compare, onCompare }: PeriodBarProps) {
  const branches = useBranches();
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
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[190px]">
          <Select aria-label="Branch" value={branchId} onChange={(e) => onBranch(e.target.value)}>
            <option value="">All branches</option>
            {(branches.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
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
      </div>
    </section>
  );
}
