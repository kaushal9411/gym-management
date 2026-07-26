'use client';

import * as React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ChartWrapper } from '@/components/ui/chart-wrapper';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { ReportFiltersBar, type ReportFilterValue } from '@/features/reports/components/report-filters-bar';
import {
  useAttendanceTrends,
  useBranchComparison,
  useMembershipGrowth,
  useNewMemberGrowth,
  usePaymentCollection,
  useRetention,
  useRevenueTrends,
} from '@/features/reports/hooks/use-reports';

const PIE_COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function defaultFilters(): ReportFilterValue {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
  return { dateFrom: from, dateTo: to, branchId: '' };
}

export default function AnalyticsDashboardPage() {
  const { hasPermission } = usePermissions();
  const [filters, setFilters] = React.useState<ReportFilterValue>(defaultFilters);

  const revenueTrends = useRevenueTrends(filters.dateFrom, filters.dateTo, filters.branchId || undefined);
  const attendanceTrends = useAttendanceTrends(filters.dateFrom, filters.dateTo, filters.branchId || undefined);
  const membershipGrowth = useMembershipGrowth(filters.dateFrom, filters.dateTo, filters.branchId || undefined);
  const newMemberGrowth = useNewMemberGrowth(filters.dateFrom, filters.dateTo, filters.branchId || undefined);
  const retention = useRetention(filters.dateFrom, filters.dateTo, filters.branchId || undefined);
  const paymentCollection = usePaymentCollection(filters.dateFrom, filters.dateTo, filters.branchId || undefined);
  const branchComparison = useBranchComparison(filters.branchId || undefined);

  if (!hasPermission('analytics:view')) {
    return <p className="text-sm text-muted-foreground">You don&apos;t have access to analytics.</p>;
  }

  const revenueData = (revenueTrends.data ?? []).map((p) => ({ ...p, label: p.date.slice(5) }));
  const attendanceData = (attendanceTrends.data ?? []).map((p) => ({ ...p, label: p.date.slice(5) }));
  const membershipData = (membershipGrowth.data ?? []).map((p) => ({ ...p, label: p.date.slice(5) }));
  const newMemberData = (newMemberGrowth.data ?? []).map((p) => ({ ...p, label: p.date.slice(5) }));
  const retentionData = (retention.data ?? []).map((p) => ({ ...p, label: p.date.slice(5) }));
  const collectionData = (paymentCollection.data ?? []).map((p) => ({ ...p, label: p.date.slice(5) }));
  const branchPieData = (branchComparison.data ?? []).filter((b) => b.revenue > 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics Dashboard</h1>
        <p className="text-muted-foreground">Trends and comparisons across the last 30 days by default.</p>
      </div>

      <ReportFiltersBar value={filters} onChange={setFilters} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartWrapper
          title="Revenue Trends"
          description="Income vs. expenses"
          loading={revenueTrends.isPending}
          empty={!revenueTrends.isPending && revenueData.every((d) => d.income === 0 && d.expenses === 0)}
        >
          <AreaChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} width={40} />
            <Tooltip labelFormatter={(label, payload) => payload[0]?.payload.date ?? label} />
            <Legend />
            <Area type="monotone" dataKey="income" name="Income" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.2} />
            <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} />
          </AreaChart>
        </ChartWrapper>

        <ChartWrapper
          title="Attendance Trends"
          description="Daily check-ins"
          loading={attendanceTrends.isPending}
          empty={!attendanceTrends.isPending && attendanceData.every((d) => d.value === 0)}
        >
          <LineChart data={attendanceData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} width={28} />
            <Tooltip labelFormatter={(label, payload) => payload[0]?.payload.date ?? label} />
            <Line type="monotone" dataKey="value" name="Check-ins" stroke="var(--primary)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartWrapper>

        <ChartWrapper
          title="Membership Growth"
          description="New memberships assigned per day"
          loading={membershipGrowth.isPending}
          empty={!membershipGrowth.isPending && membershipData.every((d) => d.value === 0)}
        >
          <BarChart data={membershipData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} width={28} />
            <Tooltip labelFormatter={(label, payload) => payload[0]?.payload.date ?? label} />
            <Bar dataKey="value" name="New memberships" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartWrapper>

        <ChartWrapper
          title="New Member Growth"
          description="New members joined per day"
          loading={newMemberGrowth.isPending}
          empty={!newMemberGrowth.isPending && newMemberData.every((d) => d.value === 0)}
        >
          <BarChart data={newMemberData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} width={28} />
            <Tooltip labelFormatter={(label, payload) => payload[0]?.payload.date ?? label} />
            <Bar dataKey="value" name="New members" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartWrapper>

        <ChartWrapper
          title="Member Retention"
          description="Active members as of each day (simplified retention view)"
          loading={retention.isPending}
          empty={!retention.isPending && retentionData.every((d) => d.value === 0)}
        >
          <LineChart data={retentionData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} width={28} />
            <Tooltip labelFormatter={(label, payload) => payload[0]?.payload.date ?? label} />
            <Line type="monotone" dataKey="value" name="Active members" stroke="#8b5cf6" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartWrapper>

        <ChartWrapper
          title="Payment Collection"
          description="Collected payments vs. invoiced amounts"
          loading={paymentCollection.isPending}
          empty={!paymentCollection.isPending && collectionData.every((d) => d.income === 0 && d.expenses === 0)}
        >
          <AreaChart data={collectionData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} width={40} />
            <Tooltip labelFormatter={(label, payload) => payload[0]?.payload.date ?? label} />
            <Legend />
            <Area type="monotone" dataKey="income" name="Collected" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.2} />
            <Area type="monotone" dataKey="expenses" name="Invoiced" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
          </AreaChart>
        </ChartWrapper>

        <ChartWrapper
          title="Branch Comparison"
          description="Revenue share by branch (this month)"
          loading={branchComparison.isPending}
          empty={!branchComparison.isPending && branchPieData.length === 0}
          className="lg:col-span-2"
        >
          <PieChart>
            <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
            <Legend />
            <Pie data={branchPieData} dataKey="revenue" nameKey="branch" cx="50%" cy="50%" outerRadius={100} label={(entry: { branch: string }) => entry.branch}>
              {branchPieData.map((entry, index) => (
                <Cell key={entry.branchId} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ChartWrapper>
      </div>
    </div>
  );
}
