'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { FormAlert } from '@/features/auth/components/form-alert';
import { LoadingButton } from '@/features/auth/components/loading-button';
import { toOnboardingError, usePlans, useSelectPlan } from '../../hooks/use-onboarding';
import type { BillingCycle, SubscriptionPlan } from '../../types';
import { useOnboardingWizard } from '../../store/onboarding-wizard-context';

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

/** Step 3 — choose a subscription plan and billing cycle. */
export function PlanSelectionStep() {
  const { state, dispatch } = useOnboardingWizard();
  const { data: plans, isLoading, isError } = usePlans();
  const selectPlan = useSelectPlan();
  const [billingCycle, setBillingCycle] = React.useState<BillingCycle>(state.billingCycle ?? 'MONTHLY');
  const [error, setError] = React.useState<string | null>(null);

  const sessionId = state.sessionId;

  const choose = (plan: SubscriptionPlan) => {
    if (!sessionId) return;
    setError(null);
    selectPlan.mutate(
      { sessionId, planSlug: plan.slug, billingCycle },
      {
        onSuccess: () => {
          toast.success(`${plan.name} plan selected`);
          dispatch({ type: 'PLAN_SELECTED', plan, billingCycle });
        },
        onError: (err) => setError(toOnboardingError(err).message),
      },
    );
  };

  if (!sessionId) {
    return <FormAlert variant="error" message="Your session has expired. Please start again from the account details step." />;
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
    );
  }

  if (isError || !plans || plans.length === 0) {
    return <FormAlert variant="error" message="Couldn't load plans. Please refresh and try again." />;
  }

  return (
    <div className="space-y-5">
      <FormAlert variant="error" message={error} />

      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border border-input bg-muted p-1">
          {(['MONTHLY', 'YEARLY'] as const).map((cycle) => (
            <button
              key={cycle}
              type="button"
              onClick={() => setBillingCycle(cycle)}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                billingCycle === cycle ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {cycle === 'MONTHLY' ? 'Monthly' : 'Yearly (save ~2 months)'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {plans.map((plan) => {
          const price = billingCycle === 'MONTHLY' ? plan.priceMonthly : plan.priceYearly;
          const isPopular = plan.slug === 'professional';
          const isSelecting = selectPlan.isPending && selectPlan.variables?.planSlug === plan.slug;
          const included = plan.features.filter((f) => f.included);

          return (
            <Card key={plan.slug} className={cn('relative', isPopular && 'border-primary shadow-md')}>
              {isPopular ? (
                <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                  Most popular
                </span>
              ) : null}
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground">{plan.description}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xl font-bold tracking-tight">{formatMoney(price, plan.currency)}</div>
                    <div className="text-xs text-muted-foreground">/{billingCycle === 'MONTHLY' ? 'mo' : 'yr'}</div>
                  </div>
                </div>

                {plan.trialDays > 0 ? (
                  <p className="text-xs font-medium text-success">{plan.trialDays}-day free trial included</p>
                ) : null}

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {included.map((feature) => (
                    <span key={feature.key} className="flex items-center gap-1">
                      <Check className="size-3 shrink-0 text-success" aria-hidden />
                      {feature.label}
                    </span>
                  ))}
                </div>

                <LoadingButton
                  type="button"
                  className="w-full"
                  variant={isPopular ? 'default' : 'outline'}
                  onClick={() => choose(plan)}
                  loading={isSelecting}
                  loadingText="Selecting…"
                >
                  Choose {plan.name}
                </LoadingButton>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
