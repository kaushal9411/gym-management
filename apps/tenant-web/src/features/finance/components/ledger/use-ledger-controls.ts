'use client';

import * as React from 'react';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useCurrentBranch } from '@/features/branch/hooks/use-branches';
import { computeRange, toYmd, type PeriodKey } from '../payments/payments-period';

export type LedgerSort = 'date' | 'amount';

/**
 * Page-local state shared by `/income` and `/expenses` (same shape as the Payments page): period + custom range + compare toggle,
 * a branch select seeded from (and re-synced to) the header's current branch with an explicit "All branches", search, category
 * chip, sort and page. Period/branch/search/category changes always reset to page 1.
 */
export function useLedgerControls() {
  const { currentBranchId } = useCurrentBranch();
  const [period, setPeriod] = React.useState<PeriodKey>('month');
  const [custom, setCustom] = React.useState(() => {
    const t = toYmd(new Date());
    return { from: t, to: t };
  });
  const [compare, setCompare] = React.useState(true);
  const [branchId, setBranchId] = React.useState('');
  React.useEffect(() => {
    setBranchId(currentBranchId ?? '');
  }, [currentBranchId]);

  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [category, setCategory] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [sortBy, setSortBy] = React.useState<LedgerSort>('date');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');

  const range = React.useMemo(() => computeRange(period, custom), [period, custom]);
  const rangeReady = Boolean(range.from && range.to);
  const previousLabel = period === 'month' ? 'Last month' : period === 'lastMonth' ? 'Month before' : 'Previous period';

  return {
    period,
    changePeriod: (p: PeriodKey) => {
      setPeriod(p);
      setPage(1);
    },
    custom,
    setDates: (from: string, to: string) => {
      setCustom({ from, to });
      setPeriod('custom');
      setPage(1);
    },
    compare,
    setCompare,
    branchId,
    changeBranch: (id: string) => {
      setBranchId(id);
      setPage(1);
    },
    range,
    rangeReady,
    previousLabel,
    search,
    debouncedSearch,
    changeSearch: (v: string) => {
      setSearch(v);
      setPage(1);
    },
    category,
    changeCategory: (c: string) => {
      setCategory(c);
      setPage(1);
    },
    page,
    setPage,
    sortBy,
    sortDir,
    toggleSort: (c: LedgerSort) => {
      if (sortBy === c) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      else {
        setSortBy(c);
        setSortDir('desc');
      }
      setPage(1);
    },
    reset: () => {
      setSearch('');
      setCategory('');
      setPeriod('month');
      setPage(1);
    },
  };
}
