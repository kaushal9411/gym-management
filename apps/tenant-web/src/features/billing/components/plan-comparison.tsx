'use client';

import * as React from 'react';
import { Check, X } from 'lucide-react';

import { LoadingButton } from '@/components/ui/loading-button';
import { Skeleton } from '@/components/ui/skeleton';
import { FormAlert } from '@/features/auth/components/form-alert';
import { cn } from '@/lib/utils';
import { usePlans } from '../hooks/use-billing';
import type { SubscriptionPlan } from '../types';
import { formatMoney } from './billing-ui';
import { CheckoutDialog } from './checkout-dialog';

interface PlanComparisonProps {
  /** null = tenant has no subscription yet (legacy/trial tenants) — every plan is offered as a fresh "Choose". */
  currentPlanSlug: string | null;
  currentSortOrder: number | null;
  onChanged: () => void;
}

/** Plan cards — the same plans as the onboarding wizard, for an already-provisioned tenant switching plans. Checkout flow unchanged. */
export function PlanComparison({ currentPlanSlug, currentSortOrder, onChanged }: PlanComparisonProps) {
  const { data: plans, isLoading, isError } = usePlans();
  const [target, setTarget] = React.useState<SubscriptionPlan | null>(null);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-72 rounded-[20px]" />)}
      </div>
    );
  }

  if (isError || !plans) {
    return <FormAlert variant="error" message="Couldn't load plans. Please refresh and try again." />;
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.slug === currentPlanSlug;
          const upgrade = currentSortOrder === null || plan.sortOrder > currentSortOrder;
          // Yearly saving only when both prices are real and the yearly price is genuinely lower than 12 months.
          const saving = plan.priceYearly > 0 && plan.priceMonthly > 0 ? Math.round((1 - plan.priceYearly / (plan.priceMonthly * 12)) * 100) : 0;

          return (
            <section
              key={plan.slug}
              className={cn('relative flex min-w-0 flex-col rounded-[20px] border bg-card p-5 text-card-foreground shadow-xs sm:p-[22px]', isCurrent && 'border-primary ring-2 ring-primary/25')}
            >
              {isCurrent ? (
                <span className="absolute -top-3 left-5 rounded-full bg-primary px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-primary-foreground">Current plan</span>
              ) : null}
              <h3 className="text-[19px] font-extrabold">{plan.name}</h3>
              <p className="mt-0.5 min-h-[2.5rem] text-[13px] text-muted-foreground">{plan.description}</p>

              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-[32px] font-extrabold tabular-nums">{formatMoney(plan.priceMonthly, plan.currency)}</span>
                <span className="text-sm font-semibold text-muted-foreground">/mo</span>
              </div>
              {saving > 0 ? <p className="text-xs font-semibold text-success">Save {saving}% billed yearly ({formatMoney(plan.priceYearly, plan.currency)}/yr)</p> : <div className="h-4" />}

              <ul className="mt-4 flex-1 space-y-2 text-[13.5px]">
                {plan.features.slice(0, 10).map((f) => (
                  <li key={f.key} className={cn('flex items-start gap-2', !f.included && 'text-muted-foreground line-through')}>
                    {f.included ? <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <X className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />}
                    {f.label}
                  </li>
                ))}
              </ul>

              {!isCurrent ? (
                <LoadingButton type="button" variant={upgrade ? 'default' : 'outline'} className="mt-5 w-full" onClick={() => setTarget(plan)}>
                  {currentSortOrder === null ? `Choose ${plan.name}` : `${upgrade ? 'Upgrade to' : 'Downgrade to'} ${plan.name}`}
                </LoadingButton>
              ) : null}
            </section>
          );
        })}
      </div>

      {target ? (
        <CheckoutDialog
          open={!!target}
          onOpenChange={(open) => !open && setTarget(null)}
          targetPlan={target}
          currentSortOrder={currentSortOrder}
          onSuccess={() => {
            setTarget(null);
            onChanged();
          }}
        />
      ) : null}
    </>
  );
}
