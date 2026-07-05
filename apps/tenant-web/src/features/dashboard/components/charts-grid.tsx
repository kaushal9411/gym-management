'use client';

import { Area, AreaChart, Bar, BarChart } from 'recharts';

import { ChartWrapper } from '@/components/ui/chart-wrapper';

/** Empty-state placeholders wired for real series once Attendance/Payments/Members data exists. */
export function ChartsGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <ChartWrapper title="Attendance Trends" description="Check-ins over time" empty emptyMessage="Available once Attendance is tracked.">
        <AreaChart data={[]}>
          <Area dataKey="value" stroke="var(--primary)" fill="var(--primary)" />
        </AreaChart>
      </ChartWrapper>
      <ChartWrapper title="Revenue Trends" description="Collected revenue over time" empty emptyMessage="Available once Payments go live.">
        <AreaChart data={[]}>
          <Area dataKey="value" stroke="var(--primary)" fill="var(--primary)" />
        </AreaChart>
      </ChartWrapper>
      <ChartWrapper title="Member Growth" description="New members over time" empty emptyMessage="Available once Members go live.">
        <BarChart data={[]}>
          <Bar dataKey="value" fill="var(--primary)" />
        </BarChart>
      </ChartWrapper>
    </div>
  );
}
