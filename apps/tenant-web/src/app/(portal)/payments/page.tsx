'use client';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import * as React from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Plus, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { SearchBar } from '@/components/ui/search-bar';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useCurrentBranch } from '@/features/branch/hooks/use-branches';
import { FinanceSummaryCards } from '@/features/finance/components/finance-summary-cards';
import { PaymentMethodBadge, PaymentStatusBadge } from '@/features/finance/components/finance-badges';
import { RevenueTrendChart } from '@/features/finance/components/revenue-trend-chart';
import { useFinanceDashboard, usePaymentList } from '@/features/finance/hooks/use-finance';
import { financeService } from '@/features/finance/services/finance.service';
import type { ListPaymentsParams, MemberPaymentListItem, MemberPaymentMethod, MemberPaymentStatus } from '@/features/finance/types';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
);

type SortableColumn = NonNullable<ListPaymentsParams['sortBy']>;

export default function PaymentsPage() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('finance:payment-create');
  const { currentBranchId } = useCurrentBranch();

  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [status, setStatus] = React.useState<MemberPaymentStatus | ''>('');
  const [method, setMethod] = React.useState<MemberPaymentMethod | ''>('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [sortBy, setSortBy] = React.useState<SortableColumn>('paymentDate');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');

  // Header branch switch re-scopes the whole page — back to page 1 like any other filter change.
  React.useEffect(() => {
    setPage(1);
  }, [currentBranchId]);

  const dashboard = useFinanceDashboard(currentBranchId ?? undefined);
  const params = {
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: status || undefined,
    method: method || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    branchId: currentBranchId ?? undefined,
    sortBy,
    sortDir,
  };
  const payments = usePaymentList(params);

  const data = payments.data;
  const items = data?.items ?? [];

  const toggleSort = (column: SortableColumn) => {
    if (sortBy === column) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(column);
      setSortDir('desc');
    }
  };
  const sortIcon = (column: SortableColumn) => {
    if (sortBy !== column) return <ArrowUpDown className="size-3.5 text-muted-foreground" />;
    return sortDir === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />;
  };
  const sortableHeader = (label: string, column: SortableColumn) => (
    <button type="button" className="flex items-center gap-1 font-medium hover:text-foreground" onClick={() => toggleSort(column)}>
      {label} {sortIcon(column)}
    </button>
  );

  const columns: DataTableColumn<MemberPaymentListItem>[] = [
    {
      key: 'paymentNumber',
      header: 'Payment',
      render: (p) => (
        <Link href={`/payments/${p.id}`} className="hover:underline">
          <span className="block font-medium">{p.paymentNumber}</span>
          <span className="block text-xs text-muted-foreground">{p.member.name}</span>
        </Link>
      ),
    },
    { key: 'method', header: 'Method', render: (p) => <PaymentMethodBadge method={p.method} /> },
    { key: 'finalAmount', header: sortableHeader('Amount', 'finalAmount'), render: (p) => `$${p.finalAmount}` },
    { key: 'paymentDate', header: sortableHeader('Date', 'paymentDate'), render: (p) => new Date(p.paymentDate).toLocaleDateString() },
    { key: 'status', header: 'Status', render: (p) => <PaymentStatusBadge status={p.status} /> },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
          <p className="text-muted-foreground">Member payments, invoices, income, and expenses.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/invoices">Invoices</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/income">Income</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/expenses">Expenses</Link>
          </Button>
          {canCreate ? (
            <Button size="sm" asChild>
              <Link href="/payments/new">
                <Plus className="size-4" /> Record payment
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <FinanceSummaryCards summary={dashboard.data} loading={dashboard.isPending} />
      <RevenueTrendChart trend={dashboard.data?.revenueTrend} loading={dashboard.isPending} />

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar
          containerClassName="max-w-xs"
          placeholder="Search payment number, member, reference…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className={selectClassName}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as MemberPaymentStatus | '');
            setPage(1);
          }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="SUCCESS">Success</option>
          <option value="FAILED">Failed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="REFUNDED">Refunded</option>
          <option value="PARTIALLY_REFUNDED">Partially refunded</option>
        </select>
        <select
          className={selectClassName}
          value={method}
          onChange={(e) => {
            setMethod(e.target.value as MemberPaymentMethod | '');
            setPage(1);
          }}
          aria-label="Filter by method"
        >
          <option value="">All methods</option>
          <option value="CASH">Cash</option>
          <option value="UPI">UPI</option>
          <option value="CREDIT_CARD">Credit Card</option>
          <option value="DEBIT_CARD">Debit Card</option>
          <option value="BANK_TRANSFER">Bank Transfer</option>
          <option value="CHEQUE">Cheque</option>
          <option value="ONLINE_GATEWAY">Online Gateway</option>
        </select>
        <Input type="date" aria-label="From date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
        <Input type="date" aria-label="To date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
        <Button variant="outline" size="sm" onClick={() => void financeService.exportPaymentsCsvUrl(params)}>
          <Upload className="size-4" /> CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => void financeService.exportPaymentsExcel(params)}>
          <Download className="size-4" /> Excel
        </Button>
      </div>

      <DataTable columns={columns} rows={items} rowKey={(p) => p.id} loading={payments.isPending} error={payments.error} onRetry={() => payments.refetch()} emptyMessage="No payments match these filters." />

      {data && data.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.page} of {data.totalPages} · {data.total} payments
          </span>
          <span className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </span>
        </div>
      ) : null}
    </div>
  );
}
