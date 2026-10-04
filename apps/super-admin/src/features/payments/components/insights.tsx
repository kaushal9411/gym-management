'use client';

/**
 * Range-aware insight area for /payments. Data: GET /admin/payments/overview?range=. Everything shown is backed by that payload.
 * Dropped on purpose: refund / retry actions (no endpoints); sparklines on KPIs (the daily series is not per-KPI).
 */
import * as React from 'react';
import Link from 'next/link';
import { useReducedMotion } from 'framer-motion';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Bar as RBar, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toBillingError } from '@/features/billing/hooks/use-billing';
import { KpiCard } from '@/features/dashboard/components/kpi-card';
import { fmtCompact, fmtInt, shortDate } from '@/features/dashboard/components/format';
import { Bar, ChartTooltip, Chip, EmptyNote, Panel } from '@/features/dashboard/components/ui';
import { ErrorNote, money, statusLabel } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { useVerifyAnyPayment, type PaymentsOverview } from '../api/insights';
import { LINK, StatusChip, relTime } from './pay-kit';

const AXIS = { fontSize: 11, fill: 'var(--muted-foreground)' } as const;
const STATUS_COLOR: Record<string, string> = { SUCCEEDED: 'var(--chart-6)', PENDING: 'var(--chart-4)', FAILED: 'var(--chart-5)', REFUNDED: 'var(--chart-3)', PARTIALLY_REFUNDED: 'var(--chart-2)' };

function DailyChart({ data }: { data: PaymentsOverview['daily'] }) {
  const reduce = !!useReducedMotion();
  if (!data.some((d) => d.succeeded || d.failed)) return <EmptyNote>No payment attempts in this range.</EmptyNote>;
  const rows = data.map((d) => ({ ...d, label: shortDate(d.date) }));
  return (
    <div className="h-[240px] w-full" role="img" aria-label="Daily succeeded and failed payments with previous period succeeded line">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
          <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.5 }} content={<ChartTooltip fmt={(v) => fmtInt(v)} names={{ succeeded: 'Succeeded', failed: 'Failed', previousSucceeded: 'Previous period (succeeded)' }} />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} formatter={(v: string) => ({ succeeded: 'Succeeded', failed: 'Failed', previousSucceeded: 'Previous period' }[v] ?? v)} />
          <RBar dataKey="succeeded" stackId="a" fill="var(--chart-6)" maxBarSize={22} isAnimationActive={!reduce} animationDuration={250} />
          <RBar dataKey="failed" stackId="a" fill="var(--chart-5)" radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={!reduce} animationDuration={250} />
          <Line dataKey="previousSucceeded" type="monotone" stroke="var(--chart-7)" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={!reduce} animationDuration={250} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatusDonut({ mix }: { mix: PaymentsOverview['statusMix'] }) {
  const reduce = !!useReducedMotion();
  const total = mix.reduce((a, m) => a + m.count, 0);
  if (total === 0) return <EmptyNote>No payments yet.</EmptyNote>;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative h-[150px] w-[150px] shrink-0" role="img" aria-label={`Status mix: ${mix.map((m) => `${statusLabel(m.status)} ${m.count}`).join(', ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={mix.filter((m) => m.count > 0)} dataKey="count" nameKey="status" innerRadius={46} outerRadius={70} paddingAngle={2} stroke="none" isAnimationActive={!reduce} animationDuration={250}>
              {mix.filter((m) => m.count > 0).map((m) => <Cell key={m.status} fill={STATUS_COLOR[m.status] ?? 'var(--chart-7)'} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><p className="text-lg font-semibold tabular-nums">{fmtInt(total)}</p><p className="text-[11px] text-muted-foreground">payments</p></div></div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1 text-xs">
        {mix.map((m) => (
          <li key={m.status} className="flex items-center gap-2">
            <i className="size-2 shrink-0 rounded-sm" style={{ background: STATUS_COLOR[m.status] ?? 'var(--chart-7)' }} aria-hidden />
            <span className="flex-1 truncate text-muted-foreground">{statusLabel(m.status)}</span>
            <b className="tabular-nums">{fmtInt(m.count)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BarList({ rows, color, empty }: { rows: Array<{ key: string; label: string; pct: number; value: string; sub?: string }>; color: string; empty: string }) {
  if (rows.length === 0) return <EmptyNote>{empty}</EmptyNote>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
            <span className="min-w-0 truncate font-medium" title={r.label}>{r.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground"><b className="text-foreground">{r.value}</b>{r.sub ? ` · ${r.sub}` : ''}</span>
          </div>
          <Bar pct={r.pct} color={color} />
        </li>
      ))}
    </ul>
  );
}

type Verdict = { tone: 'green' | 'red' | 'amber'; text: string };

function StuckList({ rows, canManage, now }: { rows: PaymentsOverview['pendingStuck']; canManage: boolean; now: number | null }) {
  const verify = useVerifyAnyPayment();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [res, setRes] = React.useState<Record<string, Verdict>>({});
  if (rows.length === 0) return <EmptyNote>Nothing stuck — no payment has been pending for more than 24 h.</EmptyNote>;
  const check = (paymentId: string, tenantId: string) => {
    setBusy(paymentId);
    verify.mutate({ tenantId, paymentId }, {
      onSuccess: (r) => setRes((p) => ({ ...p, [paymentId]: { tone: r.status === 'SUCCEEDED' ? 'green' : r.status === 'FAILED' ? 'red' : 'amber', text: statusLabel(r.status) } })),
      onError: (e) => { setRes((p) => ({ ...p, [paymentId]: { tone: 'red', text: 'Check failed' } })); toast.error(toBillingError(e).message); },
      onSettled: () => setBusy(null),
    });
  };
  return (
    <ul className="divide-y">
      {rows.map((r) => {
        const tid = 'id' in r.tenant ? r.tenant.id : null;
        const v = res[r.paymentId];
        return (
          <li key={r.paymentId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[13px]">
            <div className="min-w-0 flex-1">
              <p className="truncate">{tid ? <Link href={`/tenants/${tid}`} className={LINK}>{r.tenant.name}</Link> : <span className="font-medium">{r.tenant.name}</span>}</p>
              <p className="text-xs text-muted-foreground"><Link href={`/payments/${r.paymentId}`} className="hover:underline">{money(r.amount, r.currency)}</Link> · pending {Math.round(r.ageHours)} h · {relTime(r.createdAt, now)}</p>
            </div>
            {v ? <Chip tone={v.tone}>{v.text}</Chip> : null}
            {canManage && tid ? (
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => check(r.paymentId, tid)} aria-label={`Check status for ${r.tenant.name}`}>
                {busy === r.paymentId ? <Loader2 className="animate-spin" /> : null}Check status
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function FailureList({ rows, now }: { rows: PaymentsOverview['recentFailures']; now: number | null }) {
  if (rows.length === 0) return <EmptyNote>No failed payments in this range.</EmptyNote>;
  return (
    <ul className="divide-y">
      {rows.map((r) => {
        const tid = 'id' in r.tenant ? r.tenant.id : null;
        return (
          <li key={r.paymentId} className="py-2 text-[13px]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate">{tid ? <Link href={`/tenants/${tid}`} className={LINK}>{r.tenant.name}</Link> : <b>{r.tenant.name}</b>}</span>
              <Link href={`/payments/${r.paymentId}`} className="shrink-0 font-semibold tabular-nums hover:underline">{money(r.amount, r.currency)}</Link>
            </div>
            <p className="truncate text-xs text-muted-foreground" title={r.reason ?? undefined}>{r.reason ?? 'No reason recorded'} · {relTime(r.at, now)}</p>
          </li>
        );
      })}
    </ul>
  );
}

export function Insights({ data, isLoading, isError, error, onRetry, canManage, now }: {
  data?: PaymentsOverview; isLoading: boolean; isError: boolean; error?: string; onRetry: () => void; canManage: boolean; now: number | null;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading insights">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[96px] rounded-[14px]" />)}</div>
        <Skeleton className="h-[300px] rounded-[14px]" />
      </div>
    );
  }
  if (isError || !data) return <ErrorNote what="payment insights" message={error} onRetry={onRetry} />;
  const k = data.kpis;
  const cur = data.currency ?? 'INR';
  const maxMode = Math.max(1, ...data.byMode.map((m) => m.count));
  const maxReason = Math.max(1, ...data.failureReasons.map((m) => m.count));
  return (
    <div className="space-y-4">
      {data.currencyNote ? <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><AlertTriangle className="size-3.5 text-amber-600" aria-hidden />{data.currencyNote}</p> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard index={0} label="Collected" value={k.collected.value} previous={k.collected.previous} format={(v) => money(Math.round(v), cur)} color="var(--chart-6)" />
        <KpiCard index={1} label="Succeeded" value={k.succeededCount.value} previous={k.succeededCount.previous} format={fmtInt} color="var(--chart-1)" caption="vs prev" />
        <KpiCard index={2} label="Failed" value={k.failedCount.value} previous={k.failedCount.previous} format={fmtInt} invert color="var(--chart-5)" />
        <KpiCard index={3} label="Success rate" value={k.successRate.value * 100} previous={k.successRate.previous * 100} format={(v) => `${(Math.round(v * 10) / 10).toString()}%`} deltaMode="abs" absSuffix=" pts" color="var(--chart-2)" />
        <KpiCard index={4} label="Pending now" value={k.pending.count} format={fmtInt} caption={`${money(k.pending.amount, cur)} awaiting`} fallbackCaption={`${money(k.pending.amount, cur)} awaiting`} color="var(--chart-4)" />
        <KpiCard index={5} label="Avg ticket" value={k.avgTicket?.value ?? 0} format={(v) => (k.avgTicket ? money(Math.round(v), cur) : '—')} fallbackCaption={k.avgTicket ? 'per succeeded payment' : 'no succeeded payments'} color="var(--chart-3)" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
        <Panel title="Succeeded vs failed" hint="per day" className="md:col-span-2 xl:col-span-8" index={0}><DailyChart data={data.daily} /></Panel>
        <Panel title="Status mix" className="xl:col-span-4" index={1}><StatusDonut mix={data.statusMix} /></Panel>
        <Panel title="By provider" hint="success rate" className="xl:col-span-4" index={2}>
          <BarList color="var(--chart-1)" empty="No provider activity." rows={data.byProvider.map((p) => ({ key: p.provider, label: statusLabel(p.provider), pct: p.successRate * 100, value: `${Math.round(p.successRate * 1000) / 10}%`, sub: `${fmtInt(p.count)} attempts · ${fmtCompact(p.amount)}` }))} />
        </Panel>
        <Panel title="By payment mode" hint="attempts" className="xl:col-span-4" index={3}>
          <BarList color="var(--chart-2)" empty="No payments in this range." rows={data.byMode.map((m) => ({ key: m.mode, label: statusLabel(m.mode), pct: (m.count / maxMode) * 100, value: fmtInt(m.count), sub: fmtCompact(m.amount) }))} />
        </Panel>
        <Panel title="Failure reasons" className="md:col-span-2 xl:col-span-4" index={4}>
          <BarList color="var(--chart-5)" empty="No failures in this range." rows={data.failureReasons.map((m) => ({ key: m.reason, label: m.reason, pct: (m.count / maxReason) * 100, value: fmtInt(m.count), sub: fmtCompact(m.amount) }))} />
        </Panel>
        <Panel title="Needs attention: stuck pending" hint="> 24 h" className="xl:col-span-6" index={5} right={data.pendingStuck.length ? <StatusChip status="PENDING" /> : null}>
          <StuckList rows={data.pendingStuck} canManage={canManage} now={now} />
        </Panel>
        <Panel title="Needs attention: recent failures" className="xl:col-span-6" index={6} right={data.recentFailures.length ? <StatusChip status="FAILED" /> : null}>
          <FailureList rows={data.recentFailures} now={now} />
        </Panel>
      </div>
    </div>
  );
}
