'use client';

import * as React from 'react';
import { CircleDollarSign, Download, FileText, Hash, Receipt } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FormAlert } from '@/features/auth/components/form-alert';
import { BillingHero } from '@/features/billing/components/billing-hero';
import { EmptyBlock, formatDate, formatMoney, StatusPill, SummaryCard } from '@/features/billing/components/billing-ui';
import { toBillingError, useInvoices } from '@/features/billing/hooks/use-billing';
import { billingService } from '@/features/billing/services/billing.service';
import { Chip, PanelCard } from '@/features/finance/components/payments/payments-ui';

const FILTERS = ['ALL', 'PAID', 'OPEN', 'DRAFT', 'VOID', 'UNCOLLECTIBLE'] as const;
type Filter = (typeof FILTERS)[number];

export default function InvoicesPage() {
  const { data: invoices, isLoading, isError, error } = useInvoices();
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<Filter>('ALL');

  const handleDownload = async (invoiceId: string, invoiceNumber: string) => {
    setDownloadingId(invoiceId);
    try {
      const url = await billingService.downloadInvoiceUrl(invoiceId);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoiceNumber}.html`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(toBillingError(err).message);
    } finally {
      setDownloadingId(null);
    }
  };

  const list = invoices ?? [];
  const currency = list[0]?.currency ?? 'USD';
  const billable = list.filter((i) => i.currency === currency && i.status !== 'VOID' && i.status !== 'DRAFT');
  const totalInvoiced = billable.reduce((s, i) => s + i.total, 0);
  // Outstanding = OPEN (issued, unpaid) invoices.
  const open = billable.filter((i) => i.status === 'OPEN');
  const outstanding = open.reduce((s, i) => s + i.total, 0);

  const counts: Record<string, number> = { ALL: list.length };
  for (const i of list) counts[i.status] = (counts[i.status] ?? 0) + 1;
  const visible = list.filter((i) => filter === 'ALL' || i.status === filter);

  return (
    <div className="space-y-6">
      <BillingHero
        subtitle="Download invoices for your FitCloud subscription."
        statsLoading={isLoading}
        stats={[
          { value: list.length, label: 'Invoices' },
          { value: formatMoney(outstanding, currency), label: 'Outstanding' },
        ]}
      />

      {isError ? (
        <FormAlert variant="error" message={toBillingError(error).message} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard loading={isLoading} icon={<Hash />} label="Invoices" value={list.length} hint="All statuses" color="var(--chart-2)" />
            <SummaryCard loading={isLoading} icon={<CircleDollarSign />} label="Total invoiced" value={formatMoney(totalInvoiced, currency)} hint="Excludes draft & void" color="var(--chart-1)" />
            <SummaryCard loading={isLoading} icon={<FileText />} label="Outstanding" value={formatMoney(outstanding, currency)} hint={`${open.length} open`} color="var(--chart-3)" />
          </div>

          <PanelCard
            title="Invoices"
            action={
              list.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {FILTERS.filter((f) => f === 'ALL' || counts[f]).map((f) => (
                    <Chip key={f} small active={filter === f} onClick={() => setFilter(f)}>
                      {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()} · {counts[f] ?? 0}
                    </Chip>
                  ))}
                </div>
              ) : undefined
            }
          >
            {isLoading ? (
              <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            ) : list.length === 0 ? (
              <EmptyBlock icon={<Receipt />} title="No invoices yet">They appear here after your first charge.</EmptyBlock>
            ) : visible.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No invoices match this filter.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <th className="py-2.5 pr-3">Invoice</th>
                      <th className="py-2.5 pr-3">Date</th>
                      <th className="py-2.5 pr-3">Status</th>
                      <th className="py-2.5 pr-3 text-right">Total</th>
                      <th className="py-2.5 text-right"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((invoice) => (
                      <tr key={invoice.id} className="border-b last:border-0">
                        <td className="py-3 pr-3 font-bold">{invoice.invoiceNumber}</td>
                        <td className="py-3 pr-3 tabular-nums">{formatDate(invoice.createdAt)}</td>
                        <td className="py-3 pr-3"><StatusPill status={invoice.status} /></td>
                        <td className="py-3 pr-3 text-right font-bold tabular-nums">{formatMoney(invoice.total, invoice.currency, 2)}</td>
                        <td className="py-3 text-right">
                          <Button variant="outline" size="sm" onClick={() => handleDownload(invoice.id, invoice.invoiceNumber)} disabled={downloadingId === invoice.id}>
                            <Download className="size-4" />
                            {downloadingId === invoice.id ? 'Downloading…' : 'Download'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PanelCard>
        </>
      )}
    </div>
  );
}
