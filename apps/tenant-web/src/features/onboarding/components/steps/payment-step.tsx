'use client';

import * as React from 'react';
import { ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { loadRazorpayScript } from '@/lib/razorpay-checkout';
import { FormAlert } from '@/features/auth/components/form-alert';
import { LoadingButton } from '@/components/ui/loading-button';
import { toOnboardingError, useStartOnboardingCheckout, useVerifyOnboardingCheckout } from '../../hooks/use-onboarding';
import { useOnboardingWizard } from '../../store/onboarding-wizard-context';

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

/**
 * Step 5 — payment. Trial-eligible plans (all seeded plans currently have a
 * 14-day trial) can skip this entirely — the backend only requires a
 * completed payment when `plan.trialDays <= 0` (see
 * tenant-provisioning.service.ts's `requiresPayment` check). Paying now
 * instead opens a real Razorpay Order in Razorpay's own Checkout modal
 * (`checkout.js`, in-page popup) — this app never renders or sees a
 * card/UPI field, same pattern as the tenant self-service plan-upgrade
 * flow's `CheckoutDialog`. The modal's signed success callback is verified
 * server-side (HMAC of order+payment ids) before the session is marked
 * paid; a dismissed/failed modal leaves the session untouched, so retrying
 * or starting the trial instead both still work.
 */
export function PaymentStep() {
  const { state, dispatch } = useOnboardingWizard();
  const startCheckout = useStartOnboardingCheckout();
  const verifyCheckout = useVerifyOnboardingCheckout();
  const [error, setError] = React.useState<string | null>(null);
  const [openingModal, setOpeningModal] = React.useState(false);

  const plan = state.selectedPlan;
  const sessionId = state.sessionId;
  const trialEligible = (plan?.trialDays ?? 0) > 0;
  const price = plan ? (state.billingCycle === 'YEARLY' ? plan.priceYearly : plan.priceMonthly) : 0;

  if (!sessionId || !plan) {
    return <FormAlert variant="error" message="Please choose a plan before continuing." />;
  }

  const startTrial = () => {
    toast.success(`Your ${plan.trialDays}-day free trial starts now`);
    dispatch({ type: 'PAYMENT_DONE' });
  };

  const payNow = () => {
    setError(null);
    startCheckout.mutate(sessionId, {
      onSuccess: async (result) => {
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
          description: `${plan.name} plan (${(state.billingCycle ?? 'MONTHLY').toLowerCase()})`,
          theme: { color: '#ff5a1f' },
          handler: (response) => {
            verifyCheckout.mutate(
              {
                sessionId,
                payload: {
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                },
              },
              {
                onSuccess: (verifyResult) => {
                  if (verifyResult.status === 'SUCCEEDED') {
                    toast.success('Payment successful');
                    dispatch({ type: 'PAYMENT_DONE' });
                  } else {
                    setError('Payment verification failed. If you were charged, contact support — your account has not been activated.');
                  }
                },
                onError: (err) => setError(toOnboardingError(err).message),
              },
            );
          },
          modal: {
            ondismiss: () => {
              setError('Checkout closed before payment completed. You can try again or start the free trial instead.');
            },
          },
        });
        razorpay.open();
      },
      onError: (err) => setError(toOnboardingError(err).message),
    });
  };

  const paying = startCheckout.isPending || openingModal || verifyCheckout.isPending;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-input bg-muted/40 p-4 shadow-xs">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{plan.name} plan</span>
          <span className="font-semibold">
            {formatMoney(price, plan.currency)} / {state.billingCycle === 'YEARLY' ? 'yr' : 'mo'}
          </span>
        </div>
        {trialEligible ? (
          <p className="mt-1 text-xs text-success">No charge for {plan.trialDays} days — cancel anytime during the trial.</p>
        ) : null}
      </div>

      <FormAlert variant="error" message={error} />

      {trialEligible ? (
        <div className="space-y-3">
          <LoadingButton type="button" className="onboarding-cta w-full" onClick={startTrial}>
            <Sparkles aria-hidden />
            Start my {plan.trialDays}-day free trial
          </LoadingButton>
          <p className="text-center text-xs text-muted-foreground">
            We&apos;ll ask for payment details only when your trial ends.
          </p>
        </div>
      ) : null}

      <div className={cn('space-y-3', trialEligible && 'border-t border-border pt-5')}>
        {trialEligible ? (
          <p className="text-center text-xs text-muted-foreground">Prefer to pay now instead?</p>
        ) : null}

        <p className="text-center text-xs text-muted-foreground">
          You&apos;ll pay in Razorpay&apos;s own secure checkout popup — this app never sees your card or UPI details.
        </p>

        <LoadingButton
          type="button"
          variant={trialEligible ? 'outline' : 'default'}
          className={cn('w-full', !trialEligible && 'onboarding-cta')}
          onClick={payNow}
          loading={paying}
          loadingText={openingModal ? 'Opening checkout…' : verifyCheckout.isPending ? 'Confirming…' : 'Starting checkout…'}
        >
          <ShieldCheck aria-hidden />
          Pay {formatMoney(price, plan.currency)}
        </LoadingButton>
      </div>
    </div>
  );
}
