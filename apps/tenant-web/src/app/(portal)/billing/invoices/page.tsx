'use client';

import * as React from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FormAlert } from '@/features/auth/components/form-alert';
import { BillingNav } from '@/features/billing/components/billing-nav';
import { toBillingError, useInvoices } from '@/features/billing/hooks/use-billing';
import { billingService } from '@/features/billing/services/billing.service';

const STATUS_STYLES: Record<string, string> = {
  PAID: 'bg-success/10 text-success',
  OPEN: 'bg-warning/15 text-warning-foreground',
  DRAFT: 'bg-muted text-muted-foreground',
  VOID: 'bg-muted text-muted-foreground',
  UNCOLLECTIBLE: 'bg-destructive/10 text-destructive',
};

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export default function InvoicesPage() {
  const { data: invoices, isLoading, isError, error } = useInvoices();
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing & Subscription</h1>
        <p className="text-muted-foreground">Manage your FitCloud plan, payment, and invoices.</p>
      </div>

      <BillingNav />

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : isError ? (
        <FormAlert variant="error" message={toBillingError(error).message} />
      ) : !invoices || invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No invoices yet — they appear here after your first charge.</p>
      ) : (
        <div className="space-y-2">
          {invoices.map((invoice) => (
            <Card key={invoice.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{invoice.invoiceNumber}</p>
                  <p className="text-xs text-muted-foreground">{new Date(invoice.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[invoice.status] ?? 'bg-muted'}`}>
                    {invoice.status}
                  </span>
                  <span className="font-semibold">{formatMoney(invoice.total, invoice.currency)}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(invoice.id, invoice.invoiceNumber)}
                    disabled={downloadingId === invoice.id}
                  >
                    <Download className="size-4" />
                    {downloadingId === invoice.id ? 'Downloading…' : 'Download'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
