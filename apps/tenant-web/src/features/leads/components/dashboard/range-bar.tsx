'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Chip, FieldLabel } from '@/features/finance/components/payments/payments-ui';
import { useBranches } from '@/features/branch/hooks/use-branches';
import { cn } from '@/lib/utils';
import type { LeadsPageState } from '../../hooks/use-leads-page-state';
import type { AnalyticsRangeKey } from '../../types';

const RANGES: { key: AnalyticsRangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: 'month', label: 'This month' },
  { key: 'year', label: 'This year' },
  { key: 'custom', label: 'Custom' },
];

export function RangeBar({ s }: { s: LeadsPageState }) {
  const branches = useBranches();
  return (
    <section aria-label="Analytics range" className="flex flex-wrap items-center justify-between gap-3.5 rounded-[20px] border bg-card px-4 py-3.5 shadow-xs sm:px-[18px]">
      <div className="flex flex-wrap items-center gap-2">
        <FieldLabel className="mr-1.5">Range</FieldLabel>
        {RANGES.map((r) => (
          <Chip key={r.key} active={s.range === r.key} onClick={() => s.set({ range: r.key === '30d' ? null : r.key }, false)}>
            {r.label}
          </Chip>
        ))}
        {s.range === 'custom' ? (
          <span className="flex items-center gap-1.5">
            <Input type="date" aria-label="Range start" className="h-[34px] w-[140px]" value={s.rangeFrom} max={s.rangeTo || undefined} onChange={(e) => s.set({ rfrom: e.target.value }, false)} />
            <span className="text-muted-foreground">-</span>
            <Input type="date" aria-label="Range end" className="h-[34px] w-[140px]" value={s.rangeTo} min={s.rangeFrom || undefined} onChange={(e) => s.set({ rto: e.target.value }, false)} />
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {(branches.data?.length ?? 0) > 1 ? (
          <div className="min-w-[180px]">
            <Select aria-label="Branch" value={s.branchId} onChange={(e) => s.set({ branch: e.target.value })}>
              <option value="">All branches</option>
              {(branches.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
          </div>
        ) : null}
        <div className="flex items-center gap-2.5 text-[13px] font-bold text-foreground/80">
          <button
            type="button"
            role="switch"
            aria-checked={s.compare}
            aria-label="Compare with previous period"
            onClick={() => s.set({ cmp: s.compare ? '0' : null }, false)}
            className={cn('relative h-6 w-[42px] shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', s.compare ? 'bg-primary' : 'bg-muted-foreground/30')}
          >
            <span className={cn('absolute top-[3px] size-[18px] rounded-full bg-white transition-all', s.compare ? 'right-[3px]' : 'left-[3px]')} />
          </button>
          <span>Compare with previous period</span>
        </div>
      </div>
    </section>
  );
}
