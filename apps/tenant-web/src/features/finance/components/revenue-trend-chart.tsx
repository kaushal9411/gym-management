'use client';

import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';

import { ChartWrapper } from '@/components/ui/chart-wrapper';
import type { FinanceDashboard } from '../types';

interface RevenueTrendChartProps {
  trend: FinanceDashboard['revenueTrend'] | undefined;
  loading?: boolean;
}

export function RevenueTrendChart({ trend, loading }: RevenueTrendChartProps) {
  const data = (trend ?? []).map((point) => ({ ...point, label: point.date.slice(5) }));
  const isEmpty = !loading && data.every((point) => point.income === 0 && point.expenses === 0);

  return (
    <ChartWrapper title="Revenue trend" description="Income vs. expenses (last 30 days)" loading={loading} empty={isEmpty} emptyMessage="No income or expenses recorded in this period yet.">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} width={40} />
        <Tooltip labelFormatter={(label, payload) => payload[0]?.payload.date ?? label} formatter={(value: number) => `$${value.toFixed(2)}`} />
        <Line type="monotone" dataKey="income" name="Income" stroke="var(--primary)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={2} dot={false} />
      </LineChart>
    </ChartWrapper>
  );
}
