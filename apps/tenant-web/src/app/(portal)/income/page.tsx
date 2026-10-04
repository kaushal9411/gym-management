'use client';

import * as React from 'react';
import { Download, Plus, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { DataTableColumn } from '@/components/ui/data-table';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { AddIncomeDialog } from '@/features/finance/components/ledger/add-income-dialog';
import { LedgerBranchComparePanel } from '@/features/finance/components/ledger/branch-compare-panel';
import { CategoryDonutPanel } from '@/features/finance/components/ledger/category-donut-panel';
import { LedgerFiltersBar } from '@/features/finance/components/ledger/ledger-filters-bar';
import { LedgerKpiStrip } from '@/features/finance/components/ledger/ledger-kpi-strip';
import { DeleteRowMenu, LedgerTable, SortHeader } from '@/features/finance/components/ledger/ledger-table';
import { INCOME_THEME } from '@/features/finance/components/ledger/ledger-theme';
import { TopEntriesPanel } from '@/features/finance/components/ledger/top-entries-panel';
import { TrendChartPanel } from '@/features/finance/components/ledger/trend-chart-panel';
import { useLedgerControls } from '@/features/finance/components/ledger/use-ledger-controls';
import { CategoryBadge, INCOME_CATEGORY_META } from '@/features/finance/components/finance-badges';
import { HeroButton, PaymentsHero } from '@/features/finance/components/payments/payments-hero';
import { periodNoun } from '@/features/finance/components/payments/payments-period';
import { fmtDate } from '@/features/finance/components/payments/payments-ui';
import { PeriodBar } from '@/features/finance/components/payments/period-bar';
import { toFinanceError, useDeleteIncome, useIncomeAnalytics, useIncomeList } from '@/features/finance/hooks/use-finance';
import { financeService } from '@/features/finance/services/finance.service';
import type { Income, IncomeCategory, ListIncomeParams } from '@/features/finance/types';
import { formatMoney } from '@/features/members/components/detail/detail-ui';
import { useCurrencySymbol } from '@/lib/currency';

const PAGE_SIZE = 20;
const theme = INCOME_THEME;

export default function IncomePage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('finance:income-manage');
  const canViewAnalytics = hasPermission('finance:view');
  const sym = useCurrencySymbol();
  const c = useLedgerControls();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<Income | null>(null);
  const deleteIncome = useDeleteIncome();

  const dateFrom = c.rangeReady ? c.range.from : undefined;
  const dateTo = c.rangeReady ? c.range.to : undefined;
  const analytics = useIncomeAnalytics({ dateFrom, dateTo, branchId: c.branchId || undefined }, { enabled: canViewAnalytics });

  const listParams: ListIncomeParams = {
    page: c.page,
    limit: PAGE_SIZE,
    search: c.debouncedSearch || undefined,
    category: (c.category || undefined) as IncomeCategory | undefined,
    dateFrom,
    dateTo,
    branchId: c.branchId || undefined,
    sortBy: c.sortBy === 'date' ? 'incomeDate' : 'amount',
    sortDir: c.sortDir,
  };
  const income = useIncomeList(listParams, { keepPrevious: true });
  const exportParams = { ...listParams, page: undefined, limit: undefined } as Partial<ListIncomeParams>;

  const a = analytics.data;
  const aLoading = analytics.isPending;
  const aError = analytics.isError && !a;

  const runDelete = () => {
    if (!confirmDelete) return;
    deleteIncome.mutate(confirmDelete.id, {
      onSuccess: () => toast.success('Income deleted.'),
      onError: (err) => toast.error(toFinanceError(err).message),
    });
    setConfirmDelete(null);
  };

  const sortProps = { sortBy: c.sortBy, sortDir: c.sortDir, onSort: c.toggleSort };
  const columns: DataTableColumn<Income>[] = [
    { key: 'category', header: 'Category', render: (i) => <CategoryBadge category={i.category} meta={INCOME_CATEGORY_META} /> },
    { key: 'amount', header: <SortHeader label="Amount" column="amount" right {...sortProps} />, className: 'text-right', render: (i) => <span className="font-extrabold tabular-nums">{formatMoney(sym, i.amount)}</span> },
    { key: 'date', header: <SortHeader label="Date" column="date" {...sortProps} />, render: (i) => <span className="whitespace-nowrap">{fmtDate(i.incomeDate, { day: 'numeric', month: 'short', year: 'numeric' })}</span> },
    { key: 'branch', header: 'Branch', render: (i) => i.branch?.name ?? <span className="text-muted-foreground">—</span> },
    { key: 'description', header: 'Description', render: (i) => <span className="block max-w-[280px] truncate" title={i.description ?? undefined}>{i.description ?? '—'}</span> },
    {
      key: 'recordedBy',
      header: 'Recorded by',
      render: (i) => (i.sourcePaymentId ? <span className="text-xs font-bold text-muted-foreground">Auto (payment)</span> : (i.recordedBy?.name ?? <span className="text-muted-foreground">—</span>)),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'w-10 text-right',
      render: (i) => (canManage && !i.sourcePaymentId ? <DeleteRowMenu label={i.description ?? 'income entry'} onDelete={() => setConfirmDelete(i)} /> : null),
    },
  ];

  return (
    <div className="space-y-5">
      <PaymentsHero
        eyebrow="Finance"
        title="Income"
        subtitle="The gym's revenue ledger — membership fees, training, sales and other income, compared against the previous period."
        stats={
          canViewAnalytics
            ? [
                { value: a ? formatMoney(sym, a.kpis.total.value) : '—', label: `total ${periodNoun(c.period)}` },
                { value: a ? a.kpis.count.value : '—', label: 'entries' },
                { value: a ? formatMoney(sym, a.kpis.average.value) : '—', label: 'average entry' },
              ]
            : undefined
        }
        statsLoading={aLoading}
        actions={
          <>
            <HeroButton onClick={() => void financeService.exportIncomeCsv(exportParams)}>
              <Upload className="size-4" /> CSV
            </HeroButton>
            <HeroButton onClick={() => void financeService.exportIncomeExcel(exportParams)}>
              <Download className="size-4" /> Excel
            </HeroButton>
            {canManage ? (
              <HeroButton solid onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" /> Add income
              </HeroButton>
            ) : null}
          </>
        }
      />

      <PeriodBar
        period={c.period}
        onPeriod={c.changePeriod}
        customFrom={c.custom.from}
        customTo={c.custom.to}
        onCustom={c.setDates}
        branchId={c.branchId}
        onBranch={c.changeBranch}
        compare={c.compare}
        onCompare={c.setCompare}
      />

      {canViewAnalytics ? (
        <>
          <LedgerKpiStrip analytics={a} loading={aLoading} error={aError} compare={c.compare} vsLabel={`vs ${c.previousLabel.toLowerCase()}`} theme={theme} />
          <div className="flex flex-wrap gap-3.5">
            <TrendChartPanel analytics={a} loading={aLoading} error={aError} theme={theme} compare={c.compare} previousLabel={c.previousLabel} />
            <CategoryDonutPanel analytics={a} loading={aLoading} error={aError} theme={theme} compare={c.compare} />
          </div>
          <div className="flex flex-wrap gap-3.5">
            <LedgerBranchComparePanel analytics={a} loading={aLoading} error={aError} theme={theme} compare={c.compare} />
            <TopEntriesPanel analytics={a} loading={aLoading} error={aError} theme={theme} />
          </div>
        </>
      ) : null}

      <LedgerFiltersBar
        search={c.search}
        onSearch={c.changeSearch}
        dateFrom={c.range.from}
        dateTo={c.range.to}
        onDates={c.setDates}
        categoryMeta={INCOME_CATEGORY_META}
        category={c.category}
        onCategory={c.changeCategory}
        counts={a?.categories}
        onReset={c.reset}
      />

      <LedgerTable
        title="All income"
        columns={columns}
        data={income.data}
        loading={income.isPending}
        error={income.error}
        onRetry={() => void income.refetch()}
        page={c.page}
        onPage={c.setPage}
        pageSize={PAGE_SIZE}
        emptyMessage="No income entries match these filters."
      />

      <AddIncomeDialog open={createOpen} onOpenChange={setCreateOpen} />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="Delete this income entry?"
        description="This soft-deletes the entry — it stays in the database for audit history but is hidden from the ledger."
        destructive
        loading={deleteIncome.isPending}
        onConfirm={runDelete}
      />
    </div>
  );
}
