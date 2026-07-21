'use client';

import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';

import { ChartWrapper } from '@/components/ui/chart-wrapper';
import type { AttendanceSummary } from '../types';

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
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} width={28} />
        <Tooltip labelFormatter={(label, payload) => payload[0]?.payload.date ?? label} />
        <Area type="monotone" dataKey="count" name="Check-ins" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.2} />
      </AreaChart>
    </ChartWrapper>
  );
}
