'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useBranches } from '@/features/branch/hooks/use-branches';
import { useTenant } from '@/features/tenant/tenant-provider';

/** The one widget built entirely from real, already-available data (branches + subscription), not a placeholder. */
export function QuickStatistics() {
  const tenant = useTenant();
  const { data: branches } = useBranches();

  const stats = [
    { label: 'Active Branches', value: branches?.length ?? '—' },
    { label: 'Current Plan', value: tenant.subscription?.planName ?? '—' },
    { label: 'Subscription Status', value: tenant.subscription?.status ?? '—' },
    { label: 'Currency', value: tenant.currency },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick Statistics</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label}>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="truncate text-sm font-semibold">{stat.value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
