'use client';

import * as React from 'react';

import { useCurrentBranch } from '@/features/branch/hooks/use-branches';
import { computeRange, toYmd, type PeriodKey } from '@/features/finance/components/payments/payments-period';
import type { ReportsOverviewParams } from '../types';

/** Page-local controls for Reports/Analytics: period (+ custom dates), branch (seeded from header, "" = all) and compare toggle; `params` is ready to send. */
export function useReportsControls(initialPeriod: PeriodKey = 'month') {
  const { currentBranchId } = useCurrentBranch();
  const [period, setPeriod] = React.useState<PeriodKey>(initialPeriod);
  const [custom, setCustom] = React.useState(() => {
    const t = toYmd(new Date());
    return { from: t, to: t };
  });
  const [compare, setCompare] = React.useState(true);
  const [branchId, setBranchId] = React.useState('');
  React.useEffect(() => {
    setBranchId(currentBranchId ?? '');
  }, [currentBranchId]);

  const range = React.useMemo(() => computeRange(period, custom), [period, custom]);
  const rangeReady = Boolean(range.from && range.to && range.from <= range.to);
  const previousLabel = period === 'month' ? 'Last month' : period === 'lastMonth' ? 'Month before' : 'Previous period';
  const params = React.useMemo<ReportsOverviewParams>(() => ({ dateFrom: range.from, dateTo: range.to, branchId: branchId || undefined }), [range.from, range.to, branchId]);

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
    branchId,
    changeBranch: setBranchId,
    range,
    rangeReady,
    previousLabel,
    /** `{dateFrom,dateTo,branchId?}` — pass to `useReportsOverview`/`useReportSummary`/`useBranchComparison` (gate with `rangeReady`). */
    params,
  };
}
