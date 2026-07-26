'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { PaymentMethodBadge, PaymentStatusBadge } from '@/features/finance/components/finance-badges';
import { toFinanceError, useCancelPayment, usePayment, useRefundPayment, useVerifyPaymentStatus } from '@/features/finance/hooks/use-finance';

export default function PaymentDetailPage() {
  const params = useParams<{ paymentId: string }>();
  const { hasPermission } = usePermissions();
  const paymentId = params.paymentId;

  const payment = usePayment(paymentId);
  const cancelPayment = useCancelPayment();
  const refundPayment = useRefundPayment();
  const verifyStatus = useVerifyPaymentStatus();

  const canRefund = hasPermission('finance:payment-refund');
  const canManage = hasPermission('finance:payment-create');

  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [refundOpen, setRefundOpen] = React.useState(false);
  const [refundAmount, setRefundAmount] = React.useState('');
  const [refundReason, setRefundReason] = React.useState('');

  if (payment.isPending) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (payment.isError || !payment.data) {
    return <p className="text-sm text-destructive">Couldn&apos;t load this payment — try refreshing.</p>;
  }

  const data = payment.data;
  const remaining = Number(data.finalAmount) - Number(data.totalRefunded);
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

  const handleRefund = (e: React.FormEvent) => {
    e.preventDefault();
    refundPayment.mutate(
      { id: paymentId, payload: { amount: refundAmount ? Number(refundAmount) : undefined, reason: refundReason || undefined } },
      {
        onSuccess: () => {
          toast.success('Refund recorded.');
          setRefundOpen(false);
          setRefundAmount('');
          setRefundReason('');
        },
        onError: (err) => toast.error(toFinanceError(err).message),
      },
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/payments">
          <ArrowLeft className="size-4" /> Back to payments
        </Link>
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{data.paymentNumber}</h1>
          <p className="text-muted-foreground">
            {data.member.name} ({data.member.memberId}) · {data.branch.name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PaymentStatusBadge status={data.status} />
          {canManage ? (
            <Button variant="outline" size="sm" disabled={verifyStatus.isPending} onClick={handleVerify}>
              {verifyStatus.isPending ? 'Verifying…' : 'Verify status'}
            </Button>
          ) : null}
          {canRefund && canBeRefunded ? (
            <Button size="sm" onClick={() => setRefundOpen(true)}>
              Refund
            </Button>
          ) : null}
          {canManage && canCancel ? (
            <Button variant="destructive" size="sm" onClick={() => setConfirmCancel(true)}>
              Cancel
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-muted-foreground">Amount</p>
              <p className="font-medium">${data.amount}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Discount / Tax</p>
              <p className="font-medium">
                -${data.discount} / +${data.tax}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Final amount</p>
              <p className="font-medium">${data.finalAmount}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Method</p>
              <PaymentMethodBadge method={data.method} />
            </div>
            <div>
              <p className="text-muted-foreground">Payment date</p>
              <p className="font-medium">{new Date(data.paymentDate).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Reference</p>
              <p className="font-medium">{data.transactionReference ?? '—'}</p>
            </div>
            {data.membership ? (
              <div>
                <p className="text-muted-foreground">Membership</p>
                <p className="font-medium">{data.membership.planName}</p>
              </div>
            ) : null}
            {data.invoiceId ? (
              <div>
                <p className="text-muted-foreground">Invoice</p>
                <Link href={`/invoices/${data.invoiceId}`} className="font-medium hover:underline">
                  View invoice
                </Link>
              </div>
            ) : null}
            {data.recordedBy ? (
              <div>
                <p className="text-muted-foreground">Recorded by</p>
                <p className="font-medium">{data.recordedBy.name}</p>
              </div>
            ) : null}
          </div>
          {data.notes ? (
            <div>
              <p className="text-muted-foreground">Notes</p>
              <p>{data.notes}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {data.refunds.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Refund history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.refunds.map((r) => (
              <div key={r.id} className="flex items-center justify-between border-b pb-2 text-sm last:border-0 last:pb-0">
                <span>
                  ${r.amount} {r.reason ? `— ${r.reason}` : ''}
                  <span className="block text-xs text-muted-foreground">
                    {new Date(r.refundedAt).toLocaleString()} {r.refundedBy ? `by ${r.refundedBy.name}` : ''}
                  </span>
                </span>
              </div>
            ))}
            <p className="text-sm font-medium">Total refunded: ${data.totalRefunded}</p>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRefund} className="space-y-4">
            <p className="text-sm text-muted-foreground">Remaining refundable balance: ${remaining.toFixed(2)}</p>
            <div className="space-y-2">
              <Label htmlFor="refundAmount">Refund amount (leave blank for full remaining balance)</Label>
              <Input
                id="refundAmount"
                type="number"
                min={0}
                max={remaining}
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="refundReason">Reason</Label>
              <textarea
                id="refundReason"
                className="flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={refundPayment.isPending}>
              {refundPayment.isPending ? 'Processing…' : 'Confirm refund'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

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
