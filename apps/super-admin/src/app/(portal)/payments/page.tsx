'use client';

import * as React from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { Pagination } from '@/components/pagination';
import { useInvoicesAdmin, usePayments } from '@/features/payments/hooks/use-payments';
import type { InvoiceListItem, PaymentListItem } from '@/features/payments/types';

const STATUS_STYLES: Record<string, string> = {
  SUCCEEDED: 'bg-success/10 text-success',
  PAID: 'bg-success/10 text-success',
  PENDING: 'bg-warning/15 text-warning-foreground',
  OPEN: 'bg-warning/15 text-warning-foreground',
  FAILED: 'bg-destructive/10 text-destructive',
};

function formatMoney(amount: string, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(amount));
  } catch {
    return `${currency} ${amount}`;
  }
}

export default function PaymentsPage() {
  const [tab, setTab] = React.useState<'payments' | 'invoices'>('payments');
  const [page, setPage] = React.useState(1);

  const payments = usePayments({ page, limit: 20 });
  const invoices = useInvoicesAdmin({ page, limit: 20 });

  const paymentColumns: DataTableColumn<PaymentListItem>[] = [
    { key: 'tenant', header: 'Tenant', render: (p) => p.tenant.name },
    { key: 'provider', header: 'Gateway', render: (p) => <span className="capitalize">{p.provider.toLowerCase()}</span> },
    { key: 'amount', header: 'Amount', render: (p) => formatMoney(p.amount, p.currency) },
    { key: 'status', header: 'Status', render: (p) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[p.status] ?? 'bg-muted'}`}>{p.status}</span> },
    { key: 'reference', header: 'Reference', render: (p) => p.gatewayReference ?? p.failureReason ?? '—' },
    { key: 'createdAt', header: 'Date', render: (p) => new Date(p.createdAt).toLocaleString() },
  ];

  const invoiceColumns: DataTableColumn<InvoiceListItem>[] = [
    { key: 'invoiceNumber', header: 'Invoice #', render: (i) => <span className="font-mono">{i.invoiceNumber}</span> },
    { key: 'tenant', header: 'Tenant', render: (i) => i.tenant.name },
    { key: 'total', header: 'Total', render: (i) => formatMoney(i.total, i.currency) },
    { key: 'status', header: 'Status', render: (i) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[i.status] ?? 'bg-muted'}`}>{i.status}</span> },
    { key: 'createdAt', header: 'Date', render: (i) => new Date(i.createdAt).toLocaleString() },
  ];

  const activeData = tab === 'payments' ? payments.data : invoices.data;
  const isLoading = tab === 'payments' ? payments.isLoading : invoices.isLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="text-muted-foreground">Payment history and invoices across every tenant.</p>
      </div>

      <div className="flex gap-1 border-b">
        {(['payments', 'invoices'] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setPage(1);
            }}
            className={`border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors ${tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {isLoading || !activeData ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : tab === 'payments' ? (
        <>
          <DataTable columns={paymentColumns} rows={activeData.items as PaymentListItem[]} rowKey={(p) => p.id} emptyMessage="No payments yet." />
          <Pagination page={activeData.page} totalPages={activeData.totalPages} onPageChange={setPage} />
        </>
      ) : (
        <>
          <DataTable columns={invoiceColumns} rows={activeData.items as InvoiceListItem[]} rowKey={(i) => i.id} emptyMessage="No invoices yet." />
          <Pagination page={activeData.page} totalPages={activeData.totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
