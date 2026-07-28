'use client';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import * as React from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { SearchBar } from '@/components/ui/search-bar';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useCurrentBranch } from '@/features/branch/hooks/use-branches';
import { InvoiceStatusBadge } from '@/features/finance/components/finance-badges';
import { useInvoiceList } from '@/features/finance/hooks/use-finance';
import type { ListInvoicesParams, MemberInvoiceListItem, MemberInvoiceStatus } from '@/features/finance/types';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
);

type SortableColumn = NonNullable<ListInvoicesParams['sortBy']>;

export default function InvoicesPage() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('finance:payment-create');
  const { currentBranchId } = useCurrentBranch();

  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [status, setStatus] = React.useState<MemberInvoiceStatus | ''>('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [sortBy, setSortBy] = React.useState<SortableColumn>('createdAt');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');

  // Header branch switch re-scopes the whole list — back to page 1 like any other filter change.
  React.useEffect(() => {
    setPage(1);
  }, [currentBranchId]);

  const invoices = useInvoiceList({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: status || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    branchId: currentBranchId ?? undefined,
    sortBy,
    sortDir,
  });

  const data = invoices.data;
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

  const columns: DataTableColumn<MemberInvoiceListItem>[] = [
    {
      key: 'invoiceNumber',
      header: 'Invoice',
      render: (inv) => (
        <Link href={`/invoices/${inv.id}`} className="hover:underline">
          <span className="block font-medium">{inv.invoiceNumber}</span>
          <span className="block text-xs text-muted-foreground">{inv.member.name}</span>
        </Link>
      ),
    },
    { key: 'invoiceDate', header: sortableHeader('Invoice date', 'invoiceDate'), render: (inv) => new Date(inv.invoiceDate).toLocaleDateString() },
    { key: 'dueDate', header: sortableHeader('Due date', 'dueDate'), render: (inv) => new Date(inv.dueDate).toLocaleDateString() },
    { key: 'totalAmount', header: sortableHeader('Total', 'totalAmount'), render: (inv) => `$${inv.totalAmount}` },
    { key: 'status', header: 'Status', render: (inv) => <InvoiceStatusBadge status={inv.status} /> },
  ];

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/payments">
          <ArrowLeft className="size-4" /> Back to payments
        </Link>
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">Bills issued to members — auto-generated on payment, or created in advance.</p>
        </div>
        {canCreate ? (
          <Button size="sm" asChild>
            <Link href="/invoices/new">
              <Plus className="size-4" /> Generate invoice
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar
          containerClassName="max-w-xs"
          placeholder="Search invoice number, member…"
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
            setStatus(e.target.value as MemberInvoiceStatus | '');
            setPage(1);
          }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PAID">Paid</option>
          <option value="PARTIALLY_PAID">Partially paid</option>
          <option value="OVERDUE">Overdue</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <Input type="date" aria-label="From date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
        <Input type="date" aria-label="To date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
      </div>

      <DataTable columns={columns} rows={items} rowKey={(inv) => inv.id} loading={invoices.isPending} error={invoices.error} onRetry={() => invoices.refetch()} emptyMessage="No invoices match these filters." />

      {data ? (
        <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} totalItems={data.total} pageSize={20} />
      ) : null}
    </div>
  );
}
