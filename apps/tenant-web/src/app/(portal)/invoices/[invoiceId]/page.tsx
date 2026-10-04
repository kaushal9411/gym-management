'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Download, Mail, Printer } from 'lucide-react';
import { toast } from 'sonner';

import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { InvoiceStatusBadge } from '@/features/finance/components/finance-badges';
import { InvoiceItemsCard, SettlingPaymentsCard } from '@/features/finance/components/invoices/invoice-items-card';
import { computeInvoiceMath } from '@/features/finance/components/invoices/invoice-math';
import { BilledToCard, CollectionProgressCard, InvoiceTimelineCard, PdfCopyCard } from '@/features/finance/components/invoices/invoice-side-panels';
import { InvoiceSummaryCards } from '@/features/finance/components/invoices/invoice-summary-cards';
import { HeroButton, PaymentsHero } from '@/features/finance/components/payments/payments-hero';
import { fmtDate } from '@/features/finance/components/payments/payments-ui';
import { toFinanceError, useEmailInvoice, useInvoice } from '@/features/finance/hooks/use-finance';
import { financeService } from '@/features/finance/services/finance.service';

export default function InvoiceDetailPage() {
  const params = useParams<{ invoiceId: string }>();
  const { hasPermission } = usePermissions();
  const invoiceId = params.invoiceId;

  const invoice = useInvoice(invoiceId);
  const emailInvoice = useEmailInvoice();
  const canDownload = hasPermission('finance:invoice-download');
  const canRecord = hasPermission('finance:payment-create');

  const [downloading, setDownloading] = React.useState(false);
  const [printing, setPrinting] = React.useState(false);

  if (invoice.isPending) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-52 w-full rounded-[28px]" />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-[20px]" />
          ))}
        </div>
        <div className="flex flex-wrap gap-3.5">
          <Skeleton className="h-96 min-w-0 flex-[2_1_620px] rounded-[20px]" />
          <Skeleton className="h-96 min-w-0 flex-[1_1_320px] rounded-[20px]" />
        </div>
      </div>
    );
  }
  if (invoice.isError || !invoice.data) {
    return <p className="text-sm text-destructive">Couldn&apos;t load this invoice — it may not exist or was removed. Try refreshing.</p>;
  }

  const data = invoice.data;
  const math = computeInvoiceMath(data);

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
    <div className="space-y-5">
      <PaymentsHero
        backHref="/invoices"
        backLabel="Back to invoices"
        eyebrow={`Invoice · issued ${fmtDate(data.invoiceDate, { day: 'numeric', month: 'short', year: 'numeric' })}`}
        title={data.invoiceNumber}
        titleAdornment={<InvoiceStatusBadge status={data.status} onDark className="h-[30px] text-sm" />}
        subtitle={`${data.member.name} (${data.member.memberId}) · ${data.branch.name} · due ${fmtDate(data.dueDate, { day: 'numeric', month: 'short', year: 'numeric' })}`}
        actions={
          canDownload ? (
            <>
              <HeroButton disabled={printing} onClick={() => void handlePrint()}>
                <Printer className="size-4" /> Print
              </HeroButton>
              <HeroButton disabled={emailInvoice.isPending} onClick={handleEmail}>
                <Mail className="size-4" /> {emailInvoice.isPending ? 'Sending…' : 'Email invoice'}
              </HeroButton>
              <HeroButton solid disabled={downloading} onClick={() => void handleDownload()}>
                <Download className="size-4" /> {downloading ? 'Downloading…' : 'Download PDF'}
              </HeroButton>
            </>
          ) : undefined
        }
      />

      <InvoiceSummaryCards invoice={data} math={math} />

      <section className="flex flex-wrap items-start gap-3.5">
        <div className="flex min-w-0 flex-[2_1_620px] flex-col gap-3.5">
          <InvoiceItemsCard invoice={data} math={math} />
          <SettlingPaymentsCard invoice={data} math={math} canRecord={canRecord} />
        </div>
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-3.5">
          <CollectionProgressCard math={math} />
          <InvoiceTimelineCard invoice={data} math={math} />
          <BilledToCard invoice={data} math={math} />
          {canDownload ? <PdfCopyCard invoiceNumber={data.invoiceNumber} downloading={downloading} printing={printing} onDownload={() => void handleDownload()} onPrint={() => void handlePrint()} /> : null}
        </div>
      </section>
    </div>
  );
}
