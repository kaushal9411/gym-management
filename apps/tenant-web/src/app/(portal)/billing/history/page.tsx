'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FormAlert } from '@/features/auth/components/form-alert';
import { BillingNav } from '@/features/billing/components/billing-nav';
import { toBillingError, usePaymentHistory } from '@/features/billing/hooks/use-billing';

const STATUS_STYLES: Record<string, string> = {
  SUCCEEDED: 'bg-success/10 text-success',
  PENDING: 'bg-warning/15 text-warning-foreground',
  FAILED: 'bg-destructive/10 text-destructive',
  REFUNDED: 'bg-muted text-muted-foreground',
  PARTIALLY_REFUNDED: 'bg-muted text-muted-foreground',
};

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export default function PaymentHistoryPage() {
  const { data: payments, isLoading, isError, error } = usePaymentHistory();

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
      ) : !payments || payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payment attempts yet.</p>
      ) : (
        <div className="space-y-2">
          {payments.map((payment) => (
            <Card key={payment.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium capitalize">{payment.provider}</p>
                  <p className="text-xs text-muted-foreground">{new Date(payment.createdAt).toLocaleString()}</p>
                  {payment.failureReason ? <p className="text-xs text-destructive">{payment.failureReason}</p> : null}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[payment.status] ?? 'bg-muted'}`}>
                    {payment.status}
                  </span>
                  <span className="font-semibold">{formatMoney(payment.amount, payment.currency)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
