'use client';

import * as React from 'react';
import { Check } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { FormAlert } from '@/features/auth/components/form-alert';
import { LoadingButton } from '@/features/auth/components/loading-button';
import { usePlans } from '../hooks/use-billing';
import type { SubscriptionPlan } from '../types';
import { CheckoutDialog } from './checkout-dialog';

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

interface PlanComparisonProps {
  /** null = tenant has no subscription yet (legacy/trial tenants) — every plan is offered as a fresh "Choose". */
  currentPlanSlug: string | null;
  currentSortOrder: number | null;
  onChanged: () => void;
}

/** Plan Comparison / Pricing — the same three plans as the onboarding wizard, but for an already-provisioned tenant switching plans. */
export function PlanComparison({ currentPlanSlug, currentSortOrder, onChanged }: PlanComparisonProps) {
  const { data: plans, isLoading, isError } = usePlans();
  const [target, setTarget] = React.useState<SubscriptionPlan | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    );
  }

  if (isError || !plans) {
    return <FormAlert variant="error" message="Couldn't load plans. Please refresh and try again." />;
  }

  return (
    <>
      <div className="space-y-3">
        {plans.map((plan) => {
          const isCurrent = plan.slug === currentPlanSlug;
          const included = plan.features.filter((f) => f.included);

          return (
            <Card key={plan.slug} className={cn(isCurrent && 'border-primary')}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-base font-semibold">
                      {plan.name}
                      {isCurrent ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Current plan</span> : null}
                    </h3>
                    <p className="text-xs text-muted-foreground">{plan.description}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-lg font-bold">{formatMoney(plan.priceMonthly, plan.currency)}</div>
                    <div className="text-xs text-muted-foreground">/mo</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {included.slice(0, 8).map((feature) => (
                    <span key={feature.key} className="flex items-center gap-1">
                      <Check className="size-3 shrink-0 text-success" aria-hidden />
                      {feature.label}
                    </span>
                  ))}
                </div>

                {!isCurrent ? (
                  <LoadingButton
                    type="button"
                    variant={currentSortOrder === null || plan.sortOrder > currentSortOrder ? 'default' : 'outline'}
                    className="w-full"
                    onClick={() => setTarget(plan)}
                  >
                    {currentSortOrder === null
                      ? `Choose ${plan.name}`
                      : `${plan.sortOrder > currentSortOrder ? 'Upgrade to' : 'Downgrade to'} ${plan.name}`}
                  </LoadingButton>
                ) : null}
              </CardContent>
            </Card>
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
