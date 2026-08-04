'use client';

import Link from 'next/link';
import { Clock, ListChecks, AlertTriangle, PauseCircle, Layers, Gauge, Percent } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { StatisticCard } from '@/components/ui/statistic-card';
import { ADMIN_ROUTES } from '@/constants/routes';
import { SchedulerSubNav } from '@/features/scheduler/components/scheduler-sub-nav';
import { useSchedulerDashboard } from '@/features/scheduler/hooks/use-scheduler';

const HEALTH_VARIANT = { healthy: 'success', degraded: 'warning', unhealthy: 'destructive' } as const;

export default function SchedulerDashboardPage() {
  const { data, isLoading } = useSchedulerDashboard();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor: 'color-mix(in oklch, var(--chart-4) 16%, transparent)',
            color: 'var(--chart-4)',
            boxShadow: '0 0 0 1px color-mix(in oklch, var(--chart-4) 18%, transparent)',
          }}
        >
          <Clock className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Scheduler &amp; Background Jobs</h1>
          <p className="text-muted-foreground">Centralized job scheduling and queue management for every automated background task.</p>
        </div>
      </div>

      <SchedulerSubNav />

      {isLoading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatisticCard label="Running Jobs" value={data.runningJobs} icon={Gauge} tone="warning" />
            <StatisticCard label="Scheduled Jobs" value={data.scheduledJobs} icon={ListChecks} tone="primary" />
            <StatisticCard label="Failed Jobs" value={data.failedJobs} icon={AlertTriangle} tone="destructive" />
            <StatisticCard label="Paused/Cancelled" value={data.pausedJobs} icon={PauseCircle} tone="orange" />
            <StatisticCard label="Queue Size (backlog)" value={data.queueSize} icon={Layers} tone="aqua" />
            <StatisticCard label="Avg Processing Time" value={`${data.avgProcessingTimeMs} ms`} icon={Clock} tone="violet" />
            <StatisticCard label="Success Rate" value={`${data.successRate}%`} icon={Percent} tone="success" />
            <Card>
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Queue Health</p>
                  <Badge variant={HEALTH_VARIANT[data.queueHealth]} className="text-sm capitalize">
                    {data.queueHealth}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Worker Status</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.workerStatus.map((q) => (
                <Link
                  key={q.queueName}
                  href={`${ADMIN_ROUTES.scheduler}/queues`}
                  className="rounded-lg border p-3 text-sm transition-colors hover:bg-accent/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium capitalize">{q.category.toLowerCase()}</span>
                    <Badge variant={q.isPaused ? 'warning' : 'success'}>{q.isPaused ? 'Paused' : 'Running'}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    waiting {q.counts.waiting ?? 0} · delayed {q.counts.delayed ?? 0} · active {q.counts.active ?? 0} · failed {q.counts.failed ?? 0}
                  </p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
