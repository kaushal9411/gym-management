'use client';

import { toIsoDate } from '@/features/members/components/detail/date-utils';
import { useAppSelector } from '@/store/hooks';

const DAYS = { '7d': 7, '30d': 30, '90d': 90 } as const;

/** The shared header range (`7d`/`30d`/`90d`) as concrete `dateFrom`/`dateTo` strings for the trend endpoints. */
export function useDashboardRange() {
  const range = useAppSelector((state) => state.dashboard.dateRange);
  const days = DAYS[range];
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));
  return { range, days, dateFrom: toIsoDate(from), dateTo: toIsoDate(to) };
}
