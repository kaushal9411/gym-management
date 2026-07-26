import * as React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
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

const trendStyle: Record<NonNullable<StatisticCardProps['trend']>['direction'], { color: string; Icon: LucideIcon }> = {
  up: { color: 'text-success', Icon: ArrowUpRight },
  down: { color: 'text-destructive', Icon: ArrowDownRight },
  flat: { color: 'text-muted-foreground', Icon: Minus },
};

/**
 * Single KPI tile used across the dashboard grid (Today's Attendance,
 * Active Members, Revenue Summary, etc.) — rendered many times per grid, so
 * memoized (Prompt 23: Global Loading & Performance Optimization) since its
 * props are typically primitive/stable across the parent's re-renders.
 */
const StatisticCard = React.memo(function StatisticCard({ label, value, icon: Icon, trend, loading, className }: StatisticCardProps) {
  return (
    <Card className={cn('transition-all duration-200 hover:shadow-sm', className)}>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0 space-y-1.5">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="h-7 w-20" />
          ) : (
            <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
          )}
          {trend && !loading ? (
            <p className={cn('flex items-center gap-1 text-xs font-medium', trendStyle[trend.direction].color)}>
              {React.createElement(trendStyle[trend.direction].Icon, { className: 'size-3.5', 'aria-hidden': true })}
              {trend.label}
            </p>
          ) : null}
        </div>
        {Icon ? (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
            <Icon className="size-5" aria-hidden />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
});

export { StatisticCard };
