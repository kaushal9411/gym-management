'use client';

import { useQueryClient } from '@tanstack/react-query';

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing & Subscription</h1>
        <p className="text-muted-foreground">Manage your FitCloud plan, payment, and invoices.</p>
      </div>

      <BillingNav />

      {isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : isError || !subscription ? (
        <FormAlert variant="error" message={toBillingError(error).message} />
      ) : (
        <SubscriptionSummary subscription={subscription} onCancelled={refresh} />
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Change plan</h2>
        {subscription ? (
          <PlanComparison currentPlanSlug={subscription.plan.slug} currentSortOrder={subscription.plan.sortOrder} onChanged={refresh} />
        ) : null}
      </div>
    </div>
  );
}
