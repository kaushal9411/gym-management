'use client';

import * as React from 'react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/features/auth/components/form-alert';
import { LoadingButton } from '@/components/ui/loading-button';
import { cn } from '@/lib/utils';
import { toBillingError, useCheckout, useValidateCoupon, useVerifyCheckout } from '../hooks/use-billing';
import type { BillingCycle, SubscriptionPlan } from '../types';

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description?: string;
  theme?: { color?: string };
  handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayCheckoutInstance {
  open: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
  }
}

let razorpayScriptPromise: Promise<boolean> | null = null;

/** Lazily injects Razorpay's Checkout modal script — only needed once a real payment is actually due, not on every page load. */
function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (razorpayScriptPromise) return razorpayScriptPromise;
  razorpayScriptPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
  return razorpayScriptPromise;
}

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

/**
 * Choose plan → apply coupon → tax (computed server-side) → a real Razorpay
 * Order → Razorpay's own Checkout modal (opened in-page via `checkout.js`,
 * never a card/UPI field this app renders itself) → the modal's signed
 * success callback is verified server-side (HMAC of order+payment ids)
 * before the plan actually activates. A free/fully-discounted result
 * activates immediately with no modal at all.
 */
export function CheckoutDialog({ open, onOpenChange, targetPlan, currentSortOrder, onSuccess }: CheckoutDialogProps) {
  const [billingCycle, setBillingCycle] = React.useState<BillingCycle>('MONTHLY');
  const [couponCode, setCouponCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [openingModal, setOpeningModal] = React.useState(false);

  const validateCoupon = useValidateCoupon();
  const checkout = useCheckout();
  const verifyCheckout = useVerifyCheckout();

  const basePrice = billingCycle === 'YEARLY' ? targetPlan.priceYearly : targetPlan.priceMonthly;
  const kind = currentSortOrder === null ? 'create' : targetPlan.sortOrder > currentSortOrder ? 'upgrade' : 'downgrade';

  React.useEffect(() => {
    if (!open) {
      setError(null);
      setCouponCode('');
      setOpeningModal(false);
    }
  }, [open]);

  const applyCoupon = () => {
    if (!couponCode.trim()) return;
    validateCoupon.mutate(
      { code: couponCode.trim(), amount: basePrice },
      { onError: (err) => toast.error(toBillingError(err).message) },
    );
  };

  const submit = () => {
    setError(null);
    checkout.mutate(
      { kind, payload: { planSlug: targetPlan.slug, billingCycle, couponCode: couponCode.trim() || undefined } },
      {
        onSuccess: async (result) => {
          if (!result.requiresPayment) {
            toast.success(`${targetPlan.name} plan is now active`);
            onOpenChange(false);
            onSuccess();
            return;
          }

          setOpeningModal(true);
          const loaded = await loadRazorpayScript();
          setOpeningModal(false);
          if (!loaded || !window.Razorpay) {
            setError('Could not load the Razorpay checkout. Please try again.');
            return;
          }

          const razorpay = new window.Razorpay({
            key: result.keyId,
            amount: result.amount,
            currency: result.currency,
            order_id: result.orderId,
            name: 'FitCloud',
            description: `${targetPlan.name} plan (${billingCycle.toLowerCase()})`,
            theme: { color: '#16a34a' },
            handler: (response) => {
              verifyCheckout.mutate(
                {
                  paymentId: result.paymentId,
                  payload: {
                    razorpayOrderId: response.razorpay_order_id,
                    razorpayPaymentId: response.razorpay_payment_id,
                    razorpaySignature: response.razorpay_signature,
                  },
                },
                {
                  onSuccess: (verifyResult) => {
                    if (verifyResult.status === 'SUCCEEDED') {
                      toast.success(`${targetPlan.name} plan is now active`);
                      onOpenChange(false);
                      onSuccess();
                    } else {
                      setError('Payment verification failed. If you were charged, contact support — your plan has not changed.');
                    }
                  },
                  onError: (err) => setError(toBillingError(err).message),
                },
              );
            },
            modal: {
              ondismiss: () => {
                setError('Checkout closed before payment completed. Your plan has not changed — try again when ready.');
              },
            },
          });
          razorpay.open();
        },
        onError: (err) => setError(toBillingError(err).message),
      },
    );
  };

  const discounted = validateCoupon.data?.finalAmount;
  const submitting = checkout.isPending || openingModal || verifyCheckout.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Switch to {targetPlan.name}</DialogTitle>
          <DialogDescription>Tax is calculated automatically from your billing address.</DialogDescription>
        </DialogHeader>

        <FormAlert variant="error" message={error} />

        <div className="space-y-4">
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
              <span>
                {targetPlan.name} ({billingCycle.toLowerCase()})
              </span>
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
              <Button
                type="button"
                variant="outline"
                onClick={applyCoupon}
                disabled={validateCoupon.isPending || !couponCode.trim()}
              >
                {validateCoupon.isPending ? 'Checking…' : 'Apply'}
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {discounted === 0
              ? 'This coupon covers the full amount — no payment needed.'
              : "You'll pay in Razorpay's own secure checkout popup — this app never sees your card or UPI details."}
          </p>

          <LoadingButton
            type="button"
            className="w-full"
            onClick={submit}
            loading={submitting}
            loadingText={openingModal ? 'Opening checkout…' : verifyCheckout.isPending ? 'Confirming…' : 'Starting checkout…'}
          >
            Confirm {kind === 'upgrade' ? 'upgrade' : kind === 'downgrade' ? 'downgrade' : 'plan'}
          </LoadingButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
