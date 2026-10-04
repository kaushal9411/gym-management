'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { Skeleton } from '@/components/ui/skeleton';
import { FormAlert } from '@/features/auth/components/form-alert';
import { BillingHero } from '@/features/billing/components/billing-hero';
import { formatDate, formatMoney, EmptyBlock } from '@/features/billing/components/billing-ui';
import { PlanComparison } from '@/features/billing/components/plan-comparison';
import { isCancellable, SubscriptionSummary } from '@/features/billing/components/subscription-summary';
import { toBillingError, useCancelSubscription, useCurrentSubscription } from '@/features/billing/hooks/use-billing';
import { HeroButton } from '@/features/finance/components/payments/payments-hero';

export default function BillingOverviewPage() {
  const { data: subscription, isLoading, isError, error } = useCurrentSubscription();
  const queryClient = useQueryClient();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['billing'] });

  const cancel = useCancelSubscription();
  const [confirmingCancel, setConfirmingCancel] = React.useState(false);
  const [cancelError, setCancelError] = React.useState<string | null>(null);

  const handleCancel = (immediate: boolean) => {
    setCancelError(null);
    cancel.mutate(
      { immediate, reason: 'Cancelled from billing portal' },
      {
        onSuccess: () => {
          toast.success(immediate ? 'Subscription cancelled' : 'Subscription will cancel at period end');
          setConfirmingCancel(false);
          refresh();
        },
        onError: (err) => setCancelError(toBillingError(err).message),
      },
    );
  };

  // Tenants provisioned before the billing platform (or whose trial ran
  // out before picking a plan) have no subscription row — that's a normal
  // starting state here, not an error.
  const hasNoSubscription = isError && toBillingError(error).code === 'NOT_FOUND';

  // Honest data: Subscription has no "next amount" field, so it's derived from plan price × billing cycle.
  const nextAmount = subscription
    ? formatMoney(subscription.billingCycle === 'YEARLY' ? subscription.plan.priceYearly : subscription.plan.priceMonthly, subscription.plan.currency)
    : undefined;

  const stats = subscription
    ? [
        { value: subscription.plan.name, label: 'Current plan' },
        { value: subscription.status.replace(/_/g, ' '), label: 'Status' },
        { value: formatDate(subscription.currentPeriodEnd), label: subscription.cancelAtPeriodEnd ? 'Ends on' : 'Renews on' },
        ...(nextAmount && !subscription.cancelAtPeriodEnd ? [{ value: nextAmount, label: 'Next amount' }] : []),
      ]
    : undefined;

  return (
    <div className="space-y-6">
      <BillingHero
        subtitle="Manage your FitCloud plan, payment, and invoices."
        stats={stats}
        statsLoading={isLoading}
        actions={
          subscription ? (
            <>
              <HeroButton href="#plans" solid>Change plan</HeroButton>
              {isCancellable(subscription) && !confirmingCancel ? <HeroButton onClick={() => setConfirmingCancel(true)}>Cancel subscription</HeroButton> : null}
            </>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-56 rounded-[20px]" />
          <Skeleton className="h-56 rounded-[20px]" />
        </div>
      ) : hasNoSubscription ? (
        <div className="rounded-[20px] border bg-card p-5 shadow-xs">
          <EmptyBlock icon={<Sparkles />} title="No subscription yet">
            Pick a plan below to activate your gym — your members, schedules and data are all waiting exactly where you left them.
          </EmptyBlock>
        </div>
      ) : isError || !subscription ? (
        <FormAlert variant="error" message={toBillingError(error).message} />
      ) : (
        <SubscriptionSummary
          subscription={subscription}
          confirmingCancel={confirmingCancel}
          onKeep={() => setConfirmingCancel(false)}
          onCancel={handleCancel}
          cancelling={cancel.isPending}
          error={cancelError}
        />
      )}

      <section id="plans" className="scroll-mt-6">
        <h2 className="mb-1 text-xl font-extrabold">{subscription ? 'Change plan' : 'Choose a plan'}</h2>
        <p className="mb-4 text-sm text-muted-foreground">Tax is calculated at checkout from your billing address.</p>
        <PlanComparison
          currentPlanSlug={subscription?.plan.slug ?? null}
          currentSortOrder={subscription?.plan.sortOrder ?? null}
          onChanged={refresh}
        />
      </section>
    </div>
  );
}
