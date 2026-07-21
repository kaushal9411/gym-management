'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FormAlert } from '@/features/auth/components/form-alert';
import { BillingNav } from '@/features/billing/components/billing-nav';
import { PlanComparison } from '@/features/billing/components/plan-comparison';
import { SubscriptionSummary } from '@/features/billing/components/subscription-summary';
import { toBillingError, useCurrentSubscription } from '@/features/billing/hooks/use-billing';

export default function BillingOverviewPage() {
  const { data: subscription, isLoading, isError, error } = useCurrentSubscription();
  const queryClient = useQueryClient();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['billing'] });

  // Tenants provisioned before the billing platform (or whose trial ran
  // out before picking a plan) have no subscription row — that's a normal
  // starting state here, not an error.
  const hasNoSubscription = isError && toBillingError(error).code === 'NOT_FOUND';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing &amp; Subscription</h1>
        <p className="text-muted-foreground">Manage your FitCloud plan, payment, and invoices.</p>
      </div>

      <BillingNav />

      {isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : hasNoSubscription ? (
        <Card>
          <CardContent className="flex items-start gap-3 p-5">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-medium">No subscription yet</p>
              <p className="text-sm text-muted-foreground">
                Pick a plan below to activate your gym — your members, schedules and data are all waiting exactly where
                you left them.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : isError || !subscription ? (
        <FormAlert variant="error" message={toBillingError(error).message} />
      ) : (
        <SubscriptionSummary subscription={subscription} onCancelled={refresh} />
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">{subscription ? 'Change plan' : 'Choose a plan'}</h2>
        <PlanComparison
          currentPlanSlug={subscription?.plan.slug ?? null}
          currentSortOrder={subscription?.plan.sortOrder ?? null}
          onChanged={refresh}
        />
      </div>
    </div>
  );
}
