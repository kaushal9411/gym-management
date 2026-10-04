'use client';

import * as React from 'react';
import { CreditCard, Plus, TrendingUp } from 'lucide-react';

import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { InvoicesFilters, EMPTY_INVOICE_FILTERS, type InvoiceFilters } from '@/features/finance/components/invoices/invoices-filters';
import { InvoicesInsights } from '@/features/finance/components/invoices/invoices-insights';
import { InvoicesKpis } from '@/features/finance/components/invoices/invoices-kpis';
import { InvoicesTable } from '@/features/finance/components/invoices/invoices-table';
import { HeroButton, PaymentsHero } from '@/features/finance/components/payments/payments-hero';
import { periodNoun } from '@/features/finance/components/payments/payments-period';
import { PeriodBar } from '@/features/finance/components/payments/period-bar';
import { useInvoiceAnalytics, useInvoiceList } from '@/features/finance/hooks/use-finance';
import type { ListInvoicesParams } from '@/features/finance/types';
import { formatMoney } from '@/features/members/components/detail/detail-ui';
import { useReportsControls } from '@/features/reports/hooks/use-reports-controls';
import { AnimatedNumber } from '@/features/reports/components/ui';
import { useCurrencySymbol } from '@/lib/currency';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

const PAGE_SIZE = 20;

export default function InvoicesPage() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('finance:payment-create');
  const canView = hasPermission('finance:invoice-view');
  const canDownload = hasPermission('finance:invoice-download');
  const sym = useCurrencySymbol();

  // Period / compare / branch (seeded from the header branch, "" = all) — same controls as Reports.
  const c = useReportsControls('month');
  const [filters, setFilters] = React.useState<InvoiceFilters>(EMPTY_INVOICE_FILTERS);
  const debouncedSearch = useDebouncedValue(filters.search, 300);
  const [page, setPage] = React.useState(1);
  const [sortBy, setSortBy] = React.useState<NonNullable<ListInvoicesParams['sortBy']>>('createdAt');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');

  // Header branch switch re-scopes the whole list — back to page 1 like any other filter change.
  React.useEffect(() => {
    setPage(1);
  }, [c.branchId]);

  const analytics = useInvoiceAnalytics(c.params, canView && c.rangeReady);
  const listParams: ListInvoicesParams = {
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: filters.status || undefined,
    minAmount: filters.minAmount !== '' ? Number(filters.minAmount) : undefined,
    maxAmount: filters.maxAmount !== '' ? Number(filters.maxAmount) : undefined,
    dateFrom: c.rangeReady ? c.range.from : undefined,
    dateTo: c.rangeReady ? c.range.to : undefined,
    branchId: c.branchId || undefined,
    sortBy,
    sortDir,
  };
  const invoices = useInvoiceList(listParams, { keepPrevious: true });

  const patchFilters = (patch: Partial<InvoiceFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const toggleSort = (col: NonNullable<ListInvoicesParams['sortBy']>) => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(col);
      setSortDir('desc');
    }
  };
  const reset = () => {
    setFilters(EMPTY_INVOICE_FILTERS);
    c.changePeriod('month');
    setPage(1);
  };

  const a = analytics.data;
  const showAnalytics = canView && !(analytics.isError && !a);
  const aLoading = analytics.isPending && showAnalytics;
  const summary = invoices.data?.summary;
  // Hero numbers: analytics when present, else the list's filtered summary (so the hero still works while the stats endpoint is down).
  const heroNum = (fromA: string | undefined, fromList: string | undefined) => {
    const v = fromA ?? fromList;
    return v === undefined ? '—' : <AnimatedNumber value={Number(v) || 0} format={(n) => formatMoney(sym, n)} />;
  };

  return (
    <div className="space-y-5">
      <PaymentsHero
        eyebrow="Finance"
        title="Invoices"
        subtitle="Bills issued to members — auto-generated on payment or created in advance — with collection, ageing and who still owes."
        stats={[
          { value: heroNum(a?.kpis.invoiced.value, summary?.invoiced), label: `invoiced ${periodNoun(c.period)}` },
          { value: heroNum(a?.kpis.collected.value, summary?.collected), label: 'collected' },
          { value: heroNum(a?.kpis.outstanding.value, summary?.outstanding), label: 'outstanding' },
        ]}
        statsLoading={aLoading && !summary}
        actions={
          <>
            <HeroButton href="/payments">
              <CreditCard className="size-4" /> Payments
            </HeroButton>
            <HeroButton href="/income">
              <TrendingUp className="size-4" /> Income
            </HeroButton>
            {canCreate ? (
              <HeroButton href="/invoices/new" solid>
                <Plus className="size-4" /> Generate invoice
              </HeroButton>
            ) : null}
          </>
        }
      />

      <PeriodBar
        period={c.period}
        onPeriod={(p) => {
          c.changePeriod(p);
          setPage(1);
        }}
        customFrom={c.custom.from}
        customTo={c.custom.to}
        onCustom={(f, t) => {
          c.setDates(f, t);
          setPage(1);
        }}
        branchId={c.branchId}
        onBranch={c.changeBranch}
        compare={c.compare}
        onCompare={c.setCompare}
      />

      {showAnalytics ? (
        <>
          <InvoicesKpis analytics={a} loading={aLoading} compare={c.compare} vsLabel={`vs ${c.previousLabel.toLowerCase()}`} />
          <InvoicesInsights analytics={a} loading={aLoading} compare={c.compare} previousLabel={c.previousLabel} />
        </>
      ) : null}

      <InvoicesFilters
        filters={filters}
        onChange={patchFilters}
        dateFrom={c.range.from}
        dateTo={c.range.to}
        onDates={(f, t) => {
          c.setDates(f, t);
          setPage(1);
        }}
        counts={invoices.data?.counts}
        onReset={reset}
      />

      <InvoicesTable
        data={invoices.data}
        loading={invoices.isPending}
        error={invoices.error}
        onRetry={() => void invoices.refetch()}
        page={page}
        onPage={setPage}
        pageSize={PAGE_SIZE}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={toggleSort}
        canDownload={canDownload}
      />
    </div>
  );
}
