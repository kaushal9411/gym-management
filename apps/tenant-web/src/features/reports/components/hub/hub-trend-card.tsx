'use client';

import * as React from 'react';
import { Activity, Coins, Receipt, UserPlus } from 'lucide-react';

import { MultiSeriesChart, TrendCompareChart, type ChartPoint, type MultiSeriesRow } from '../../charts';
import { ChartCard, SegmentedTabs } from '../ui';
import { num, shortDate, type ValueFormat } from '../../lib/format';
import type { OverviewDailyPoint } from '../../types';
import type { HubOverview } from './hub-utils';

type Metric = 'revenue' | 'expenses' | 'checkIns' | 'newMembers';

const METRICS: Record<Metric, { label: string; format: ValueFormat; color: string; cur: (d: OverviewDailyPoint) => number; prev: (d: OverviewDailyPoint) => number }> = {
  revenue: { label: 'Revenue', format: 'money', color: 'var(--chart-2)', cur: (d) => num(d.revenue), prev: (d) => num(d.prevRevenue) },
  expenses: { label: 'Expenses', format: 'money', color: 'var(--chart-5)', cur: (d) => num(d.expenses), prev: (d) => num(d.prevExpenses) },
  checkIns: { label: 'Check-ins', format: 'number', color: 'var(--chart-3)', cur: (d) => d.checkIns, prev: (d) => d.prevCheckIns },
  newMembers: { label: 'New members', format: 'number', color: 'var(--chart-1)', cur: (d) => d.newMembers, prev: (d) => d.prevNewMembers },
};

interface Props {
  overview: HubOverview;
  loading: boolean;
  error: boolean;
  compare: boolean;
  previousLabel: string;
}

export function HubTrendCard({ overview, loading, error, compare, previousLabel }: Props) {
  const [metric, setMetric] = React.useState<Metric>('revenue');
  const def = METRICS[metric];
  const daily = overview?.daily;
  const data = React.useMemo<ChartPoint[]>(
    () => (daily ?? []).map((d) => ({ label: shortDate(d.date), value: def.cur(d), previous: compare ? def.prev(d) : undefined })),
    [daily, def, compare],
  );
  return (
    <ChartCard
      title="Trend"
      subtitle={compare ? `This period vs ${previousLabel.toLowerCase()}` : 'Daily values for this period'}
      loading={loading}
      error={error}
      empty={!daily?.length}
      minHeight={320}
      actions={
        <SegmentedTabs
          size="sm"
          accent="analytics"
          ariaLabel="Trend metric"
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'revenue', label: 'Revenue', icon: Coins },
            { value: 'expenses', label: 'Expenses', icon: Receipt },
            { value: 'checkIns', label: 'Check-ins', icon: Activity },
            { value: 'newMembers', label: 'New members', icon: UserPlus },
          ]}
        />
      }
    >
      <TrendCompareChart key={metric} data={data} format={def.format} color={def.color} variant="area" currentLabel={def.label} previousLabel={previousLabel} showPrevious={compare} cumulativeToggle height={300} />
    </ChartCard>
  );
}

export function HubProfitCard({ overview, loading, error }: Omit<Props, 'compare' | 'previousLabel'>) {
  const daily = overview?.daily;
  const rows = React.useMemo<MultiSeriesRow[]>(
    () => (daily ?? []).map((d) => ({ label: shortDate(d.date), revenue: num(d.revenue), expenses: num(d.expenses), net: num(d.revenue) - num(d.expenses) })),
    [daily],
  );
  return (
    <ChartCard title="Revenue vs expenses vs net" subtitle="Daily - click a legend item to hide it" loading={loading} error={error} empty={!daily?.length} minHeight={300}>
      <MultiSeriesChart
        data={rows}
        format="money"
        series={[
          { key: 'revenue', label: 'Revenue', type: 'bar', color: 'var(--chart-2)' },
          { key: 'expenses', label: 'Expenses', type: 'bar', color: 'var(--chart-5)' },
          { key: 'net', label: 'Net', type: 'line', color: 'var(--chart-1)' },
        ]}
      />
    </ChartCard>
  );
}
