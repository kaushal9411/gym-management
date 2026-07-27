'use client';

import { Activity, CreditCard, UserCheck, UserPlus } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeTime } from '@/lib/format-relative-time';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useCurrentBranch } from '@/features/branch/hooks/use-branches';
import { useRecentActivities } from '@/features/reports/hooks/use-reports';
import type { RecentActivity as RecentActivityItem } from '@/features/reports/types';

const ICONS: Record<RecentActivityItem['type'], typeof UserCheck> = {
  PAYMENT: CreditCard,
  CHECK_IN: UserCheck,
  NEW_MEMBER: UserPlus,
};

/** "Get Recent Activities" (Prompt 20) — a real merged feed of payments/check-ins/new members, superseding the Prompt-10 foundation's generic-notifications stand-in. Scoped to the header's currently-selected branch (Prompt 24). */
export function RecentActivity() {
  const { hasPermission } = usePermissions();
  const { currentBranchId } = useCurrentBranch();
  const { data, isPending } = useRecentActivities(currentBranchId ?? undefined);
  const items = data ?? [];

  if (!hasPermission('reports:view')) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Activities</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isPending ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
        ) : items.length === 0 ? (
          <EmptyState icon={Activity} title="No recent activity" />
        ) : (
          items.map((item) => {
            const Icon = ICONS[item.type];
            return (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-start gap-3 rounded-lg p-1.5 text-sm transition-colors hover:bg-accent/50"
              >
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                  <p className="text-xs text-muted-foreground/70">{formatRelativeTime(item.occurredAt)}</p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
