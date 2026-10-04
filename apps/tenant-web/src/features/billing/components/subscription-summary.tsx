'use client';

import * as React from 'react';
import { CalendarClock, CreditCard, Hourglass, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { PanelCard } from '@/features/finance/components/payments/payments-ui';
import { FormAlert } from '@/features/auth/components/form-alert';
import type { Subscription } from '../types';
import { formatDate, formatMoney, StatusPill } from './billing-ui';

const DAY_MS = 86_400_000;

/** Days left until `end` (ceil, floored at 0) and % of the current period elapsed. Null when the period has no end. */
export function periodProgress(subscription: Subscription): { daysLeft: number; elapsedPct: number } | null {
  if (!subscription.currentPeriodEnd) return null;
  const start = new Date(subscription.currentPeriodStart).getTime();
  const end = new Date(subscription.currentPeriodEnd).getTime();
  const now = Date.now();
  const total = Math.max(end - start, 1);
  return { daysLeft: Math.max(Math.ceil((end - now) / DAY_MS), 0), elapsedPct: Math.min(Math.max(((now - start) / total) * 100, 0), 100) };
}

export function isCancellable(subscription: Subscription): boolean {
  return subscription.status !== 'CANCELED' && subscription.status !== 'EXPIRED';
}

interface SubscriptionSummaryProps {
  subscription: Subscription;
  confirmingCancel: boolean;
  onKeep: () => void;
  onCancel: (immediate: boolean) => void;
  cancelling: boolean;
  error: string | null;
}

/** Overview cards: plan + period progress, and a details panel. The Cancel button itself lives in the hero; its confirm bar renders here. */
export function SubscriptionSummary({ subscription, confirmingCancel, onKeep, onCancel, cancelling, error }: SubscriptionSummaryProps) {
  const progress = periodProgress(subscription);
  const yearly = subscription.billingCycle === 'YEARLY';
  const price = yearly ? subscription.plan.priceYearly : subscription.plan.priceMonthly;
  const periodLabel = subscription.cancelAtPeriodEnd ? 'Ends on' : 'Renews on';

  return (
    <div className="space-y-4">
      {subscription.cancelAtPeriodEnd ? (
        <FormAlert variant="error" message={`This subscription will cancel on ${formatDate(subscription.currentPeriodEnd)}.`} />
      ) : null}
      <FormAlert variant="error" message={error} />

      {confirmingCancel && isCancellable(subscription) ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-3 sm:flex-row">
          <LoadingButton variant="outline" className="flex-1" onClick={() => onCancel(false)} loading={cancelling} loadingText="Cancelling…">
            Cancel at period end
          </LoadingButton>
          <LoadingButton variant="destructive" className="flex-1" onClick={() => onCancel(true)} loading={cancelling} loadingText="Cancelling…">
            Cancel immediately
          </LoadingButton>
          <Button variant="ghost" onClick={onKeep} disabled={cancelling}>
            Keep subscription
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <PanelCard title={subscription.plan.name} subtitle={subscription.plan.description} action={<StatusPill status={subscription.status} />}>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-[34px] font-extrabold tabular-nums">{formatMoney(price, subscription.plan.currency)}</span>
            <span className="text-sm font-semibold text-muted-foreground">/ {yearly ? 'year' : 'month'}</span>
          </div>

          {progress ? (
            <div className="mt-5">
              <div className="mb-1.5 flex justify-between text-[13px] font-semibold">
                <span>{progress.daysLeft} {progress.daysLeft === 1 ? 'day' : 'days'} remaining</span>
                <span className="text-muted-foreground">{Math.round(progress.elapsedPct)}% of period used</span>
              </div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress.elapsedPct)}
                aria-label="Billing period elapsed"
                className="h-2.5 overflow-hidden rounded-full bg-muted"
              >
                <div className="h-full rounded-full" style={{ width: `${progress.elapsedPct}%`, backgroundImage: 'linear-gradient(90deg, var(--chart-1), var(--chart-3))' }} />
              </div>
              <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
                <span>{formatDate(subscription.currentPeriodStart)}</span>
                <span>{formatDate(subscription.currentPeriodEnd)}</span>
              </div>
            </div>
          ) : null}
        </PanelCard>

        <PanelCard title="Subscription details" subtitle="From your current subscription">
          <dl className="space-y-3 text-sm">
            <Row icon={<CreditCard className="size-4" />} label="Billing cycle" value={yearly ? 'Yearly' : 'Monthly'} />
            <Row icon={<CalendarClock className="size-4" />} label="Period started" value={formatDate(subscription.currentPeriodStart)} />
            <Row icon={<CalendarClock className="size-4" />} label={periodLabel} value={formatDate(subscription.currentPeriodEnd)} />
            {subscription.status === 'TRIALING' ? <Row icon={<Hourglass className="size-4" />} label="Trial ends" value={formatDate(subscription.trialEndsAt)} /> : null}
            {subscription.graceEndsAt ? <Row icon={<ShieldAlert className="size-4" />} label="Grace period ends" value={formatDate(subscription.graceEndsAt)} /> : null}
          </dl>
        </PanelCard>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
      <dt className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}
