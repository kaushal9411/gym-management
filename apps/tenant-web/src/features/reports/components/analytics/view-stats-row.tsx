'use client';

import * as React from 'react';
import { Activity, CalendarDays, Gauge, Sigma, TrendingUp } from 'lucide-react';

import { shortDate } from '../../lib/format';
import { KpiTile, StaggerGroup } from '../ui';
import type { AnalyticsView } from './analytics-config';
import type { SeriesStats } from './series-stats';

/** Four stat tiles for a focused view: total/latest, average, peak day, change vs previous (or span when not comparing). */
export function ViewStatsRow({ view, stats, days, compare, loading }: { view: AnalyticsView; stats: SeriesStats; days: number; compare: boolean; loading: boolean }) {
  const accent = view.entry.accent;
  const money = view.format === 'money';
  const f = view.format;
  const tiles: React.ReactNode[] = [];

  if (view.dual) {
    const [a, b] = [view.dual.a, view.dual.b];
    const rate = stats.totalB ? (stats.total / stats.totalB) * 100 : 0;
    const prevRate = stats.prevTotal !== undefined && stats.prevTotalB ? (stats.prevTotal / stats.prevTotalB) * 100 : undefined;
    const isRate = view.slug === 'payment-collection';
    tiles.push(
      <KpiTile key="a" label={`Total ${a.toLowerCase()}`} value={stats.total} format={f} previous={stats.prevTotal} icon={Sigma} accent={accent} compact loading={loading} />,
      <KpiTile key="b" label={`Total ${b.toLowerCase()}`} value={stats.totalB ?? 0} format={f} previous={stats.prevTotalB} invert={view.slug === 'revenue-trends'} icon={Activity} accent={accent} compact loading={loading} />,
      isRate ? (
        <KpiTile key="c" label="Collection rate" value={rate} format="percent" previous={prevRate} icon={Gauge} accent={accent} hint="collected / invoiced" loading={loading} />
      ) : (
        <KpiTile key="c" label="Net" value={stats.total - (stats.totalB ?? 0)} format={f} previous={stats.prevTotal !== undefined ? stats.prevTotal - (stats.prevTotalB ?? 0) : undefined} icon={Gauge} accent={accent} compact loading={loading} />
      ),
      <KpiTile key="d" label={`Peak ${a.toLowerCase()} day`} value={stats.peak} format={f} icon={TrendingUp} accent={accent} compact hint={stats.peakDate ? shortDate(stats.peakDate) : undefined} loading={loading} />,
    );
  } else {
    const snapshot = view.kind === 'snapshot';
    tiles.push(
      <KpiTile key="a" label={snapshot ? 'Latest' : 'Total'} value={snapshot ? stats.latest : stats.total} format={f} previous={snapshot ? stats.prevLatest : stats.prevTotal} icon={Sigma} accent={accent} compact={money} loading={loading} />,
      <KpiTile key="b" label="Daily average" value={stats.average} format={f} previous={stats.prevAverage} icon={Activity} accent={accent} compact={money} loading={loading} />,
      <KpiTile key="c" label="Peak day" value={stats.peak} format={f} icon={TrendingUp} accent={accent} compact={money} hint={stats.peakDate ? shortDate(stats.peakDate) : undefined} loading={loading} />,
      compare && stats.change !== null ? (
        <KpiTile key="d" label="Change vs previous" value={stats.change} format="percent" icon={Gauge} accent={accent} hint={snapshot ? 'latest vs latest' : 'total vs total'} loading={loading} />
      ) : (
        <KpiTile key="d" label="Days in range" value={days} icon={CalendarDays} accent={accent} hint={compare ? 'no previous data' : undefined} loading={loading} />
      ),
    );
  }

  return <StaggerGroup className="grid grid-cols-2 gap-3 lg:grid-cols-4">{tiles}</StaggerGroup>;
}
