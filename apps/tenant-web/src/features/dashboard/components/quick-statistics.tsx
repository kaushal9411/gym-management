'use client';

import { Building2, CreditCard, Coins, ShieldCheck } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useBranches } from '@/features/branch/hooks/use-branches';
import { useTenant } from '@/features/tenant/tenant-provider';

/** The one widget built entirely from real, already-available data (branches + subscription), not a placeholder. */
export function QuickStatistics() {
  const tenant = useTenant();
  const { data: branches } = useBranches();

  const stats = [
    { label: 'Active Branches', value: branches?.length ?? '—', icon: Building2, accent: 'var(--primary)' },
    { label: 'Current Plan', value: tenant.subscription?.planName ?? '—', icon: CreditCard, accent: 'var(--chart-2)' },
    { label: 'Subscription Status', value: tenant.subscription?.status ?? '—', icon: ShieldCheck, accent: 'var(--success)' },
    { label: 'Currency', value: tenant.currency, icon: Coins, accent: 'var(--chart-7)' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick Statistics</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-start gap-3 rounded-xl bg-muted/40 p-3.5">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `color-mix(in oklch, ${stat.accent} 16%, transparent)`, color: stat.accent }}
            >
              <stat.icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="truncate text-base font-semibold tracking-tight">{stat.value}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
