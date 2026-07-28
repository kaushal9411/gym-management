'use client';

import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';

import { ChartWrapper } from '@/components/ui/chart-wrapper';
import type { FinanceDashboard } from '../types';

interface RevenueTrendChartProps {
  trend: FinanceDashboard['revenueTrend'] | undefined;
  loading?: boolean;
}

const AXIS_TICK = { fill: 'var(--muted-foreground)', fontSize: 12 };
const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'var(--popover)',
    color: 'var(--popover-foreground)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-md)',
    fontSize: 12,
  },
  labelStyle: { color: 'var(--foreground)', fontWeight: 500, marginBottom: 2 },
  cursor: { stroke: 'var(--border)', strokeWidth: 1 },
};

/** Two-line series (income vs. expense) — chart-1/chart-2 in fixed order, always paired with a Legend per dataviz rule for 2+ series. */
export function RevenueTrendChart({ trend, loading }: RevenueTrendChartProps) {
  const data = (trend ?? []).map((point) => ({ ...point, label: point.date.slice(5) }));
  const isEmpty = !loading && data.every((point) => point.income === 0 && point.expenses === 0);

  return (
    <ChartWrapper title="Revenue trend" description="Income vs. expenses (last 30 days)" loading={loading} empty={isEmpty} emptyMessage="No income or expenses recorded in this period yet.">
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} />
        <Tooltip {...TOOLTIP_STYLE} labelFormatter={(label, payload) => payload[0]?.payload.date ?? label} formatter={(value: number) => `$${value.toFixed(2)}`} />
        <Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }} />
        <Line type="monotone" dataKey="income" name="Income" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="expenses" name="Expenses" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
      </LineChart>
    </ChartWrapper>
  );
}
