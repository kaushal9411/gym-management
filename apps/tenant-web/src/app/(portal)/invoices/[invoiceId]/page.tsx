'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, Mail, Printer } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { InvoiceStatusBadge, PaymentStatusBadge } from '@/features/finance/components/finance-badges';
import { toFinanceError, useEmailInvoice, useInvoice } from '@/features/finance/hooks/use-finance';
import { financeService } from '@/features/finance/services/finance.service';

export default function InvoiceDetailPage() {
  const params = useParams<{ invoiceId: string }>();
  const { hasPermission } = usePermissions();
  const invoiceId = params.invoiceId;

  const invoice = useInvoice(invoiceId);
  const emailInvoice = useEmailInvoice();
  const canDownload = hasPermission('finance:invoice-download');

  const [downloading, setDownloading] = React.useState(false);
  const [printing, setPrinting] = React.useState(false);

  if (invoice.isPending) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (invoice.isError || !invoice.data) {
    return <p className="text-sm text-destructive">Couldn&apos;t load this invoice — try refreshing.</p>;
  }

  const data = invoice.data;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await financeService.downloadInvoicePdfUrl(invoiceId, data.invoiceNumber);
    } catch (err) {
      toast.error(toFinanceError(err).message);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await financeService.openInvoicePdf(invoiceId);
    } catch (err) {
      toast.error(toFinanceError(err).message);
    } finally {
      setPrinting(false);
    }
  };

  const handleEmail = () => {
    emailInvoice.mutate(
      { id: invoiceId },
      {
        onSuccess: () => toast.success('Invoice emailed.'),
        onError: (err) => toast.error(toFinanceError(err).message),
      },
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/invoices">
          <ArrowLeft className="size-4" /> Back to invoices
        </Link>
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{data.invoiceNumber}</h1>
          <p className="text-muted-foreground">
            {data.member.name} ({data.member.memberId}) · {data.branch.name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <InvoiceStatusBadge status={data.status} />
          {canDownload ? (
            <>
              <Button variant="outline" size="sm" disabled={printing} onClick={() => void handlePrint()}>
                <Printer className="size-4" /> Print
              </Button>
              <Button variant="outline" size="sm" disabled={downloading} onClick={() => void handleDownload()}>
                <Download className="size-4" /> {downloading ? 'Downloading…' : 'Download PDF'}
              </Button>
              <Button size="sm" disabled={emailInvoice.isPending} onClick={handleEmail}>
                <Mail className="size-4" /> {emailInvoice.isPending ? 'Sending…' : 'Email'}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-muted-foreground">Invoice date</p>
              <p className="font-medium">{new Date(data.invoiceDate).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Due date</p>
              <p className="font-medium">{new Date(data.dueDate).toLocaleDateString()}</p>
            </div>
          </div>

          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-1.5 font-medium">Description</th>
                <th className="py-1.5 text-right font-medium">Qty</th>
                <th className="py-1.5 text-right font-medium">Unit price</th>
                <th className="py-1.5 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-1.5">{item.description}</td>
                  <td className="py-1.5 text-right">{item.quantity}</td>
                  <td className="py-1.5 text-right">${item.unitPrice}</td>
                  <td className="py-1.5 text-right">${item.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-col items-end gap-1 text-sm">
            <p>Subtotal: ${data.subtotal}</p>
            <p>Tax: ${data.taxAmount}</p>
            <p>Discount: -${data.discountAmount}</p>
            <p className="text-base font-semibold">Total: ${data.totalAmount}</p>
          </div>

          {data.notes ? (
            <div>
              <p className="text-muted-foreground">Notes</p>
              <p>{data.notes}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {data.payments.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Settling payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.payments.map((p) => (
              <Link key={p.id} href={`/payments/${p.id}`} className="flex items-center justify-between border-b pb-2 text-sm last:border-0 last:pb-0 hover:underline">
                <span>
                  {p.paymentNumber} — ${p.finalAmount}
                  <span className="block text-xs text-muted-foreground">{new Date(p.paymentDate).toLocaleDateString()}</span>
                </span>
                <PaymentStatusBadge status={p.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
