'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown, Copy, ExternalLink, FileText, MoreHorizontal, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Checkbox } from '@/components/ui/checkbox';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Pagination } from '@/components/ui/pagination';
import { formatMoney } from '@/features/members/components/detail/detail-ui';
import { useCurrencySymbol } from '@/lib/currency';
import type { ListPaymentsParams, MemberPaymentListItem, PaymentListResponse } from '../../types';
import { PaymentMethodBadge, PaymentStatusBadge } from '../finance-badges';
import { MemberAvatar, fmtDateTime, num } from './payments-ui';

type SortableColumn = NonNullable<ListPaymentsParams['sortBy']>;

interface PaymentsTableProps {
  data: PaymentListResponse | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  page: number;
  onPage: (p: number) => void;
  pageSize: number;
  sortBy: SortableColumn;
  sortDir: 'asc' | 'desc';
  onSort: (c: SortableColumn) => void;
  canVerify: boolean;
  onVerify: (id: string) => void;
}

// Statuses whose final amount counts as money received (used only for the footer's page total).
const COLLECTED = new Set(['SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED']);

export function PaymentsTable({ data, loading, error, onRetry, page, onPage, pageSize, sortBy, sortDir, onSort, canVerify, onVerify }: PaymentsTableProps) {
  const sym = useCurrencySymbol();
  const items = data?.items ?? [];
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  // Selection is per-page: drop it whenever the visible rows change.
  React.useEffect(() => {
    setSelected(new Set());
  }, [data]);

  const allSelected = items.length > 0 && items.every((p) => selected.has(p.id));
  const toggleAll = (checked: boolean) => setSelected(checked ? new Set(items.map((p) => p.id)) : new Set());
  const toggleOne = (id: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const sortIcon = (c: SortableColumn) => (sortBy !== c ? <ArrowUpDown className="size-3.5 opacity-60" /> : sortDir === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />);
  const sortable = (label: string, c: SortableColumn, right?: boolean) => (
    <button type="button" className={`flex items-center gap-1 font-medium hover:text-foreground ${right ? 'ml-auto' : ''}`} onClick={() => onSort(c)}>
      {label} {sortIcon(c)}
    </button>
  );

  const columns: DataTableColumn<MemberPaymentListItem>[] = [
    {
      key: 'select',
      header: <Checkbox aria-label="Select all rows" checked={allSelected} onCheckedChange={(v) => toggleAll(v === true)} />,
      className: 'w-11',
      render: (p) => <Checkbox aria-label={`Select ${p.paymentNumber}`} checked={selected.has(p.id)} onCheckedChange={(v) => toggleOne(p.id, v === true)} />,
    },
    {
      key: 'paymentNumber',
      header: 'Payment',
      render: (p) => (
        <Link href={`/payments/${p.id}`} className="block hover:underline">
          <b className="tabular-nums text-primary">{p.paymentNumber}</b>
          {/* "Invoice linked" / "Razorpay link" are derived from invoiceId / method — the actual invoice number is not on the list item. */}
          {p.method === 'ONLINE_GATEWAY' || p.invoiceId ? <span className="block text-xs text-muted-foreground">{p.method === 'ONLINE_GATEWAY' ? 'Razorpay link' : 'Invoice linked'}</span> : null}
        </Link>
      ),
    },
    {
      key: 'member',
      header: 'Member',
      render: (p) => (
        <span className="inline-flex items-center gap-2.5">
          <MemberAvatar name={p.member.name} seed={p.member.id} />
          <span>
            <b className="block font-semibold">{p.member.name}</b>
            <span className="block text-xs text-muted-foreground">{p.member.memberId}</span>
          </span>
        </span>
      ),
    },
    { key: 'plan', header: 'Plan', render: (p) => p.membership?.planName ?? <span className="text-muted-foreground">—</span> },
    { key: 'branch', header: 'Branch', render: (p) => p.branch.name },
    { key: 'method', header: 'Method', render: (p) => <PaymentMethodBadge method={p.method} /> },
    { key: 'finalAmount', header: sortable('Amount', 'finalAmount', true), className: 'text-right', render: (p) => <span className="font-extrabold tabular-nums">{formatMoney(sym, p.finalAmount)}</span> },
    {
      key: 'refunded',
      header: 'Refunded',
      className: 'text-right',
      render: (p) => (num(p.totalRefunded) > 0 ? <span className="font-bold tabular-nums text-destructive">{formatMoney(sym, p.totalRefunded)}</span> : <span className="text-muted-foreground">—</span>),
    },
    { key: 'paymentDate', header: sortable('Date', 'paymentDate'), render: (p) => <span className="whitespace-nowrap">{fmtDateTime(p.paymentDate)}</span> },
    { key: 'status', header: 'Status', render: (p) => <PaymentStatusBadge status={p.status} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'w-10 text-right',
      render: (p) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={`Actions for ${p.paymentNumber}`} className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/payments/${p.id}`}>
                <ExternalLink className="size-4" /> View details
              </Link>
            </DropdownMenuItem>
            {p.invoiceId ? (
              <DropdownMenuItem asChild>
                <Link href={`/invoices/${p.invoiceId}`}>
                  <FileText className="size-4" /> View invoice
                </Link>
              </DropdownMenuItem>
            ) : null}
            {canVerify && p.status === 'PENDING' ? (
              <DropdownMenuItem onSelect={() => onVerify(p.id)}>
                <RefreshCw className="size-4" /> Verify status
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              onSelect={() => {
                void navigator.clipboard.writeText(p.paymentNumber).then(() => toast.success('Payment number copied.'));
              }}
            >
              <Copy className="size-4" /> Copy number
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const pageTotal = items.filter((p) => COLLECTED.has(p.status)).reduce((s, p) => s + num(p.finalAmount), 0);

  return (
    <section className="overflow-hidden rounded-[20px] border bg-card shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-5 py-[18px]">
        <h2 className="text-[17px] font-extrabold">
          All payments{' '}
          {data ? (
            <span className="text-sm font-semibold text-muted-foreground">
              · {data.total} result{data.total === 1 ? '' : 's'}
              {data.summary ? ` · ${formatMoney(sym, data.summary.collectedTotal)} collected · ${formatMoney(sym, data.summary.refundedTotal)} refunded` : ''}
            </span>
          ) : null}
        </h2>
        {selected.size > 0 ? (
          <span className="flex items-center gap-2 text-sm font-semibold">
            {selected.size} selected
            <button type="button" className="text-primary hover:underline" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </span>
        ) : null}
      </div>
      <div className="px-3 pb-3 sm:px-4">
        <DataTable columns={columns} rows={items} rowKey={(p) => p.id} loading={loading} error={error} onRetry={onRetry} emptyMessage="No payments match these filters." />
      </div>
      {data && data.total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 text-[13px] font-semibold text-muted-foreground">
          <span>
            Page total <b className="text-foreground">{formatMoney(sym, pageTotal)}</b>
          </span>
          <Pagination page={page} totalPages={data.totalPages} onPageChange={onPage} totalItems={data.total} pageSize={pageSize} />
        </div>
      ) : null}
    </section>
  );
}
