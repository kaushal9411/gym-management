'use client';

import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';

import { ChartWrapper } from '@/components/ui/chart-wrapper';
import type { AttendanceSummary } from '../types';

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
  cursor: { fill: 'var(--accent)', opacity: 0.4 },
};

interface AttendanceTrendChartProps {
  trend: AttendanceSummary['trend'] | undefined;
  loading?: boolean;
}

export function AttendanceTrendChart({ trend, loading }: AttendanceTrendChartProps) {
  const data = (trend ?? []).map((point) => ({ ...point, label: point.date.slice(5) }));
  const isEmpty = !loading && data.every((point) => point.count === 0);

  return (
    <ChartWrapper title="Attendance trend" description="Check-ins per day (last 7 days)" loading={loading} empty={isEmpty} emptyMessage="No check-ins in this period yet.">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="fill-attendance-trend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={28} />
        <Tooltip {...TOOLTIP_STYLE} labelFormatter={(label, payload) => payload[0]?.payload.date ?? label} />
        <Area
          dataKey="count"
          name="Check-ins"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#fill-attendance-trend)"
        />
      </AreaChart>
    </ChartWrapper>
  );
}
