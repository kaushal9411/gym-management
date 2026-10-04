'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Skeleton } from '@/components/ui/skeleton';
import { ChartTooltip, EmptyNote, Panel } from '@/features/dashboard/components/ui';
import { fmtInt, fmtMoneyCompact } from '@/features/dashboard/components/format';
import { cn } from '@/lib/utils';
import type { HealthBucket, TenantInsights } from '../../api/list';

/*
 * Honest-data notes: signupsBySource is always null today (no signup source is stored) so that card is hidden;
 * the spec's "next 60 days" renewals are the API's 8 rolling 7-day buckets.
 */
const PLAN_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-8)', 'var(--chart-7)'];
const HEALTH_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#16a34a'];
// Bucket -> API health filter. 61-80 straddles fair (41-70) and healthy (71-100), so it is not clickable.
const BUCKET_FILTER: Record<string, HealthBucket | undefined> = { '0-20': 'at_risk', '21-40': 'at_risk', '41-60': 'fair', '81-100': 'healthy' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1] ?? m;
const weekLabel = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;

function GrowBar({ pct, color, delay = 0 }: { pct: number; color: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
      <motion.div
        className="h-full origin-left rounded-full"
        style={{ width: `${Math.max(2, Math.min(100, pct))}%`, background: color }}
        initial={reduce ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.25, delay, ease: 'easeOut' }}
      />
    </div>
  );
}

function Growth({ data, index }: { data: TenantInsights['growth']; index: number }) {
  const reduce = useReducedMotion();
  const rows = data.map((d) => ({ ...d, label: monthLabel(d.month) }));
  const added = data.reduce((a, d) => a + d.new, 0);
  return (
    <Panel title="Tenant growth" hint="12 months" index={index} className="xl:col-span-4">
      {rows.length === 0 ? <EmptyNote>No data yet.</EmptyNote> : (
        <>
          <div className="h-[110px]" role="img" aria-label={`Tenant growth over 12 months, ${fmtInt(added)} new tenants`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rows} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="tl-growth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="var(--chart-1)" stopOpacity={0.3} />
                    <stop offset="1" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip content={<ChartTooltip fmt={fmtInt} names={{ total: 'Total tenants', new: 'New' }} />} />
                <Area type="monotone" dataKey="total" stroke="var(--chart-1)" strokeWidth={2} fill="url(#tl-growth)" isAnimationActive={!reduce} animationDuration={500} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-xs text-muted-foreground"><b className="text-foreground">{fmtInt(added)}</b> new in the last 12 months</p>
        </>
      )}
    </Panel>
  );
}

function PlanMix({ data, index }: { data: TenantInsights['planMix']; index: number }) {
  const max = Math.max(1, ...data.map((p) => p.tenants));
  return (
    <Panel title="By plan" hint="count · MRR" index={index} className="xl:col-span-4">
      {data.length === 0 ? <EmptyNote>No subscriptions yet.</EmptyNote> : (
        <ul className="grid gap-2.5 text-[12.5px]">
          {data.slice(0, 6).map((p, i) => (
            <li key={p.planId} className="grid gap-1">
              <div className="flex justify-between gap-2"><span className="truncate">{p.planName}</span><b className="shrink-0 tabular-nums">{fmtInt(p.tenants)} · {fmtMoneyCompact(p.mrr)}</b></div>
              <GrowBar pct={(p.tenants / max) * 100} color={PLAN_COLORS[i % PLAN_COLORS.length]!} delay={i * 0.03} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function HealthDist({ data, active, onPick, index }: { data: TenantInsights['healthDistribution']; active: HealthBucket | ''; onPick: (h: HealthBucket) => void; index: number }) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <Panel title="Health distribution" hint="score" index={index} className="md:col-span-2 xl:col-span-4">
      <div className="flex h-[112px] items-end gap-1.5">
        {data.map((d, i) => {
          const f = BUCKET_FILTER[d.bucket];
          const on = !!f && f === active;
          return (
            <button
              key={d.bucket}
              type="button"
              disabled={!f}
              onClick={() => f && onPick(f)}
              aria-label={`Score ${d.bucket}: ${d.count} tenants${f ? `. Filter ${f.replace('_', ' ')}` : ''}`}
              aria-pressed={f ? on : undefined}
              className={cn('group flex h-full flex-1 flex-col items-center justify-end gap-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring', f ? 'cursor-pointer' : 'cursor-default')}
            >
              <span className="text-[11px] font-semibold tabular-nums">{fmtInt(d.count)}</span>
              <motion.span
                className={cn('block w-full origin-bottom rounded-t', on && 'ring-2 ring-primary')}
                style={{ height: `${Math.max(4, (d.count / max) * 78)}px`, background: HEALTH_COLORS[i] }}
                initial={reduce ? false : { scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.25, delay: i * 0.03, ease: 'easeOut' }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1.5 text-[10.5px] text-muted-foreground">{data.map((d) => <span key={d.bucket} className="flex-1 text-center">{d.bucket}</span>)}</div>
    </Panel>
  );
}

function Renewals({ data, index, className }: { data: TenantInsights['renewals']; index: number; className?: string }) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...data.map((d) => Number(d.expectedMrr)));
  const total = data.reduce((a, d) => a + Number(d.expectedMrr), 0);
  return (
    <Panel title="Renewals coming up" hint="next 8 weeks · expected MRR" index={index} className={className}>
      {data.every((d) => d.tenants === 0) ? <EmptyNote>No renewals due in the next 8 weeks.</EmptyNote> : (
        <>
          <div className="flex h-[96px] items-end gap-2">
            {data.map((d, i) => (
              <div key={d.weekStart} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`Week of ${weekLabel(d.weekStart)}: ${d.tenants} renewals · ${fmtMoneyCompact(d.expectedMrr)}`}>
                <motion.span
                  className="block w-full origin-bottom rounded-t"
                  style={{ height: `${Math.max(3, (Number(d.expectedMrr) / max) * 80)}px`, background: 'var(--chart-1)', opacity: 0.45 + 0.55 * (Number(d.expectedMrr) / max) }}
                  initial={reduce ? false : { scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.25, delay: i * 0.03, ease: 'easeOut' }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-2 text-[10.5px] text-muted-foreground">{data.map((d) => <span key={d.weekStart} className="flex-1 text-center">{weekLabel(d.weekStart)}</span>)}</div>
          <p className="mt-2 text-xs text-muted-foreground"><b className="text-foreground">{fmtMoneyCompact(total)}</b> expected across {fmtInt(data.reduce((a, d) => a + d.tenants, 0))} renewals</p>
        </>
      )}
    </Panel>
  );
}

function Sources({ data, index }: { data: NonNullable<TenantInsights['signupsBySource']>; index: number }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <Panel title="Signups by source" index={index} className="md:col-span-1 xl:col-span-6">
      <ul className="grid gap-2.5 text-[12.5px]">
        {data.map((d, i) => (
          <li key={d.source} className="grid gap-1"><div className="flex justify-between"><span>{d.source}</span><b className="tabular-nums">{fmtInt(d.count)}</b></div><GrowBar pct={(d.count / max) * 100} color={PLAN_COLORS[(i + 3) % PLAN_COLORS.length]!} /></li>
        ))}
      </ul>
    </Panel>
  );
}

export function ListInsights({ data, isLoading, isError, onRetry, health, onHealth }: {
  data?: TenantInsights; isLoading: boolean; isError: boolean; onRetry: () => void; health: HealthBucket | ''; onHealth: (h: HealthBucket) => void;
}) {
  if (isLoading) {
    return <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-12" aria-busy aria-label="Loading insights">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className={cn('h-44 rounded-[14px]', i < 3 ? 'xl:col-span-4' : 'md:col-span-2 xl:col-span-12')} />)}</div>;
  }
  if (isError || !data) {
    return <EmptyNote>Unable to load tenant insights. <button type="button" className="font-semibold text-primary underline" onClick={onRetry}>Retry</button></EmptyNote>;
  }
  const sources = data.signupsBySource && data.signupsBySource.length > 0 ? data.signupsBySource : null;
  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-12">
      <Growth data={data.growth} index={1} />
      <PlanMix data={data.planMix} index={2} />
      <HealthDist data={data.healthDistribution} active={health} onPick={onHealth} index={3} />
      {sources ? <Sources data={sources} index={4} /> : null}
      <Renewals data={data.renewals} index={5} className={sources ? 'md:col-span-1 xl:col-span-6' : 'md:col-span-2 xl:col-span-12'} />
    </div>
  );
}
