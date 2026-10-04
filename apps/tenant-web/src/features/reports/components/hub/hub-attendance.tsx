'use client';

import * as React from 'react';
import { CalendarDays, Clock } from 'lucide-react';

import { GroupedBarChart, Heatmap, type ChartPoint } from '../../charts';
import { ChartCard, StatPill } from '../ui';
import { WEEKDAY_ORDER, hourLabel, weekdayLabel, type HubOverview } from './hub-utils';

interface Props {
  overview: HubOverview;
  loading: boolean;
  error: boolean;
  compare: boolean;
  previousLabel: string;
}

export function HubWeekdayCard({ overview, loading, error, compare, previousLabel }: Props) {
  const src = overview?.weekdayAttendance;
  const data = React.useMemo<ChartPoint[]>(() => {
    const map = new Map<string, { c: number; p: number }>();
    for (const w of src ?? []) map.set(weekdayLabel(w.weekday), { c: w.count, p: w.previousCount });
    return WEEKDAY_ORDER.map((d) => ({ label: d, value: map.get(d)?.c ?? 0, previous: compare ? (map.get(d)?.p ?? 0) : undefined }));
  }, [src, compare]);
  const busiest = data.reduce((a, b) => (b.value > a.value ? b : a), data[0]!);
  return (
    <ChartCard
      title="Attendance by weekday"
      subtitle="Check-ins per day of week"
      loading={loading}
      error={error}
      empty={!src?.length || data.every((d) => d.value === 0 && !d.previous)}
      actions={busiest && busiest.value > 0 ? <StatPill icon={CalendarDays} accent="attendance" label="Busiest day" value={busiest.label} /> : undefined}
    >
      <GroupedBarChart data={data} color="var(--chart-3)" currentLabel="This period" previousLabel={previousLabel} />
    </ChartCard>
  );
}

export function HubHourlyCard({ overview, loading, error }: Omit<Props, 'compare' | 'previousLabel'>) {
  const src = overview?.hourlyAttendance;
  const { values, cols, titles, peak } = React.useMemo(() => {
    const counts = Array<number>(24).fill(0);
    for (const h of src ?? []) if (h.hour >= 0 && h.hour < 24) counts[h.hour] = h.count;
    const max = Math.max(...counts);
    return {
      values: [counts],
      cols: counts.map((_, h) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}`),
      titles: [counts.map((_, h) => hourLabel(h))],
      peak: max > 0 ? counts.indexOf(max) : -1,
    };
  }, [src]);
  return (
    <ChartCard
      title="Peak hours"
      subtitle="Check-ins by hour of day"
      loading={loading}
      error={error}
      empty={!src?.length || peak < 0}
      actions={peak >= 0 ? <StatPill icon={Clock} accent="attendance" label="Busiest hour" value={hourLabel(peak)} /> : undefined}
    >
      <Heatmap rows={['Check-ins']} cols={cols} values={values} titles={titles} color="var(--chart-3)" showColLabelEvery={3} cellHeight={56} />
    </ChartCard>
  );
}
