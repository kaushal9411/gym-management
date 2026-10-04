'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { FileText, RefreshCw, RotateCcw, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { LoadingButton } from '@/components/ui/loading-button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { METHOD_LABELS, PaymentStatusBadge } from '@/features/finance/components/finance-badges';
import { HeroButton, PaymentsHero } from '@/features/finance/components/payments/payments-hero';
import { DetailsCard, OtherPaymentsCard, RefundSplitCard, SummaryCards, TimelineCard } from '@/features/finance/components/payments/payment-detail-sections';
import { fmtDateTime } from '@/features/finance/components/payments/payments-ui';
import { RefundDialog } from '@/features/finance/components/payments/refund-dialog';
import { toFinanceError, useCancelPayment, usePayment, useVerifyPaymentStatus } from '@/features/finance/hooks/use-finance';

export default function PaymentDetailPage() {
  const params = useParams<{ paymentId: string }>();
  const { hasPermission } = usePermissions();
  const paymentId = params.paymentId;

  const payment = usePayment(paymentId);
  const cancelPayment = useCancelPayment();
  const verifyStatus = useVerifyPaymentStatus();

  const canRefund = hasPermission('finance:payment-refund');
  const canManage = hasPermission('finance:payment-create');

  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [refundOpen, setRefundOpen] = React.useState(false);

  if (payment.isPending) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-52 w-full rounded-[28px]" />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-[20px]" />
          ))}
        </div>
        <Skeleton className="h-80 w-full rounded-[20px]" />
      </div>
    );
  }
  if (payment.isError || !payment.data) {
    return <p className="text-sm text-destructive">Couldn&apos;t load this payment — try refreshing.</p>;
  }

  const data = payment.data;
  const canCancel = data.status !== 'CANCELLED' && data.status !== 'REFUNDED' && data.status !== 'PARTIALLY_REFUNDED';
  const canBeRefunded = data.status === 'SUCCESS' || data.status === 'PARTIALLY_REFUNDED';

  const handleCancel = () => {
    cancelPayment.mutate(paymentId, {
      onSuccess: () => toast.success('Payment cancelled.'),
      onError: (err) => toast.error(toFinanceError(err).message),
    });
    setConfirmCancel(false);
  };

  const handleVerify = () => {
    verifyStatus.mutate(paymentId, {
      onSuccess: (result) => toast.success(`Status verified: ${result.status}`),
      onError: (err) => toast.error(toFinanceError(err).message),
    });
  };

  return (
    <div className="space-y-5">
      <PaymentsHero
        backHref="/payments"
        eyebrow={`Payment · ${fmtDateTime(data.paymentDate)}`}
        title={data.paymentNumber}
        titleAdornment={<PaymentStatusBadge status={data.status} onDark className="h-[30px] text-sm" />}
        subtitle={`${data.member.name}${data.membership ? ` · ${data.membership.planName}` : ''} · ${data.branch.name} · ${METHOD_LABELS[data.method]}`}
        actions={
          <>
            {data.invoiceId ? (
              <HeroButton href={`/invoices/${data.invoiceId}`}>
                <FileText className="size-4" /> View invoice
              </HeroButton>
            ) : null}
            {canRefund && canBeRefunded ? (
              <HeroButton solid danger onClick={() => setRefundOpen(true)}>
                <RotateCcw className="size-4" /> Refund payment
              </HeroButton>
            ) : null}
          </>
        }
      />

      <SummaryCards payment={data} />

      <section className="flex flex-wrap items-start gap-3.5">
        <div className="flex min-w-0 flex-[2_1_620px] flex-col gap-3.5">
          <DetailsCard payment={data} />
          <TimelineCard payment={data} />
        </div>
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-3.5">
          <RefundSplitCard payment={data} />
          <OtherPaymentsCard payment={data} />
          {canManage ? (
            <div className="flex flex-col gap-2.5 rounded-[20px] border bg-card p-5 shadow-xs">
              <LoadingButton variant="outline" className="h-[46px] rounded-xl font-bold" loading={verifyStatus.isPending} loadingText="Verifying…" onClick={handleVerify}>
                <RefreshCw className="size-4" /> Verify gateway status
              </LoadingButton>
              {canCancel ? (
                <Button variant="outline" className="h-[46px] rounded-xl border-destructive/40 font-bold text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmCancel(true)}>
                  <XCircle className="size-4" /> Cancel payment
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <RefundDialog payment={data} open={refundOpen} onOpenChange={setRefundOpen} />

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={`Cancel payment ${data.paymentNumber}?`}
        description="This marks the payment as cancelled. This action can be reversed later if needed."
        destructive
        loading={cancelPayment.isPending}
        onConfirm={handleCancel}
      />
    </div>
  );
}
