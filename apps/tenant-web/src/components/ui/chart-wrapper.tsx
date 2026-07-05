'use client';

import * as React from 'react';
import { ResponsiveContainer } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

interface ChartWrapperProps {
  title: string;
  description?: string;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  height?: number;
  className?: string;
  children: React.ReactElement;
}

/** Shared shell (title, loading skeleton, empty state, responsive sizing) for every Recharts chart on the dashboard. */
function ChartWrapper({
  title,
  description,
  loading,
  empty,
  emptyMessage = 'No data for this period yet.',
  height = 280,
  className,
  children,
}: ChartWrapperProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton style={{ height }} className="w-full" />
        ) : empty ? (
          <div style={{ height }} className="flex items-center justify-center">
            <EmptyState title={emptyMessage} />
          </div>
        ) : (
          <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              {children}
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { ChartWrapper };
