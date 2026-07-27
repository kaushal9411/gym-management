'use client';

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';

import { ChartWrapper } from '@/components/ui/chart-wrapper';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useCurrentBranch } from '@/features/branch/hooks/use-branches';
import { useAttendanceTrends, useNewMemberGrowth, useRevenueTrends } from '@/features/reports/hooks/use-reports';

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

/** Real 30-day trend series from the Analytics module (Prompt 20) — supersedes the Prompt-10 foundation's empty-data placeholders now that Attendance/Payments/Members all exist. See `/analytics` for the full, filterable Analytics Dashboard. Scoped to the header's currently-selected branch (Prompt 24). */
export function ChartsGrid() {
  const { hasPermission } = usePermissions();
  const { currentBranchId } = useCurrentBranch();
  const branchId = currentBranchId ?? undefined;
  const attendance = useAttendanceTrends(undefined, undefined, branchId);
  const revenue = useRevenueTrends(undefined, undefined, branchId);
  const newMembers = useNewMemberGrowth(undefined, undefined, branchId);

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
          <defs>
            <linearGradient id="fill-attendance" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={28} />
          <Tooltip {...TOOLTIP_STYLE} labelFormatter={(label, payload) => payload[0]?.payload.date ?? label} />
          <Area
            dataKey="value"
            name="Check-ins"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#fill-attendance)"
          />
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
          <defs>
            <linearGradient id="fill-revenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} />
          <Tooltip {...TOOLTIP_STYLE} labelFormatter={(label, payload) => payload[0]?.payload.date ?? label} />
          <Area
            dataKey="income"
            name="Revenue"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#fill-revenue)"
          />
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
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={28} />
          <Tooltip {...TOOLTIP_STYLE} labelFormatter={(label, payload) => payload[0]?.payload.date ?? label} />
          <Bar dataKey="value" name="New members" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ChartWrapper>
    </div>
  );
}
