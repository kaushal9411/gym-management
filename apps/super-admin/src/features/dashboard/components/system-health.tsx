'use client';

import { useEffect, useState } from 'react';

import type { DashboardOverview } from '../types';
import { fmtInt, fmtUptime } from './format';
import { Bar, Chip, Panel, type ChipTone } from './ui';

type Health = NonNullable<DashboardOverview['health']>;
const okStatus = (s: string) => s === 'up' || s === 'healthy' || s === 'ok';
const BUFFER = 20;

/** Rolling client-side buffer of polled values (honest: only samples seen since the page opened). */
function useRolling(value: number | null | undefined, stamp: string): number[] {
  const [buf, setBuf] = useState<number[]>([]);
  useEffect(() => {
    if (value === null || value === undefined) return;
    setBuf((b) => [...b, value].slice(-BUFFER));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sample once per poll (stamp changes), not on every value identity
  }, [stamp]);
  return buf;
}

function Spark({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <p className="mt-2 h-[26px] text-[11px] text-muted-foreground">Collecting samples…</p>;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 120},${22 - ((v - min) / span) * 18}`).join(' ');
  return (
    <svg viewBox="0 0 120 26" width="100%" height="26" preserveAspectRatio="none" className="mt-2" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Metric({ label, value, chip, tone, children }: { label: string; value: string; chip: string; tone: ChipTone; children?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xl font-semibold tabular-nums">{value}<Chip tone={tone}>{chip}</Chip></p>
      {children}
    </div>
  );
}

export function SystemHealth({ health, stamp, index }: { health: Health; stamp: string; index: number }) {
  const db = useRolling(health.database.latencyMs, stamp);
  const redis = useRolling(health.redis.latencyMs, stamp);
  const q = health.queue;
  const qTone: ChipTone = !q ? 'slate' : q.health === 'unhealthy' ? 'red' : q.failedJobs > 0 ? 'amber' : 'green';
  const total = q ? q.runningJobs + q.failedJobs + q.queueSize : 0;
  return (
    <Panel title="System health" hint={health.uptimeSeconds !== null ? `uptime ${fmtUptime(health.uptimeSeconds)}` : 'live'} index={index} className="xl:col-span-6">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-x-4 gap-y-5">
        <Metric label="Database" value={health.database.latencyMs === null ? '—' : `${health.database.latencyMs} ms`} chip={okStatus(health.database.status) ? 'up' : health.database.status} tone={okStatus(health.database.status) ? 'green' : 'red'}>
          <Spark data={db} color="var(--chart-2)" />
        </Metric>
        <Metric label="Redis" value={health.redis.latencyMs === null ? '—' : `${health.redis.latencyMs} ms`} chip={okStatus(health.redis.status) ? 'up' : health.redis.status} tone={okStatus(health.redis.status) ? 'green' : 'red'}>
          <Spark data={redis} color="var(--chart-3)" />
        </Metric>
        {q ? (
          <Metric label="Job queue" value={`${fmtInt(q.queueSize)} queued`} chip={q.health === 'unhealthy' ? 'unhealthy' : q.failedJobs > 0 ? `${q.failedJobs} failed` : 'nominal'} tone={qTone}>
            <div className="mt-3"><Bar pct={total ? ((q.runningJobs + q.failedJobs) / total) * 100 : 0} color={q.failedJobs > 0 ? 'var(--chart-5)' : 'var(--chart-1)'} /></div>
            <p className="mt-1 text-[11px] text-muted-foreground">{fmtInt(q.runningJobs)} running · {fmtInt(q.failedJobs)} failed</p>
          </Metric>
        ) : null}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">Latency graphs show samples since this page opened.</p>
    </Panel>
  );
}
