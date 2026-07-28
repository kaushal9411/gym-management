'use client';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import * as React from 'react';
import { Download, MoreHorizontal, Plus, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { SearchBar } from '@/components/ui/search-bar';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useCurrentBranch } from '@/features/branch/hooks/use-branches';
import { DEFAULT_INCOME_FORM_STATE, IncomeFormFields, type IncomeFormState } from '@/features/finance/components/income-form-fields';
import { toFinanceError, useCreateIncome, useDeleteIncome, useIncomeList } from '@/features/finance/hooks/use-finance';
import { financeService } from '@/features/finance/services/finance.service';
import type { Income, IncomeCategory, ListIncomeParams } from '@/features/finance/types';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
);

const CATEGORY_LABELS: Record<IncomeCategory, string> = {
  MEMBERSHIP_FEE: 'Membership Fee',
  PERSONAL_TRAINING: 'Personal Training',
  PRODUCT_SALES: 'Product Sales',
  OTHER: 'Other',
};

export default function IncomePage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('finance:income-manage');
  const { currentBranchId } = useCurrentBranch();

  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [category, setCategory] = React.useState<IncomeCategory | ''>('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState<IncomeFormState>(DEFAULT_INCOME_FORM_STATE);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<Income | null>(null);

  // Header branch switch re-scopes the whole list — back to page 1 like any other filter change.
  React.useEffect(() => {
    setPage(1);
  }, [currentBranchId]);

  const params: ListIncomeParams = {
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    category: category || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    branchId: currentBranchId ?? undefined,
  };
  const income = useIncomeList(params);
  const createIncome = useCreateIncome();
  const deleteIncome = useDeleteIncome();

  const data = income.data;
  const items = data?.items ?? [];

  const openCreate = () => {
    setForm(DEFAULT_INCOME_FORM_STATE);
    setFormError(null);
    setCreateOpen(true);
  };

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.amount || Number(form.amount) <= 0) {
      setFormError('Enter a valid amount.');
      return;
    }
    createIncome.mutate(
      { category: form.category, amount: Number(form.amount), incomeDate: form.incomeDate, description: form.description || undefined },
      {
        onSuccess: () => {
          toast.success('Income recorded.');
          setCreateOpen(false);
        },
        onError: (err) => setFormError(toFinanceError(err).message),
      },
    );
  };

  const runDelete = () => {
    if (!confirmDelete) return;
    deleteIncome.mutate(confirmDelete.id, {
      onSuccess: () => toast.success('Income deleted.'),
      onError: (err) => toast.error(toFinanceError(err).message),
    });
    setConfirmDelete(null);
  };

  const columns: DataTableColumn<Income>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (i) => new Date(i.incomeDate).toLocaleDateString(),
    },
    { key: 'category', header: 'Category', render: (i) => <Badge variant="secondary">{CATEGORY_LABELS[i.category]}</Badge> },
    { key: 'amount', header: 'Amount', render: (i) => `$${i.amount}` },
    { key: 'branch', header: 'Branch', render: (i) => i.branch?.name ?? '—' },
    { key: 'description', header: 'Description', render: (i) => i.description ?? '—' },
    {
      key: 'source',
      header: 'Source',
      render: (i) => (i.sourcePaymentId ? <Badge variant="outline">Auto (payment)</Badge> : 'Manual'),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      render: (i) =>
        canManage && !i.sourcePaymentId ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label="Actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmDelete(i)}>
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
          <h1 className="text-2xl font-semibold tracking-tight">Income</h1>
          <p className="text-muted-foreground">The gym&apos;s revenue ledger — membership fees, training, sales, and other income.</p>
        </div>
        {canManage ? (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" /> Add income
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
            setCategory(e.target.value as IncomeCategory | '');
            setPage(1);
          }}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          <option value="MEMBERSHIP_FEE">Membership Fee</option>
          <option value="PERSONAL_TRAINING">Personal Training</option>
          <option value="PRODUCT_SALES">Product Sales</option>
          <option value="OTHER">Other</option>
        </select>
        <Input type="date" aria-label="From date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
        <Input type="date" aria-label="To date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
        <Button variant="outline" size="sm" onClick={() => void financeService.exportIncomeCsv(params)}>
          <Upload className="size-4" /> CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => void financeService.exportIncomeExcel(params)}>
          <Download className="size-4" /> Excel
        </Button>
      </div>

      <DataTable columns={columns} rows={items} rowKey={(i) => i.id} loading={income.isPending} error={income.error} onRetry={() => income.refetch()} emptyMessage="No income entries match these filters." />

      {data ? (
        <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} totalItems={data.total} pageSize={20} />
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add income</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitForm} className="space-y-4">
            {formError ? (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            ) : null}
            <IncomeFormFields value={form} onChange={setForm} disabled={createIncome.isPending} />
            <Button type="submit" className="w-full" disabled={createIncome.isPending}>
              {createIncome.isPending ? 'Saving…' : 'Add income'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={confirmDelete ? `Delete this income entry?` : ''}
        description="This soft-deletes the entry — it stays in the database for audit history but is hidden from the ledger."
        destructive
        loading={deleteIncome.isPending}
        onConfirm={runDelete}
      />
    </div>
  );
}
