'use client';

import * as React from 'react';
import Link from 'next/link';
import { Download, MoreHorizontal, Plus, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { SearchBar } from '@/components/ui/search-bar';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { toFinanceError, useDeleteExpense, useExpenseList } from '@/features/finance/hooks/use-finance';
import { financeService } from '@/features/finance/services/finance.service';
import type { Expense, ExpenseCategory, ListExpensesParams } from '@/features/finance/types';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
);

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  RENT: 'Rent',
  SALARY: 'Salary',
  UTILITIES: 'Utilities',
  EQUIPMENT: 'Equipment',
  MAINTENANCE: 'Maintenance',
  MARKETING: 'Marketing',
  OFFICE_SUPPLIES: 'Office Supplies',
  OTHER: 'Other',
};

export default function ExpensesPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('finance:expense-manage');

  const [search, setSearch] = React.useState('');
  const [category, setCategory] = React.useState<ExpenseCategory | ''>('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [confirmDelete, setConfirmDelete] = React.useState<Expense | null>(null);

  const params: ListExpensesParams = {
    page,
    limit: 20,
    search: search || undefined,
    category: category || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };
  const expenses = useExpenseList(params);
  const deleteExpense = useDeleteExpense();

  const data = expenses.data;
  const items = data?.items ?? [];

  const runDelete = () => {
    if (!confirmDelete) return;
    deleteExpense.mutate(confirmDelete.id, {
      onSuccess: () => toast.success('Expense deleted.'),
      onError: (err) => toast.error(toFinanceError(err).message),
    });
    setConfirmDelete(null);
  };

  const columns: DataTableColumn<Expense>[] = [
    { key: 'date', header: 'Date', render: (e) => new Date(e.expenseDate).toLocaleDateString() },
    { key: 'category', header: 'Category', render: (e) => <Badge variant="secondary">{CATEGORY_LABELS[e.category]}</Badge> },
    { key: 'amount', header: 'Amount', render: (e) => `$${e.amount}` },
    { key: 'branch', header: 'Branch', render: (e) => e.branch?.name ?? '—' },
    { key: 'description', header: 'Description', render: (e) => e.description ?? '—' },
    {
      key: 'receipt',
      header: 'Receipt',
      render: (e) =>
        e.receiptDataUrl ? (
          <a href={e.receiptDataUrl} download={e.receiptFileName ?? 'receipt'} className="text-sm hover:underline">
            {e.receiptFileName ?? 'Download'}
          </a>
        ) : (
          '—'
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      render: (e) =>
        canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label="Actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmDelete(e)}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground">The gym&apos;s expense ledger — rent, salaries, utilities, and more.</p>
        </div>
        {canManage ? (
          <Button size="sm" asChild>
            <Link href="/expenses/new">
              <Plus className="size-4" /> Add expense
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar
          containerClassName="max-w-xs"
          placeholder="Search description…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className={selectClassName}
          value={category}
          onChange={(e) => {
            setCategory(e.target.value as ExpenseCategory | '');
            setPage(1);
          }}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Input type="date" aria-label="From date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
        <Input type="date" aria-label="To date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
        <Button variant="outline" size="sm" onClick={() => void financeService.exportExpensesCsv(params)}>
          <Upload className="size-4" /> CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => void financeService.exportExpensesExcel(params)}>
          <Download className="size-4" /> Excel
        </Button>
      </div>

      <DataTable columns={columns} rows={items} rowKey={(e) => e.id} loading={expenses.isPending} emptyMessage="No expenses match these filters." />

      {data && data.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.page} of {data.totalPages} · {data.total} expenses
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
