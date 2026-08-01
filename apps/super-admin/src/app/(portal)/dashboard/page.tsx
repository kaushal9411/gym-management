'use client';

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle,
  Building2,
  CircleCheck,
  Clock3,
  Gauge,
  TrendingUp,
  Wallet,
  XCircle,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatisticCard } from '@/components/ui/statistic-card';
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard';

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading || !stats) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        className="flex items-center gap-3.5 rounded-2xl border p-5"
        style={{
          backgroundImage:
            'linear-gradient(120deg, color-mix(in oklch, var(--primary) 12%, transparent) 0%, color-mix(in oklch, var(--chart-2) 9%, transparent) 60%, color-mix(in oklch, var(--chart-3) 8%, transparent) 100%)',
        }}
      >
        <div
          className="hidden size-11 shrink-0 items-center justify-center rounded-xl sm:flex"
          style={{
            backgroundColor: 'color-mix(in oklch, var(--primary) 16%, transparent)',
            color: 'var(--primary)',
            boxShadow: '0 0 0 1px color-mix(in oklch, var(--primary) 18%, transparent)',
          }}
        >
          <Gauge className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Platform-wide overview across every tenant.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatisticCard label="Total tenants" value={stats.totals.totalTenants} icon={Building2} tone="primary" />
        <StatisticCard label="Active tenants" value={stats.totals.activeTenants} icon={CircleCheck} tone="success" />
        <StatisticCard label="Trial tenants" value={stats.totals.trialTenants} icon={Clock3} tone="aqua" />
        <StatisticCard label="Expired / suspended" value={stats.totals.expiredTenants} icon={AlertTriangle} tone="destructive" />
        <StatisticCard label="Monthly revenue" value={formatMoney(stats.revenue.monthly)} icon={Wallet} tone="success" />
        <StatisticCard label="Yearly revenue" value={formatMoney(stats.revenue.yearly)} icon={TrendingUp} tone="violet" />
        <StatisticCard label="Pending payments" value={stats.revenue.pendingPayments} icon={Clock3} tone="warning" />
        <StatisticCard label="Failed payments" value={stats.revenue.failedPayments} icon={XCircle} tone="destructive" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Signups — last 30 days</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.growthChart}>
                <defs>
                  <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="var(--chart-1)" fill="url(#growthFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Support tickets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Open</span><span className="font-medium">{stats.supportTickets.open}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">In progress</span><span className="font-medium">{stats.supportTickets.inProgress}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Resolved</span><span className="font-medium">{stats.supportTickets.resolved}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Closed</span><span className="font-medium">{stats.supportTickets.closed}</span></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top plans</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {stats.topPlans.length === 0 ? (
              <p className="text-muted-foreground">No active subscriptions yet.</p>
            ) : (
              stats.topPlans.map((plan) => (
                <div key={plan.planId} className="flex justify-between">
                  <span>{plan.planName}</span>
                  <span className="font-medium">{plan.activeSubscriptions}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {stats.recentActivity.length === 0 ? (
              <p className="text-muted-foreground">No recent admin activity.</p>
            ) : (
              stats.recentActivity.map((activity) => (
                <div key={activity.id} className="flex justify-between gap-2">
                  <span className="truncate">{activity.action.replace('admin.', '').replace(/_/g, ' ')}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{new Date(activity.createdAt).toLocaleString()}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
