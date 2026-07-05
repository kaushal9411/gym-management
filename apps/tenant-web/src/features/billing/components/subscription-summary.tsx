'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FormAlert } from '@/features/auth/components/form-alert';
import { LoadingButton } from '@/features/auth/components/loading-button';
import { cn } from '@/lib/utils';
import { toBillingError, useCancelSubscription } from '../hooks/use-billing';
import type { Subscription } from '../types';

const STATUS_STYLES: Record<string, string> = {
  TRIALING: 'bg-primary/10 text-primary',
  ACTIVE: 'bg-success/10 text-success',
  PAST_DUE: 'bg-warning/15 text-warning-foreground',
  GRACE: 'bg-warning/15 text-warning-foreground',
  SUSPENDED: 'bg-destructive/10 text-destructive',
  CANCELED: 'bg-muted text-muted-foreground',
  EXPIRED: 'bg-muted text-muted-foreground',
};

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
}

export function SubscriptionSummary({ subscription, onCancelled }: { subscription: Subscription; onCancelled: () => void }) {
  const cancel = useCancelSubscription();
  const [confirmingCancel, setConfirmingCancel] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleCancel = (immediate: boolean) => {
    setError(null);
    cancel.mutate(
      { immediate, reason: 'Cancelled from billing portal' },
      {
        onSuccess: () => {
          toast.success(immediate ? 'Subscription cancelled' : 'Subscription will cancel at period end');
          setConfirmingCancel(false);
          onCancelled();
        },
        onError: (err) => setError(toBillingError(err).message),
      },
    );
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Current plan</p>
            <h2 className="text-xl font-semibold">{subscription.plan.name}</h2>
          </div>
          <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', STATUS_STYLES[subscription.status] ?? 'bg-muted')}>
            {subscription.status.replace('_', ' ')}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">Billing cycle</p>
            <p className="font-medium">{subscription.billingCycle === 'YEARLY' ? 'Yearly' : 'Monthly'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Current period ends</p>
            <p className="font-medium">{formatDate(subscription.currentPeriodEnd)}</p>
          </div>
          {subscription.status === 'TRIALING' ? (
            <div>
              <p className="text-muted-foreground">Trial ends</p>
              <p className="font-medium">{formatDate(subscription.trialEndsAt)}</p>
            </div>
          ) : null}
          {subscription.graceEndsAt ? (
            <div>
              <p className="text-muted-foreground">Grace period ends</p>
              <p className="font-medium">{formatDate(subscription.graceEndsAt)}</p>
            </div>
          ) : null}
        </div>

        {subscription.cancelAtPeriodEnd ? (
          <FormAlert variant="error" message={`This subscription will cancel on ${formatDate(subscription.currentPeriodEnd)}.`} />
        ) : null}

        <FormAlert variant="error" message={error} />

        {subscription.status !== 'CANCELED' && subscription.status !== 'EXPIRED' ? (
          confirmingCancel ? (
            <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 sm:flex-row">
              <LoadingButton variant="outline" className="flex-1" onClick={() => handleCancel(false)} loading={cancel.isPending} loadingText="Cancelling…">
                Cancel at period end
              </LoadingButton>
              <LoadingButton variant="destructive" className="flex-1" onClick={() => handleCancel(true)} loading={cancel.isPending} loadingText="Cancelling…">
                Cancel immediately
              </LoadingButton>
              <Button variant="ghost" onClick={() => setConfirmingCancel(false)} disabled={cancel.isPending}>
                Keep subscription
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setConfirmingCancel(true)}>
              Cancel subscription
            </Button>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
