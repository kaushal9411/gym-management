'use client';

import * as React from 'react';
import Link from 'next/link';
import { FileDown, Loader2, SearchX } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toBillingError } from '@/features/billing/hooks/use-billing';
import { Avatar, Chip } from '@/features/dashboard/components/ui';
import { fmtInt } from '@/features/dashboard/components/format';
import { TableScroll, fmtDate, money, tdClass, thClass } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { useInvoicePdfAny, type InvoiceRow, type InvoiceSummary } from '../api/insights';
import { LINK, StatusChip, daysOverdue } from './pay-kit';

export function InvoicesTable({ rows, loading, now, onReset }: { rows: InvoiceRow[]; loading: boolean; now: number | null; onReset: () => void }) {
  const pdf = useInvoicePdfAny();
  const [busy, setBusy] = React.useState<string | null>(null);
  if (loading) return <div className="space-y-2 p-4" aria-busy="true" aria-label="Loading invoices">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div>;
  if (rows.length === 0) {
    return (
      <div className="grid place-items-center gap-2 px-4 py-14 text-center">
        <SearchX className="size-8 text-muted-foreground" aria-hidden />
        <p className="font-semibold">No invoices match these filters</p>
        <Button size="sm" variant="outline" onClick={onReset}>Reset filters</Button>
      </div>
    );
  }
  const download = (i: InvoiceRow) => {
    setBusy(i.id);
    pdf.mutate({ tenantId: i.tenant.id, invoiceId: i.id, invoiceNumber: i.invoiceNumber }, { onError: (e) => toast.error(toBillingError(e).message), onSettled: () => setBusy(null) });
  };
  return (
    <TableScroll label="Invoices">
      <table className="w-full min-w-[960px] border-collapse">
        <thead>
          <tr>
            <th scope="col" className={thClass}>Invoice</th><th scope="col" className={thClass}>Tenant</th><th scope="col" className={thClass}>Issued</th>
            <th scope="col" className={thClass}>Due</th><th scope="col" className={`${thClass} text-right`}>Total</th><th scope="col" className={thClass}>Status</th>
            <th scope="col" className={thClass}>Coupon</th><th scope="col" className={`${thClass} text-right`}>PDF</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => {
            const late = i.status === 'OPEN' ? daysOverdue(i.dueDate, now) : 0;
            return (
              <tr key={i.id} className="transition-colors hover:bg-muted/50">
                <td className={tdClass}><Link href={`/payments/invoices/${i.id}`} className={`${LINK} font-mono text-xs`}>{i.invoiceNumber}</Link></td>
                <td className={tdClass}>
                  <Link href={`/tenants/${i.tenant.id}`} className={`${LINK} inline-flex items-center gap-2`}><Avatar name={i.tenant.name} seed={i.tenant.id} /><span className="max-w-[160px] truncate">{i.tenant.name}</span></Link>
                </td>
                <td className={`${tdClass} whitespace-nowrap`}>{fmtDate(i.createdAt)}</td>
                <td className={`${tdClass} whitespace-nowrap`}>
                  {late > 0 ? <span className="font-semibold text-red-700 dark:text-red-400">{fmtDate(i.dueDate)}<span className="block text-xs font-medium">overdue {late} day{late === 1 ? '' : 's'}</span></span> : fmtDate(i.dueDate)}
                </td>
                <td className={`${tdClass} whitespace-nowrap text-right font-semibold tabular-nums`}>{money(i.total, i.currency)}</td>
                <td className={tdClass}><StatusChip status={i.status} /></td>
                <td className={tdClass}>{i.couponCode ? <Chip tone="violet">{i.couponCode}</Chip> : <span className="text-muted-foreground">—</span>}</td>
                <td className={`${tdClass} text-right`}>
                  <Button size="sm" variant="outline" disabled={busy !== null} aria-label={`Download PDF for ${i.invoiceNumber}`} onClick={() => download(i)}>
                    {busy === i.id ? <Loader2 className="animate-spin" /> : <FileDown />}PDF
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableScroll>
  );
}

export function InvoicesSummaryBar({ s }: { s: InvoiceSummary }) {
  const cur = s.currency ?? 'INR';
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t bg-muted/30 px-4 py-2.5 text-[13px]">
      <span className="text-muted-foreground">{fmtInt(s.count)} matching</span>
      <span>Total <b className="tabular-nums">{money(s.total, cur)}</b></span>
      <span>Outstanding <b className="tabular-nums text-amber-800 dark:text-amber-300">{money(s.outstanding, cur)}</b></span>
      {s.mixedCurrency ? <Chip tone="amber">Mixed currencies: totals are not converted</Chip> : null}
    </div>
  );
}
