'use client';

import * as React from 'react';
import { FileText, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useCurrentBranch } from '@/features/branch/hooks/use-branches';
import { AttentionPanel, BranchComparePanel, MethodDonutPanel, StatusRefundPanel, TopPlansPanel, WeeklyComparePanel } from '@/features/finance/components/payments/analytics-panels';
import { CollectionsChart } from '@/features/finance/components/payments/collections-chart';
import { EMPTY_FILTERS, FiltersBar, type PaymentFilters } from '@/features/finance/components/payments/filters-bar';
import { KpiStrip } from '@/features/finance/components/payments/kpi-strip';
import { HeroButton, PaymentsHero } from '@/features/finance/components/payments/payments-hero';
import { computeRange, periodNoun, toYmd, type PeriodKey } from '@/features/finance/components/payments/payments-period';
import { PaymentsTable } from '@/features/finance/components/payments/payments-table';
import { PeriodBar } from '@/features/finance/components/payments/period-bar';
import { toFinanceError, usePaymentAnalytics, usePaymentList, useVerifyPaymentStatus } from '@/features/finance/hooks/use-finance';
import { financeService } from '@/features/finance/services/finance.service';
import type { ListPaymentsParams } from '@/features/finance/types';
import { formatMoney } from '@/features/members/components/detail/detail-ui';
import { useCurrencySymbol } from '@/lib/currency';

const PAGE_SIZE = 20;

export default function PaymentsPage() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('finance:payment-create');
  const { currentBranchId } = useCurrentBranch();
  const sym = useCurrencySymbol();
  const verify = useVerifyPaymentStatus();

  const [period, setPeriod] = React.useState<PeriodKey>('month');
  const [custom, setCustom] = React.useState(() => {
    const t = toYmd(new Date());
    return { from: t, to: t };
  });
  const [compare, setCompare] = React.useState(true);
  // Local branch select (needs an explicit "All branches"), seeded from + re-synced to the header's current branch like Attendance/Analytics do.
  const [branchId, setBranchId] = React.useState('');
  React.useEffect(() => {
    setBranchId(currentBranchId ?? '');
  }, [currentBranchId]);

  const [filters, setFilters] = React.useState<PaymentFilters>(EMPTY_FILTERS);
  const debouncedSearch = useDebouncedValue(filters.search, 300);
  const [page, setPage] = React.useState(1);
  const [sortBy, setSortBy] = React.useState<NonNullable<ListPaymentsParams['sortBy']>>('paymentDate');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');

  const range = React.useMemo(() => computeRange(period, custom), [period, custom]);
  const rangeReady = Boolean(range.from && range.to);

  const analytics = usePaymentAnalytics({ dateFrom: rangeReady ? range.from : undefined, dateTo: rangeReady ? range.to : undefined, branchId: branchId || undefined });

  const listParams: ListPaymentsParams = {
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: filters.status || undefined,
    method: filters.method || undefined,
    planId: filters.planId || undefined,
    minAmount: filters.minAmount !== '' ? Number(filters.minAmount) : undefined,
    maxAmount: filters.maxAmount !== '' ? Number(filters.maxAmount) : undefined,
    dateFrom: rangeReady ? range.from : undefined,
    dateTo: rangeReady ? range.to : undefined,
    branchId: branchId || undefined,
    sortBy,
    sortDir,
  };
  const payments = usePaymentList(listParams, { keepPrevious: true });

  const patchFilters = (patch: Partial<PaymentFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const changePeriod = (p: PeriodKey) => {
    setPeriod(p);
    setPage(1);
  };
  const setDates = (from: string, to: string) => {
    setCustom({ from, to });
    setPeriod('custom');
    setPage(1);
  };
  const reset = () => {
    setFilters(EMPTY_FILTERS);
    setPeriod('month');
    setPage(1);
  };
  const toggleSort = (c: NonNullable<ListPaymentsParams['sortBy']>) => {
    if (sortBy === c) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(c);
      setSortDir('desc');
    }
    setPage(1);
  };

  const analyticsData = analytics.data;
  const aLoading = analytics.isPending;
  const aError = analytics.isError && !analyticsData;
  const previousLabel = period === 'month' ? 'Last month' : period === 'lastMonth' ? 'Month before' : 'Previous period';
  const exportParams = { ...listParams, page: undefined, limit: undefined } as Partial<ListPaymentsParams>;

  return (
    <div className="space-y-5">
      <PaymentsHero
        eyebrow="Finance"
        title="Payments"
        subtitle="Every rupee collected, refunded and still pending — compared against the previous period, split by method and branch."
        stats={[
          { value: analyticsData ? formatMoney(sym, analyticsData.kpis.collected.value) : '—', label: `collected ${periodNoun(period)}` },
          { value: analyticsData ? analyticsData.kpis.paymentCount.value : '—', label: 'payments' },
          { value: analyticsData ? `${(analyticsData.kpis.successRate.value * 100).toFixed(1)}%` : '—', label: 'success rate' },
        ]}
        statsLoading={aLoading}
        actions={
          <>
            <HeroButton href="/invoices">
              <FileText className="size-4" /> Invoices
            </HeroButton>
            <HeroButton href="/income">
              <TrendingUp className="size-4" /> Income
            </HeroButton>
            <HeroButton href="/expenses">
              <TrendingDown className="size-4" /> Expenses
            </HeroButton>
            {canCreate ? (
              <HeroButton href="/payments/new" solid>
                <Plus className="size-4" /> Record payment
              </HeroButton>
            ) : null}
          </>
        }
      />

      <PeriodBar
        period={period}
        onPeriod={changePeriod}
        customFrom={custom.from}
        customTo={custom.to}
        onCustom={setDates}
        branchId={branchId}
        onBranch={(id) => {
          setBranchId(id);
          setPage(1);
        }}
        compare={compare}
        onCompare={setCompare}
      />

      <KpiStrip analytics={analyticsData} loading={aLoading} error={aError} compare={compare} vsLabel={`vs ${previousLabel.toLowerCase()}`} />

      <div className="flex flex-wrap gap-3.5">
        <CollectionsChart analytics={analyticsData} loading={aLoading} error={aError} compare={compare} previousLabel={previousLabel} />
        <MethodDonutPanel analytics={analyticsData} loading={aLoading} error={aError} />
      </div>

      <div className="flex flex-wrap gap-3.5">
        <WeeklyComparePanel analytics={analyticsData} loading={aLoading} error={aError} compare={compare} previousLabel={previousLabel} />
        <BranchComparePanel analytics={analyticsData} loading={aLoading} error={aError} compare={compare} />
        <StatusRefundPanel analytics={analyticsData} loading={aLoading} error={aError} compare={compare} />
      </div>

      <div className="flex flex-wrap gap-3.5">
        <TopPlansPanel analytics={analyticsData} loading={aLoading} error={aError} />
        <AttentionPanel analytics={analyticsData} loading={aLoading} error={aError} onStatus={(s) => patchFilters({ status: s })} />
      </div>

      <FiltersBar
        filters={filters}
        onChange={patchFilters}
        dateFrom={range.from}
        dateTo={range.to}
        onDates={setDates}
        statuses={analyticsData?.statuses}
        branchId={branchId}
        onReset={reset}
        onCsv={() => void financeService.exportPaymentsCsvUrl(exportParams)}
        onExcel={() => void financeService.exportPaymentsExcel(exportParams)}
      />

      <PaymentsTable
        data={payments.data}
        loading={payments.isPending}
        error={payments.error}
        onRetry={() => void payments.refetch()}
        page={page}
        onPage={setPage}
        pageSize={PAGE_SIZE}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={toggleSort}
        canVerify={hasPermission('finance:payment-create')}
        onVerify={(id) =>
          verify.mutate(id, {
            onSuccess: (r) => toast.success(`Status verified: ${r.status}`),
            onError: (err) => toast.error(toFinanceError(err).message),
          })
        }
      />
    </div>
  );
}
