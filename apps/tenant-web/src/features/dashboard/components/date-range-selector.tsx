'use client';

import { dateRangeChanged, type DashboardDateRange } from '../store/dashboard-slice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { cn } from '@/lib/utils';

const OPTIONS: Array<{ value: DashboardDateRange; label: string }> = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

/** Shared date-range filter every chart/widget on the dashboard reads from Redux. */
export function DateRangeSelector() {
  const dispatch = useAppDispatch();
  const dateRange = useAppSelector((state) => state.dashboard.dateRange);

  return (
    <div className="inline-flex rounded-md border p-0.5">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => dispatch(dateRangeChanged(option.value))}
          className={cn(
            'rounded px-3 py-1 text-xs font-medium transition-colors',
            dateRange === option.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
