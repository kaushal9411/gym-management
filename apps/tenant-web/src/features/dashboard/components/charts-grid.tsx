'use client';

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';

import { ChartWrapper } from '@/components/ui/chart-wrapper';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useAttendanceTrends, useNewMemberGrowth, useRevenueTrends } from '@/features/reports/hooks/use-reports';

/** Real 30-day trend series from the Analytics module (Prompt 20) — supersedes the Prompt-10 foundation's empty-data placeholders now that Attendance/Payments/Members all exist. See `/analytics` for the full, filterable Analytics Dashboard. */
export function ChartsGrid() {
  const { hasPermission } = usePermissions();
  const attendance = useAttendanceTrends();
  const revenue = useRevenueTrends();
  const newMembers = useNewMemberGrowth();

  if (!hasPermission('analytics:view')) return null;

  const attendanceData = (attendance.data ?? []).map((p) => ({ ...p, label: p.date.slice(5) }));
  const revenueData = (revenue.data ?? []).map((p) => ({ ...p, label: p.date.slice(5) }));
  const newMemberData = (newMembers.data ?? []).map((p) => ({ ...p, label: p.date.slice(5) }));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <ChartWrapper
        title="Attendance Trends"
        description="Check-ins over the last 30 days"
        loading={attendance.isPending}
        empty={!attendance.isPending && attendanceData.every((d) => d.value === 0)}
        emptyMessage="No attendance recorded in this period yet."
      >
        <AreaChart data={attendanceData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} width={28} />
          <Tooltip labelFormatter={(label, payload) => payload[0]?.payload.date ?? label} />
          <Area dataKey="value" name="Check-ins" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.2} />
        </AreaChart>
      </ChartWrapper>
      <ChartWrapper
        title="Revenue Trends"
        description="Collected revenue over the last 30 days"
        loading={revenue.isPending}
        empty={!revenue.isPending && revenueData.every((d) => d.income === 0)}
        emptyMessage="No revenue recorded in this period yet."
      >
        <AreaChart data={revenueData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} width={40} />
          <Tooltip labelFormatter={(label, payload) => payload[0]?.payload.date ?? label} />
          <Area dataKey="income" name="Revenue" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.2} />
        </AreaChart>
      </ChartWrapper>
      <ChartWrapper
        title="Member Growth"
        description="New members over the last 30 days"
        loading={newMembers.isPending}
        empty={!newMembers.isPending && newMemberData.every((d) => d.value === 0)}
        emptyMessage="No new members in this period yet."
      >
        <BarChart data={newMemberData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} width={28} />
          <Tooltip labelFormatter={(label, payload) => payload[0]?.payload.date ?? label} />
          <Bar dataKey="value" name="New members" fill="var(--primary)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartWrapper>
    </div>
  );
}
