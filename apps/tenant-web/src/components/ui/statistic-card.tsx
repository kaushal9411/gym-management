import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface StatisticCardProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  trend?: { direction: 'up' | 'down' | 'flat'; label: string };
  loading?: boolean;
  className?: string;
}

const trendColor: Record<NonNullable<StatisticCardProps['trend']>['direction'], string> = {
  up: 'text-emerald-600 dark:text-emerald-400',
  down: 'text-red-600 dark:text-red-400',
  flat: 'text-muted-foreground',
};

/** Single KPI tile used across the dashboard grid (Today's Attendance, Active Members, Revenue Summary, etc.). */
function StatisticCard({ label, value, icon: Icon, trend, loading, className }: StatisticCardProps) {
  return (
    <Card className={cn(className)}>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0 space-y-1.5">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="h-7 w-20" />
          ) : (
            <p className="text-2xl font-semibold tracking-tight">{value}</p>
          )}
          {trend && !loading ? (
            <p className={cn('text-xs font-medium', trendColor[trend.direction])}>{trend.label}</p>
          ) : null}
        </div>
        {Icon ? (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export { StatisticCard };
