'use client';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useRevenueGrowth, useRevenueSummary } from '@/features/revenue/hooks/use-revenue';

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

export default function RevenuePage() {
  const { data: summary, isLoading } = useRevenueSummary();
  const { data: growth, isLoading: growthLoading } = useRevenueGrowth(30);

  if (isLoading || !summary) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Revenue Analytics</h1>
        <p className="text-muted-foreground">MRR, ARR, growth, and where the revenue is coming from.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">MRR</p><p className="mt-1 text-2xl font-bold">{formatMoney(summary.mrr)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">ARR</p><p className="mt-1 text-2xl font-bold">{formatMoney(summary.arr)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Revenue growth — last 30 days</CardTitle></CardHeader>
        <CardContent className="h-64">
          {growthLoading || !growth ? (
            <Skeleton className="h-full rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growth}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} width={40} />
                <Tooltip formatter={(value: number) => formatMoney(value)} />
                <Bar dataKey="amount" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Top plans</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {summary.topPlans.map((p) => (
              <div key={p.planId} className="flex justify-between"><span>{p.planName}</span><span className="font-medium">{p.subscriptions}</span></div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Top countries</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {summary.topCountries.length === 0 ? <p className="text-muted-foreground">No billing addresses yet.</p> : summary.topCountries.map((c) => (
              <div key={c.country} className="flex justify-between"><span>{c.country}</span><span className="font-medium">{c.tenantCount}</span></div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Revenue by currency</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {summary.revenueByCurrency.map((r) => (
              <div key={r.currency} className="flex justify-between"><span>{r.currency}</span><span className="font-medium">{r.total.toLocaleString()}</span></div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Revenue by gateway</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {summary.revenueByGateway.map((r) => (
              <div key={r.provider} className="flex justify-between"><span className="capitalize">{r.provider.toLowerCase()}</span><span className="font-medium">{formatMoney(r.total)} ({r.transactionCount})</span></div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
