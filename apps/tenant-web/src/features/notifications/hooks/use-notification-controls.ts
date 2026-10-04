'use client';

import * as React from 'react';

import { computeRange, toYmd, type PeriodKey } from '@/features/finance/components/payments/payments-period';
import type { NotificationStatsParams } from '../types';

/** Period (+ custom dates) and compare toggle for the notifications dashboard. No branch: the feed is tenant-wide. Gate queries on `rangeReady`. */
export function useNotificationControls(initialPeriod: PeriodKey = 'month') {
  const [period, setPeriod] = React.useState<PeriodKey>(initialPeriod);
  const [custom, setCustom] = React.useState(() => {
    const t = toYmd(new Date());
    return { from: t, to: t };
  });
  const [compare, setCompare] = React.useState(true);

  const range = React.useMemo(() => computeRange(period, custom), [period, custom]);
  const rangeReady = Boolean(range.from && range.to && range.from <= range.to);
  const previousLabel = period === 'month' ? 'Last month' : period === 'lastMonth' ? 'Month before' : 'Previous period';
  const params = React.useMemo<NotificationStatsParams>(() => ({ dateFrom: range.from, dateTo: range.to }), [range.from, range.to]);

  return {
    period,
    changePeriod: setPeriod,
    custom,
    setDates: (from: string, to: string) => {
      setCustom({ from, to });
      setPeriod('custom');
    },
    compare,
    setCompare,
    range,
    rangeReady,
    previousLabel,
    params,
  };
}
