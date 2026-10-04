'use client';

import * as React from 'react';
import { Download, Plus, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { DataTableColumn } from '@/components/ui/data-table';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { LedgerBranchComparePanel } from '@/features/finance/components/ledger/branch-compare-panel';
import { CategoryDonutPanel } from '@/features/finance/components/ledger/category-donut-panel';
import { LedgerFiltersBar } from '@/features/finance/components/ledger/ledger-filters-bar';
import { LedgerKpiStrip } from '@/features/finance/components/ledger/ledger-kpi-strip';
import { DeleteRowMenu, LedgerTable, SortHeader } from '@/features/finance/components/ledger/ledger-table';
import { EXPENSE_THEME } from '@/features/finance/components/ledger/ledger-theme';
import { TopEntriesPanel } from '@/features/finance/components/ledger/top-entries-panel';
import { TrendChartPanel } from '@/features/finance/components/ledger/trend-chart-panel';
import { useLedgerControls } from '@/features/finance/components/ledger/use-ledger-controls';
import { CategoryBadge, EXPENSE_CATEGORY_META } from '@/features/finance/components/finance-badges';
import { HeroButton, PaymentsHero } from '@/features/finance/components/payments/payments-hero';
import { periodNoun } from '@/features/finance/components/payments/payments-period';
import { fmtDate } from '@/features/finance/components/payments/payments-ui';
import { PeriodBar } from '@/features/finance/components/payments/period-bar';
import { toFinanceError, useDeleteExpense, useExpenseAnalytics, useExpenseList } from '@/features/finance/hooks/use-finance';
import { financeService } from '@/features/finance/services/finance.service';
import type { Expense, ExpenseCategory, ListExpensesParams } from '@/features/finance/types';
import { formatMoney } from '@/features/members/components/detail/detail-ui';
import { useCurrencySymbol } from '@/lib/currency';

const PAGE_SIZE = 20;
const theme = EXPENSE_THEME;

export default function ExpensesPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('finance:expense-manage');
  const canViewAnalytics = hasPermission('finance:view');
  const sym = useCurrencySymbol();
  const c = useLedgerControls();

  const [confirmDelete, setConfirmDelete] = React.useState<Expense | null>(null);
  const deleteExpense = useDeleteExpense();

  const dateFrom = c.rangeReady ? c.range.from : undefined;
  const dateTo = c.rangeReady ? c.range.to : undefined;
  const analytics = useExpenseAnalytics({ dateFrom, dateTo, branchId: c.branchId || undefined }, { enabled: canViewAnalytics });

  const listParams: ListExpensesParams = {
    page: c.page,
    limit: PAGE_SIZE,
    search: c.debouncedSearch || undefined,
    category: (c.category || undefined) as ExpenseCategory | undefined,
    dateFrom,
    dateTo,
    branchId: c.branchId || undefined,
    sortBy: c.sortBy === 'date' ? 'expenseDate' : 'amount',
    sortDir: c.sortDir,
  };
  const expenses = useExpenseList(listParams, { keepPrevious: true });
  const exportParams = { ...listParams, page: undefined, limit: undefined } as Partial<ListExpensesParams>;

  const a = analytics.data;
  const aLoading = analytics.isPending;
  const aError = analytics.isError && !a;

  const runDelete = () => {
    if (!confirmDelete) return;
    deleteExpense.mutate(confirmDelete.id, {
      onSuccess: () => toast.success('Expense deleted.'),
      onError: (err) => toast.error(toFinanceError(err).message),
    });
    setConfirmDelete(null);
  };

  const sortProps = { sortBy: c.sortBy, sortDir: c.sortDir, onSort: c.toggleSort };
  const columns: DataTableColumn<Expense>[] = [
    { key: 'category', header: 'Category', render: (e) => <CategoryBadge category={e.category} meta={EXPENSE_CATEGORY_META} /> },
    { key: 'amount', header: <SortHeader label="Amount" column="amount" right {...sortProps} />, className: 'text-right', render: (e) => <span className="font-extrabold tabular-nums">{formatMoney(sym, e.amount)}</span> },
    { key: 'date', header: <SortHeader label="Date" column="date" {...sortProps} />, render: (e) => <span className="whitespace-nowrap">{fmtDate(e.expenseDate, { day: 'numeric', month: 'short', year: 'numeric' })}</span> },
    { key: 'branch', header: 'Branch', render: (e) => e.branch?.name ?? <span className="text-muted-foreground">—</span> },
    { key: 'description', header: 'Description', render: (e) => <span className="block max-w-[280px] truncate" title={e.description ?? undefined}>{e.description ?? '—'}</span> },
    {
      key: 'receipt',
      header: 'Receipt',
      render: (e) =>
        e.receiptDataUrl ? (
          <a href={e.receiptDataUrl} download={e.receiptFileName ?? 'receipt'} className="text-sm font-semibold text-primary hover:underline">
            {e.receiptFileName ?? 'Download'}
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { key: 'recordedBy', header: 'Recorded by', render: (e) => e.recordedBy?.name ?? <span className="text-muted-foreground">—</span> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'w-10 text-right',
      render: (e) => (canManage ? <DeleteRowMenu label={e.description ?? 'expense'} onDelete={() => setConfirmDelete(e)} /> : null),
    },
  ];

  return (
    <div className="space-y-5">
      <PaymentsHero
        eyebrow="Finance"
        title="Expenses"
        subtitle="The gym's expense ledger — rent, salaries, utilities and more, compared against the previous period."
        stats={
          canViewAnalytics
            ? [
                { value: a ? formatMoney(sym, a.kpis.total.value) : '—', label: `spent ${periodNoun(c.period)}` },
                { value: a ? a.kpis.count.value : '—', label: 'expenses' },
                { value: a ? formatMoney(sym, a.kpis.average.value) : '—', label: 'average expense' },
              ]
            : undefined
        }
        statsLoading={aLoading}
        actions={
          <>
            <HeroButton onClick={() => void financeService.exportExpensesCsv(exportParams)}>
              <Upload className="size-4" /> CSV
            </HeroButton>
            <HeroButton onClick={() => void financeService.exportExpensesExcel(exportParams)}>
              <Download className="size-4" /> Excel
            </HeroButton>
            {canManage ? (
              <HeroButton href="/expenses/new" solid>
                <Plus className="size-4" /> Add expense
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
        categoryMeta={EXPENSE_CATEGORY_META}
        category={c.category}
        onCategory={c.changeCategory}
        counts={a?.categories}
        onReset={c.reset}
      />

      <LedgerTable
        title="All expenses"
        columns={columns}
        data={expenses.data}
        loading={expenses.isPending}
        error={expenses.error}
        onRetry={() => void expenses.refetch()}
        page={c.page}
        onPage={c.setPage}
        pageSize={PAGE_SIZE}
        emptyMessage="No expenses match these filters."
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="Delete this expense?"
        description="This soft-deletes the expense — it stays in the database for audit history but is hidden from the ledger."
        destructive
        loading={deleteExpense.isPending}
        onConfirm={runDelete}
      />
    </div>
  );
}
