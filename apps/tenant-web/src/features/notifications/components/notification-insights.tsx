'use client';

import * as React from 'react';
import { Clock } from 'lucide-react';

import { DonutChart, Heatmap, MultiSeriesChart, RadialGauge, TrendCompareChart, type ChartPoint } from '@/features/reports/charts';
import { ChartCard, DeltaBadge, SegmentedTabs, StatPill } from '@/features/reports/components/ui';
import { shortDate } from '@/features/reports/lib/format';
import { accentColor } from '@/features/reports/lib/reports-theme';
import { CATEGORY_COLOR, CATEGORY_LABEL, COMM_ACCENT } from '../constants';
import type { NotificationStats } from '../types';

interface Props {
  stats?: NotificationStats;
  loading: boolean;
  error: boolean;
  compare: boolean;
  previousLabel: string;
}

const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}`;

function TrendCard({ stats, loading, error, compare, previousLabel }: Props) {
  const [view, setView] = React.useState<'volume' | 'read'>('volume');
  const daily = stats?.daily ?? [];
  const volume: ChartPoint[] = daily.map((d) => ({ label: shortDate(d.date), tip: shortDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' }), value: d.total, previous: compare ? d.previousTotal : undefined }));
  const readRows = daily.map((d) => ({ label: shortDate(d.date), received: d.total, read: d.read }));
  return (
    <ChartCard
      title="Notification volume"
      subtitle={view === 'volume' ? `Received per day vs ${previousLabel.toLowerCase()}` : 'Received per day and how many your team has read'}
      actions={
        <SegmentedTabs
          size="sm"
          accent={COMM_ACCENT}
          value={view}
          onChange={setView}
          ariaLabel="Trend view"
          options={[
            { value: 'volume', label: 'Volume' },
            { value: 'read', label: 'Received vs read' },
          ]}
        />
      }
      loading={loading}
      error={error}
      empty={!daily.length}
      emptyText="No notifications in this period"
      minHeight={290}
    >
      {view === 'volume' ? (
        <TrendCompareChart data={volume} color={accentColor(COMM_ACCENT)} currentLabel="This period" previousLabel={previousLabel} showPrevious={compare} height={290} />
      ) : (
        <MultiSeriesChart
          data={readRows}
          height={290}
          series={[
            { key: 'received', label: 'Received', type: 'area', color: accentColor(COMM_ACCENT) },
            { key: 'read', label: 'Read by your team', type: 'line', color: 'var(--success)' },
          ]}
        />
      )}
    </ChartCard>
  );
}

function GaugeCard({ stats, loading, error, compare, previousLabel }: Props) {
  const k = stats?.kpis;
  const rate = (k?.readRate.value ?? 0) * 100;
  return (
    <ChartCard title="Read rate" subtitle="Share of received notifications your team has read" loading={loading} error={error} empty={!k || k.total.value === 0} emptyText="Nothing received yet" minHeight={290}>
      {k ? (
        <div className="flex flex-col items-center gap-4 py-2">
          <RadialGauge value={rate} size={178} thickness={15} color="var(--success)" label="read" />
          {compare ? (
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <DeltaBadge value={rate} previous={k.readRate.previous * 100} />
              <span>vs {previousLabel.toLowerCase()} ({(k.readRate.previous * 100).toFixed(0)}%)</span>
            </div>
          ) : null}
          <div className="grid w-full grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-muted/60 px-3 py-2">
              <p className="text-lg font-extrabold tabular-nums">{k.read.value.toLocaleString()}</p>
              <p className="text-xs font-semibold text-muted-foreground">Read</p>
            </div>
            <div className="rounded-xl bg-muted/60 px-3 py-2">
              <p className="text-lg font-extrabold tabular-nums">{k.unread.value.toLocaleString()}</p>
              <p className="text-xs font-semibold text-muted-foreground">Unread</p>
            </div>
          </div>
        </div>
      ) : null}
    </ChartCard>
  );
}

function CategoryCard({ stats, loading, error, compare, previousLabel }: Props) {
  const cats = [...(stats?.categories ?? [])].filter((c) => c.count > 0 || c.previousCount > 0).sort((a, b) => b.count - a.count);
  return (
    <ChartCard title="By category" subtitle={compare ? `Share of notifications, change vs ${previousLabel.toLowerCase()}` : 'Share of notifications received'} loading={loading} error={error} empty={!cats.some((c) => c.count > 0)} emptyText="No notifications in this period" minHeight={240}>
      <div className="grid items-center gap-5 md:grid-cols-[auto_1fr]">
        <DonutChart side={false} size={176} centerLabel="Received" data={cats.filter((c) => c.count > 0).map((c) => ({ label: CATEGORY_LABEL[c.category], value: c.count, color: CATEGORY_COLOR[c.category] }))} />
        <ul className="min-w-0 space-y-1.5">
          {cats.slice(0, 7).map((c) => (
            <li key={c.category} className="flex items-center gap-2 text-[13px]">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: CATEGORY_COLOR[c.category] }} aria-hidden />
              <span className="min-w-0 flex-1 truncate font-semibold">{CATEGORY_LABEL[c.category]}</span>
              <span className="font-bold tabular-nums">{c.count.toLocaleString()}</span>
              {compare ? <DeltaBadge value={c.count} previous={c.previousCount} size="sm" /> : null}
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
}

function HourlyCard({ stats, loading, error }: Props) {
  const byHour = Array.from({ length: 24 }, (_, h) => stats?.hourly.find((x) => x.hour === h)?.count ?? 0);
  const busiest = byHour.reduce((best, v, h) => (v > byHour[best]! ? h : best), 0);
  const any = byHour.some((v) => v > 0);
  return (
    <ChartCard
      title="Activity by hour"
      subtitle="When notifications arrive, by hour of day"
      actions={any ? <StatPill icon={Clock} accent={COMM_ACCENT} label="Busiest" value={`${hourLabel(busiest)} · ${byHour[busiest]!.toLocaleString()}`} /> : undefined}
      loading={loading}
      error={error}
      empty={!any}
      emptyText="No notifications in this period"
      minHeight={160}
    >
      <Heatmap rows={['Received']} cols={byHour.map((_, h) => hourLabel(h))} values={[byHour]} titles={[byHour.map((_, h) => `${String(h).padStart(2, '0')}:00`)]} color={accentColor(COMM_ACCENT)} showColLabelEvery={3} cellHeight={44} />
    </ChartCard>
  );
}

/**
 * Charts from GET /notifications/stats: trend (daily/previousTotal/read), read-rate gauge (kpis), category donut + deltas (categories), hourly heatmap (hourly).
 * Hour buckets are assumed to be in the tenant/browser local zone as the API returns them (not converted here).
 */
export function NotificationInsights(props: Props) {
  return (
    <div className="grid gap-3.5 lg:grid-cols-12">
      <div className="min-w-0 lg:col-span-8">
        <TrendCard {...props} />
      </div>
      <div className="min-w-0 lg:col-span-4">
        <GaugeCard {...props} />
      </div>
      <div className="min-w-0 lg:col-span-7">
        <CategoryCard {...props} />
      </div>
      <div className="min-w-0 lg:col-span-5">
        <HourlyCard {...props} />
      </div>
    </div>
  );
}

