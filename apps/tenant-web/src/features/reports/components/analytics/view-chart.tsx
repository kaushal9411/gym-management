'use client';

import * as React from 'react';

import { TrendCompareChart } from '../../charts';
import { accentColor } from '../../lib/reports-theme';
import type { AnalyticsView } from './analytics-config';
import { DualTrendChart } from './dual-trend-chart';
import type { MergedRow } from './use-analytics-series';

/** Chart for one series view: two-series area (revenue / collection) or a this-vs-previous trend. */
export function ViewChart({ view, rows, compare, height }: { view: AnalyticsView; rows: MergedRow[]; compare: boolean; height: number }) {
  if (view.dual) {
    return <DualTrendChart rows={rows} labels={[view.dual.a, view.dual.b]} colors={['var(--chart-1)', view.slug === 'payment-collection' ? 'var(--chart-4)' : 'var(--chart-2)']} format={view.format} showPrevious={compare} height={height} />;
  }
  return (
    <TrendCompareChart
      data={rows.map((r) => ({ label: r.label, tip: r.tip, value: r.a, previous: compare ? r.pa : undefined }))}
      format={view.format}
      color={accentColor(view.entry.accent)}
      variant={view.variant}
      currentLabel={view.seriesLabel}
      previousLabel="Previous period"
      showPrevious={compare}
      height={height}
    />
  );
}
