'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormAlert } from '@/features/auth/components/form-alert';
import { LoadingButton } from '@/features/auth/components/loading-button';
import { PAYMENT_PROVIDERS } from '@/features/onboarding/constants';
import { cn } from '@/lib/utils';
import { toBillingError, useCheckout, useValidateCoupon } from '../hooks/use-billing';
import type { BillingCycle, PaymentProvider, SubscriptionPlan } from '../types';

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPlan: SubscriptionPlan;
  currentSortOrder: number | null;
  onSuccess: () => void;
}

/** Choose plan → apply coupon → tax (computed server-side) → gateway → invoice → activate, in one modal. */
export function CheckoutDialog({ open, onOpenChange, targetPlan, currentSortOrder, onSuccess }: CheckoutDialogProps) {
  const [billingCycle, setBillingCycle] = React.useState<BillingCycle>('MONTHLY');
  const [couponCode, setCouponCode] = React.useState('');
  const [provider, setProvider] = React.useState<PaymentProvider>('stripe');
  const [cardNumber, setCardNumber] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const validateCoupon = useValidateCoupon();
  const checkout = useCheckout();

  const basePrice = billingCycle === 'YEARLY' ? targetPlan.priceYearly : targetPlan.priceMonthly;
  const kind = currentSortOrder === null ? 'create' : targetPlan.sortOrder > currentSortOrder ? 'upgrade' : 'downgrade';

  const applyCoupon = () => {
    if (!couponCode.trim()) return;
    validateCoupon.mutate(
      { code: couponCode.trim(), amount: basePrice },
      { onError: (err) => toast.error(toBillingError(err).message) },
    );
  };

  const submit = () => {
    if (targetPlan.trialDays === 0 && cardNumber.replace(/\s/g, '').length < 8) {
      setError('Enter a valid card/account number.');
      return;
    }
    setError(null);
    checkout.mutate(
      {
        kind,
        payload: {
          planSlug: targetPlan.slug,
          billingCycle,
          couponCode: couponCode.trim() || undefined,
          provider,
          paymentToken: `tok_${provider}_${Date.now()}`,
        },
      },
      {
        onSuccess: () => {
          toast.success(`${targetPlan.name} plan is now active`);
          onOpenChange(false);
          onSuccess();
        },
        onError: (err) => setError(toBillingError(err).message),
      },
    );
  };

  const discounted = validateCoupon.data?.finalAmount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Switch to {targetPlan.name}</DialogTitle>
          <DialogDescription>Tax is calculated automatically from your billing address.</DialogDescription>
        </DialogHeader>

        <FormAlert variant="error" message={error} />

        <div className="flex justify-center">
          <div className="inline-flex rounded-lg border border-input bg-muted p-1">
            {(['MONTHLY', 'YEARLY'] as const).map((cycle) => (
              <button
                key={cycle}
                type="button"
                onClick={() => setBillingCycle(cycle)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  billingCycle === cycle ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {cycle === 'MONTHLY' ? 'Monthly' : 'Yearly'}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-input bg-muted/40 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span>{targetPlan.name} ({billingCycle.toLowerCase()})</span>
            <span className={cn('font-semibold', discounted !== undefined && 'text-muted-foreground line-through')}>
              {formatMoney(basePrice, targetPlan.currency)}
            </span>
          </div>
          {discounted !== undefined ? (
            <div className="mt-1 flex items-center justify-between text-success">
              <span>After coupon</span>
              <span className="font-semibold">{formatMoney(discounted, targetPlan.currency)}</span>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="couponCode">Coupon code (optional)</Label>
          <div className="flex gap-2">
            <Input id="couponCode" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="SAVE20" />
            <Button type="button" variant="outline" onClick={applyCoupon} disabled={validateCoupon.isPending || !couponCode.trim()}>
              {validateCoupon.isPending ? 'Checking…' : 'Apply'}
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          {PAYMENT_PROVIDERS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setProvider(p.value)}
              className={cn(
                'flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors',
                provider === p.value ? 'border-primary bg-primary/5' : 'border-input text-muted-foreground hover:bg-accent',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="cardNumber">Card / account number</Label>
          <Input id="cardNumber" placeholder="4242 4242 4242 4242" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
          <p className="text-xs text-muted-foreground">Sandbox mode — no real payment is processed.</p>
        </div>

        <LoadingButton type="button" className="w-full" onClick={submit} loading={checkout.isPending} loadingText="Processing…">
          Confirm {kind === 'upgrade' ? 'upgrade' : kind === 'downgrade' ? 'downgrade' : 'plan'}
        </LoadingButton>
      </DialogContent>
    </Dialog>
  );
}
