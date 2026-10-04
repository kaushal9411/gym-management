'use client';

import * as React from 'react';

import { computeRange, toYmd, type PeriodKey } from '@/features/finance/components/payments/payments-period';

/** Local period + compare controls (announcements carry their own branch, so there is no branch control). */
export function useAnnouncementPeriod(initial: PeriodKey = 'month') {
  const [period, setPeriod] = React.useState<PeriodKey>(initial);
  const [custom, setCustom] = React.useState(() => {
    const t = toYmd(new Date());
    return { from: t, to: t };
  });
  const [compare, setCompare] = React.useState(true);
  const range = React.useMemo(() => computeRange(period, custom), [period, custom]);
  const rangeReady = Boolean(range.from && range.to && range.from <= range.to);
  const params = React.useMemo(() => ({ dateFrom: range.from, dateTo: range.to }), [range.from, range.to]);
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
    params,
  };
}
