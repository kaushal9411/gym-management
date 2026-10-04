'use client';

import * as React from 'react';

import { DonutChart, RadialGauge } from '../../charts';
import { AnimatedNumber, ChartCard, StaggerGroup, StaggerItem } from '../ui';
import { num, useValueFormatter } from '../../lib/format';
import { titleCase, type HubOverview } from './hub-utils';

interface Props {
  overview: HubOverview;
  loading: boolean;
  error: boolean;
}

export function HubPaymentMethodsCard({ overview, loading, error }: Props) {
  const money = useValueFormatter('money');
  const src = overview?.paymentMethods;
  const data = React.useMemo(() => (src ?? []).map((m) => ({ label: titleCase(m.method), value: num(m.amount) })), [src]);
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <ChartCard title="Payment methods" subtitle="Collected amount by method" loading={loading} error={error} empty={total === 0} minHeight={260}>
      <DonutChart data={data} format="money" centerLabel="Collected" centerValue={money(total, true)} />
    </ChartCard>
  );
}

function GaugeItem({ label, caption, value, color }: { label: string; caption: string; value: number; color: string }) {
  return (
    <StaggerItem className="flex items-center gap-4 rounded-2xl bg-muted/40 p-4">
      <RadialGauge value={value} label={label} size={96} thickness={10} color={color} />
      <div className="min-w-0">
        <p className="text-sm font-extrabold">{label}</p>
        <p className="text-xs text-muted-foreground">{caption}</p>
        <p className="mt-1 text-lg font-extrabold tabular-nums">
          <AnimatedNumber value={value} format="percent" />
        </p>
      </div>
    </StaggerItem>
  );
}

/** Ratios derived only from real overview fields (no invented metrics). */
export function HubGaugesCard({ overview, loading, error }: Props) {
  const k = overview?.kpis;
  const revenue = num(k?.revenue.value);
  const expenses = num(k?.expenses.value);
  const net = num(k?.netProfit.value);
  const statuses = overview?.memberStatus ?? [];
  const totalMembers = statuses.reduce((a, b) => a + b.count, 0);
  const active = statuses.find((s) => s.status.toLowerCase() === 'active')?.count ?? 0;
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const hasData = Boolean(k) && (revenue > 0 || totalMembers > 0);
  return (
    <ChartCard title="Health ratios" subtitle="Derived from this period's totals" loading={loading} error={error} empty={!hasData} minHeight={140}>
      <StaggerGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {revenue > 0 ? <GaugeItem label="Net margin" caption="Net profit / revenue" value={clamp((net / revenue) * 100)} color="var(--chart-2)" /> : null}
        {revenue > 0 ? <GaugeItem label="Expense ratio" caption="Expenses / revenue" value={clamp((expenses / revenue) * 100)} color="var(--chart-5)" /> : null}
        {totalMembers > 0 ? <GaugeItem label="Active share" caption="Active / all members" value={clamp((active / totalMembers) * 100)} color="var(--chart-1)" /> : null}
        {(k?.activeMembers.value ?? 0) > 0 ? <GaugeItem label="Renewals due" caption="Expiring in 30d / active" value={clamp(((k?.expiringIn30d.value ?? 0) / (k?.activeMembers.value ?? 1)) * 100)} color="var(--chart-4)" /> : null}
      </StaggerGroup>
    </ChartCard>
  );
}
