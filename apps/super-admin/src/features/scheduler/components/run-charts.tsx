'use client';

import { useMemo } from 'react';

import { Bar as RBar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { ChartTooltip, EmptyNote } from '@/features/dashboard/components/ui';
import type { JobExecution, JobRunStatus } from '../types';
import { STATUS_COLOR, fmtMs } from './kit';

const AXIS = { fontSize: 11, fill: 'var(--muted-foreground)' } as const;

/** Stacked completed/failed/other runs bucketed by hour (span < 48 h) or day. */
export function RunsOverTime({ runs }: { runs: JobExecution[] }) {
  const rows = useMemo(() => {
    if (runs.length === 0) return [];
    const times = runs.map((r) => new Date(r.startedAt).getTime());
    const span = Math.max(...times) - Math.min(...times);
    const hourly = span < 48 * 3_600_000;
    const map = new Map<number, { label: string; completed: number; failed: number; other: number }>();
    for (const r of runs) {
      const d = new Date(r.startedAt);
      const k = hourly ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()).getTime() : new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const label = hourly ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      const row = map.get(k) ?? { label, completed: 0, failed: 0, other: 0 };
      if (r.status === 'COMPLETED') row.completed++; else if (r.status === 'FAILED') row.failed++; else row.other++;
      map.set(k, row);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  }, [runs]);
  if (rows.length === 0) return <EmptyNote>No executions recorded yet.</EmptyNote>;
  return (
    <div className="h-[220px]" role="img" aria-label="Runs over time, stacked by outcome">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} minTickGap={16} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.5 }} content={<ChartTooltip fmt={(v) => String(v)} names={{ completed: 'Completed', failed: 'Failed', other: 'Other' }} />} />
          <RBar dataKey="completed" stackId="a" fill={STATUS_COLOR.COMPLETED} isAnimationActive={false} />
          <RBar dataKey="other" stackId="a" fill={STATUS_COLOR.PENDING} isAnimationActive={false} />
          <RBar dataKey="failed" stackId="a" fill={STATUS_COLOR.FAILED} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Outcome donut + legend. */
export function OutcomeDonut({ runs }: { runs: JobExecution[] }) {
  const counts = useMemo(() => {
    const m = new Map<JobRunStatus, number>();
    for (const r of runs) m.set(r.status, (m.get(r.status) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [runs]);
  if (runs.length === 0) return <EmptyNote>No executions recorded yet.</EmptyNote>;
  const done = counts.find(([s]) => s === 'COMPLETED')?.[1] ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative size-[150px] shrink-0" role="img" aria-label={`Outcomes: ${counts.map(([s, n]) => `${s.toLowerCase()} ${n}`).join(', ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={counts.map(([name, value]) => ({ name, value }))} dataKey="value" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="none" isAnimationActive={false}>
              {counts.map(([s]) => <Cell key={s} fill={STATUS_COLOR[s]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div><p className="text-xl font-semibold tabular-nums">{Math.round((done / runs.length) * 100)}%</p><p className="text-[11px] text-muted-foreground">succeeded</p></div>
        </div>
      </div>
      <ul className="min-w-[120px] flex-1 space-y-1.5 text-xs">
        {counts.map(([s, n]) => (
          <li key={s} className="flex items-center gap-2 text-muted-foreground">
            <i className="size-2 rounded-sm" style={{ background: STATUS_COLOR[s] }} aria-hidden />
            <span className="capitalize">{s.toLowerCase()}</span>
            <b className="ml-auto tabular-nums text-foreground">{n}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Average duration per job (jobs with at least one timed run), slowest first. */
export function DurationByJob({ runs }: { runs: JobExecution[] }) {
  const rows = useMemo(() => {
    const m = new Map<string, { sum: number; n: number }>();
    for (const r of runs) if (r.durationMs !== null) { const v = m.get(r.jobName) ?? { sum: 0, n: 0 }; v.sum += r.durationMs; v.n++; m.set(r.jobName, v); }
    return [...m.entries()].map(([name, v]) => ({ name, avg: Math.round(v.sum / v.n) })).sort((a, b) => b.avg - a.avg).slice(0, 8);
  }, [runs]);
  if (rows.length === 0) return <EmptyNote>No timed executions yet.</EmptyNote>;
  return (
    <div style={{ height: Math.max(120, rows.length * 30 + 20) }} role="img" aria-label="Average duration per job">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtMs(v)} />
          <YAxis type="category" dataKey="name" width={150} tick={AXIS} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.5 }} content={<ChartTooltip fmt={fmtMs} names={{ avg: 'Average' }} />} />
          <RBar dataKey="avg" fill="var(--chart-1)" radius={[0, 3, 3, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Per-run durations of one job in chronological order, coloured by outcome. */
export function DurationTimeline({ runs }: { runs: JobExecution[] }) {
  const rows = useMemo(() => runs.filter((r) => r.durationMs !== null).slice().reverse().map((r) => ({ label: new Date(r.startedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), ms: r.durationMs as number, status: r.status })), [runs]);
  if (rows.length < 2) return <EmptyNote>Not enough timed runs to chart yet.</EmptyNote>;
  return (
    <div className="h-[200px]" role="img" aria-label="Run duration over recent executions">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={false} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtMs(v)} />
          <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.5 }} content={<ChartTooltip fmt={fmtMs} names={{ ms: 'Duration' }} />} />
          <RBar dataKey="ms" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {rows.map((r, i) => <Cell key={i} fill={STATUS_COLOR[r.status]} />)}
          </RBar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
