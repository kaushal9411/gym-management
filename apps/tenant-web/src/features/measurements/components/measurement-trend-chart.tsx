'use client';

import { Activity } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Skeleton } from '@/components/ui/skeleton';
import { PanelCard } from '@/features/members/components/detail/detail-ui';
import type { BodyMeasurement } from '../types';

const AXIS = { fill: 'var(--muted-foreground)', fontSize: 11 };
const TOOLTIP_STYLE = {
  contentStyle: { background: 'var(--popover)', color: 'var(--popover-foreground)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-md)', fontSize: 12 },
  labelStyle: { color: 'var(--foreground)', fontWeight: 500, marginBottom: 2 },
  cursor: { fill: 'var(--accent)', opacity: 0.4 },
};

interface MeasurementTrendChartProps {
  entries: BodyMeasurement[];
  loading: boolean;
}

/** Weight + body-fat-% trend over every recorded entry — reuses the same `useMemberMeasurements` data `MemberMeasurementsCard` already fetches (React Query dedupes the identical query key), so this adds zero extra network cost. */
export function MeasurementTrendChart({ entries, loading }: MeasurementTrendChartProps) {
  // Entries come back newest-first; the chart reads left-to-right chronologically.
  const data = [...entries]
    .reverse()
    .map((e) => ({
      date: new Date(e.recordedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      weight: e.weightKg ? Number(e.weightKg) : null,
      bodyFat: e.bodyFatPercent ? Number(e.bodyFatPercent) : null,
    }));

  const hasWeight = data.some((d) => d.weight !== null);
  const hasBodyFat = data.some((d) => d.bodyFat !== null);
  const isEmpty = !loading && (!hasWeight || data.length < 2);

  return (
    <PanelCard icon={Activity} accent="aqua" title="Weight & body fat trend" delay={0.05}>
      {loading ? (
        <Skeleton className="h-[220px] w-full" />
      ) : isEmpty ? (
        <div className="grid h-[220px] place-items-center text-sm text-muted-foreground">
          {entries.length === 0 ? 'No measurements recorded yet.' : 'Record at least two entries with weight to see a trend.'}
        </div>
      ) : (
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <defs>
                <linearGradient id="fill-measurement-weight" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 4" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} />
              <YAxis yAxisId="weight" tick={AXIS} tickLine={false} axisLine={false} width={32} />
              {hasBodyFat ? <YAxis yAxisId="bodyFat" orientation="right" tick={AXIS} tickLine={false} axisLine={false} width={32} /> : null}
              <Tooltip {...TOOLTIP_STYLE} />
              <Area yAxisId="weight" dataKey="weight" name="Weight (kg)" stroke="var(--chart-3)" strokeWidth={2.5} fill="url(#fill-measurement-weight)" connectNulls animationDuration={900} />
              {hasBodyFat ? (
                <Line yAxisId="bodyFat" dataKey="bodyFat" name="Body fat (%)" stroke="var(--chart-7)" strokeWidth={2} dot={{ r: 3 }} connectNulls animationDuration={1100} />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </PanelCard>
  );
}
