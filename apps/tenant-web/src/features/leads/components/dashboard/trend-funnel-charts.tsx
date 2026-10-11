'use client';

import * as React from 'react';

import { MultiSeriesChart } from '@/features/reports/charts';
import { ChartCard, SegmentedTabs } from '@/features/reports/components/ui';
import { shortDate } from '@/features/reports/lib/format';
import { STATUS_META } from '../../lib/lead-meta';
import type { AnalyticsRangeKey, LeadAnalytics, LeadStatus } from '../../types';

const SERIES = [
  { key: 'newLeads', label: 'Enquiries', type: 'area' as const, color: 'var(--chart-1)' },
  { key: 'converted', label: 'Converted', type: 'line' as const, color: 'var(--success)' },
];

/** Enquiries vs converted: daily for the selected range, or the trailing 12 calendar months. */
export function TrendChart({ data, loading, error, range }: { data: LeadAnalytics | undefined; loading: boolean; error: boolean; range: AnalyticsRangeKey }) {
  const [mode, setMode] = React.useState<'auto' | 'daily' | 'monthly'>('auto');
  const view = mode === 'auto' ? (range === 'year' ? 'monthly' : 'daily') : mode;
  const rows =
    view === 'monthly'
      ? (data?.monthly ?? []).map((m) => ({ label: new Date(`${m.month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short' }), tip: new Date(`${m.month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), newLeads: m.newLeads, converted: m.converted }))
      : (data?.daily ?? []).map((d) => ({ label: shortDate(d.date), tip: shortDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' }), newLeads: d.newLeads, converted: d.converted }));
  return (
    <ChartCard
      title="Enquiries vs converted"
      subtitle={view === 'monthly' ? 'Last 12 months, by month created (converted = of those, now members)' : 'Daily, selected range (converted = by conversion date)'}
      loading={loading}
      error={error}
      empty={!rows.some((r) => r.newLeads || r.converted)}
      emptyText="No enquiries in this period yet"
      minHeight={300}
      actions={
        <SegmentedTabs
          size="sm"
          ariaLabel="Trend granularity"
          value={view}
          onChange={(v) => setMode(v)}
          options={[
            { value: 'daily', label: 'Daily' },
            { value: 'monthly', label: '12 months' },
          ]}
        />
      }
    >
      <MultiSeriesChart data={rows} series={SERIES} format="number" height={300} />
    </ChartCard>
  );
}

/** Conversion funnel, stage bars with drop-off from the previous stage. */
export function FunnelCard({ data, loading, error }: { data: LeadAnalytics | undefined; loading: boolean; error: boolean }) {
  const f = data?.funnel;
  return (
    <ChartCard title="Conversion funnel" subtitle="Furthest stage reached by leads created in range" loading={loading} error={error} empty={!f || f.total === 0} emptyText="No leads created in this period" minHeight={300}>
      {f ? (
        <div className="space-y-2.5">
          {f.stages.map((s, i) => {
            const meta = STATUS_META[s.stage as LeadStatus];
            return (
              <div key={s.stage}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="font-bold">{meta?.label ?? s.stage}</span>
                  <span className="tabular-nums text-muted-foreground">
                    <b className="text-foreground">{s.count}</b> ({Math.round(s.pctOfTop * 100)}%)
                    {i > 0 && s.dropOff > 0 ? <span className="ml-2 font-semibold" style={{ color: 'var(--destructive)' }}>-{Math.round(s.dropOffRate * 100)}% drop</span> : null}
                  </span>
                </div>
                <div className="h-[22px] overflow-hidden rounded-lg bg-muted">
                  <div className="h-full rounded-lg transition-[width] duration-700" style={{ width: `${Math.max(s.pctOfTop * 100, s.count ? 2 : 0)}%`, backgroundColor: meta?.color ?? 'var(--chart-1)' }} />
                </div>
              </div>
            );
          })}
          <p className="pt-1 text-xs text-muted-foreground">
            {f.lost} of {f.total} leads are currently lost (they still count in the stages they reached).
          </p>
        </div>
      ) : null}
    </ChartCard>
  );
}
