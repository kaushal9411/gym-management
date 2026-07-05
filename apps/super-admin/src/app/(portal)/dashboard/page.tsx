'use client';

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard';

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: 'default' | 'success' | 'destructive' }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${tone === 'success' ? 'text-success' : tone === 'destructive' ? 'text-destructive' : ''}`}>{value}</p>
      </CardContent>
    </Card>
  );
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Platform-wide overview across every tenant.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total tenants" value={stats.totals.totalTenants} />
        <StatCard label="Active tenants" value={stats.totals.activeTenants} tone="success" />
        <StatCard label="Trial tenants" value={stats.totals.trialTenants} />
        <StatCard label="Expired / suspended" value={stats.totals.expiredTenants} tone="destructive" />
        <StatCard label="Monthly revenue" value={formatMoney(stats.revenue.monthly)} tone="success" />
        <StatCard label="Yearly revenue" value={formatMoney(stats.revenue.yearly)} />
        <StatCard label="Pending payments" value={stats.revenue.pendingPayments} />
        <StatCard label="Failed payments" value={stats.revenue.failedPayments} tone="destructive" />
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
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="var(--primary)" fill="url(#growthFill)" strokeWidth={2} />
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
