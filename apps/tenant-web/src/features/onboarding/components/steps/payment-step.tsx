'use client';

import * as React from 'react';
import { ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { FormAlert } from '@/features/auth/components/form-alert';
import { LoadingButton } from '@/features/auth/components/loading-button';
import { PAYMENT_PROVIDERS } from '../../constants';
import { toOnboardingError, usePayForPlan } from '../../hooks/use-onboarding';
import type { PaymentProvider } from '../../types';
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
 * tenant-provisioning.service.ts's `requiresPayment` check). Card fields
 * here are structural only: the gateway is a sandboxed stub
 * (payment-gateway.service.ts), so nothing real is ever charged.
 */
export function PaymentStep() {
  const { state, dispatch } = useOnboardingWizard();
  const pay = usePayForPlan();
  const [provider, setProvider] = React.useState<PaymentProvider>('stripe');
  const [cardNumber, setCardNumber] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

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

  const submitPayment = () => {
    if (cardNumber.replace(/\s/g, '').length < 8) {
      setError('Enter a valid card number.');
      return;
    }
    setError(null);
    pay.mutate(
      { sessionId, provider, paymentToken: `tok_${provider}_${Date.now()}` },
      {
        onSuccess: () => {
          toast.success('Payment successful');
          dispatch({ type: 'PAYMENT_DONE' });
        },
        onError: (err) => setError(toOnboardingError(err).message),
      },
    );
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-input bg-muted/40 p-4">
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
          <LoadingButton type="button" className="w-full" onClick={startTrial}>
            <Sparkles aria-hidden />
            Start my {plan.trialDays}-day free trial
          </LoadingButton>
          <p className="text-center text-xs text-muted-foreground">
            We&apos;ll ask for payment details only when your trial ends.
          </p>
        </div>
      ) : null}

      <div className={cn('space-y-4', trialEligible && 'border-t border-border pt-5')}>
        {trialEligible ? (
          <p className="text-center text-xs text-muted-foreground">Prefer to pay now instead?</p>
        ) : null}

        <div className="flex gap-2">
          {PAYMENT_PROVIDERS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setProvider(p.value)}
              className={cn(
                'flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors',
                provider === p.value ? 'border-primary bg-primary/5 text-foreground' : 'border-input text-muted-foreground hover:bg-accent',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="cardNumber">Card / account number</Label>
          <Input
            id="cardNumber"
            placeholder="4242 4242 4242 4242"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            disabled={pay.isPending}
          />
          <p className="text-xs text-muted-foreground">Sandbox mode — no real payment is processed.</p>
        </div>

        <LoadingButton
          type="button"
          variant={trialEligible ? 'outline' : 'default'}
          className="w-full"
          onClick={submitPayment}
          loading={pay.isPending}
          loadingText="Processing payment…"
        >
          <ShieldCheck aria-hidden />
          Pay {formatMoney(price, plan.currency)}
        </LoadingButton>
      </div>
    </div>
  );
}
