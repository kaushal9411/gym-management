'use client';

import * as React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { formatMoney } from '@/features/members/components/detail/detail-ui';
import { useCurrencySymbol } from '@/lib/currency';
import type { MemberPaymentStatus, PaymentAnalytics } from '../../types';
import { METHOD_LABELS, PAYMENT_METHOD_COLORS, PAYMENT_STATUS_META } from '../finance-badges';
import { DeltaText, Donut, PanelCard, compactMoney, num, pctChange } from './payments-ui';

interface PanelProps {
  analytics?: PaymentAnalytics;
  loading: boolean;
  error: boolean;
}

const AXIS_TICK = { fill: 'var(--muted-foreground)', fontSize: 11 };

// ── Payment methods donut ─────────────────────────────────────────────────

const DIGITAL = new Set(['UPI', 'ONLINE_GATEWAY', 'CREDIT_CARD', 'DEBIT_CARD']);

export function MethodDonutPanel({ analytics, loading, error }: PanelProps) {
  const sym = useCurrencySymbol();
  const methods = [...(analytics?.methods ?? [])].filter((m) => num(m.amount) > 0).sort((a, b) => num(b.amount) - num(a.amount));
  const total = methods.reduce((s, m) => s + num(m.amount), 0);
  const digital = methods.filter((m) => DIGITAL.has(m.method)).reduce((s, m) => s + num(m.amount), 0);
  return (
    <PanelCard title="Payment methods" subtitle="Share of collected amount" loading={loading} error={error} skeletonHeight={260} className="flex-[1_1_340px]">
      {total === 0 ? (
        <p className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">No collections in this period yet.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-center gap-[18px]">
            <Donut segments={methods.map((m) => ({ value: num(m.amount), color: PAYMENT_METHOD_COLORS[m.method] }))}>
              <span className="text-[11px] font-bold uppercase text-muted-foreground">Total</span>
              <span className="text-base font-extrabold">{compactMoney(sym, total)}</span>
            </Donut>
            <div className="flex min-w-[150px] flex-1 flex-col gap-[9px] text-[13px] font-semibold">
              {methods.map((m) => (
                <div key={m.method} className="flex justify-between gap-2.5">
                  <span className="inline-flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ backgroundColor: PAYMENT_METHOD_COLORS[m.method] }} />
                    {METHOD_LABELS[m.method]}
                  </span>
                  <b className="tabular-nums">{Math.round((num(m.amount) / total) * 100)}%</b>
                </div>
              ))}
            </div>
          </div>
          {/* The design also shows "up N pts on last month" — the analytics contract has no previous-period method split, so only the current share is shown. */}
          <p className="mt-3.5 rounded-xl bg-primary/10 px-3.5 py-3 text-[12.5px] font-semibold text-primary">
            Digital share (UPI + online + cards) is <b>{Math.round((digital / total) * 100)}%</b> of collections.
          </p>
        </>
      )}
    </PanelCard>
  );
}

// ── Weekly compare bars ───────────────────────────────────────────────────

export function WeeklyComparePanel({ analytics, loading, error, compare, previousLabel }: PanelProps & { compare: boolean; previousLabel: string }) {
  const sym = useCurrencySymbol();
  const data = React.useMemo(() => {
    const daily = analytics?.daily ?? [];
    const out: { label: string; current: number; previous: number }[] = [];
    for (let i = 0; i < daily.length; i += 7) {
      const chunk = daily.slice(i, i + 7);
      out.push({ label: `Wk ${i / 7 + 1}`, current: chunk.reduce((s, d) => s + num(d.collected), 0), previous: chunk.reduce((s, d) => s + num(d.previousCollected), 0) });
    }
    return out;
  }, [analytics]);
  const empty = data.every((d) => d.current === 0 && d.previous === 0);
  return (
    <PanelCard title={compare ? 'This period vs previous' : 'Weekly collections'} subtitle="Collected per week" loading={loading} error={error} skeletonHeight={220} className="flex-[1_1_380px]">
      {empty ? (
        <p className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">No collections in this period yet.</p>
      ) : (
        <>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={4}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => compactMoney(sym, v)} />
                <Tooltip
                  cursor={{ fill: 'var(--accent)', opacity: 0.5 }}
                  contentStyle={{ background: 'var(--popover)', color: 'var(--popover-foreground)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }}
                  formatter={(value: number, name: string) => [formatMoney(sym, value), name]}
                />
                <Bar dataKey="current" name="This period" fill="var(--chart-1)" radius={[6, 6, 0, 0]} maxBarSize={26} />
                {compare ? <Bar dataKey="previous" name={previousLabel} fill="var(--muted-foreground)" fillOpacity={0.4} radius={[6, 6, 0, 0]} maxBarSize={26} /> : null}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1.5 flex gap-4 text-[12.5px] font-bold">
            <span className="inline-flex items-center gap-[7px]">
              <span className="size-2 rounded-full" style={{ background: 'var(--chart-1)' }} /> This period
            </span>
            {compare ? (
              <span className="inline-flex items-center gap-[7px]">
                <span className="size-2 rounded-full bg-muted-foreground/40" /> {previousLabel}
              </span>
            ) : null}
          </div>
        </>
      )}
    </PanelCard>
  );
}

// ── Branch comparison ─────────────────────────────────────────────────────

const BRANCH_COLORS = ['var(--chart-1)', 'var(--chart-7)', 'var(--chart-5)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'];

export function BranchComparePanel({ analytics, loading, error, compare }: PanelProps & { compare: boolean }) {
  const sym = useCurrencySymbol();
  const branches = [...(analytics?.branches ?? [])].sort((a, b) => num(b.revenue) - num(a.revenue));
  const max = Math.max(...branches.map((b) => num(b.revenue)), 1);
  return (
    <PanelCard title="Branch comparison" subtitle={compare ? 'Revenue and growth vs previous period' : 'Revenue by branch'} loading={loading} error={error} skeletonHeight={200} className="flex-[1_1_380px]">
      {branches.length === 0 ? (
        <p className="flex h-[160px] items-center justify-center text-sm text-muted-foreground">No branch revenue in this period yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {branches.map((b, i) => (
            <div key={b.branchId}>
              <div className="flex justify-between gap-2 text-[13px] font-bold">
                <span className="truncate">{b.name}</span>
                <span className="shrink-0 tabular-nums">
                  {formatMoney(sym, b.revenue)} {compare ? <DeltaText pct={pctChange(num(b.revenue), num(b.previousRevenue))} /> : null}
                </span>
              </div>
              <div className="mt-[7px] h-3 rounded-md bg-muted">
                <div className="h-full rounded-md" style={{ width: `${Math.max((num(b.revenue) / max) * 100, 1)}%`, background: BRANCH_COLORS[i % BRANCH_COLORS.length] }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </PanelCard>
  );
}

// ── Status & refunds ──────────────────────────────────────────────────────

const STATUS_ORDER: MemberPaymentStatus[] = ['SUCCESS', 'PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED', 'CANCELLED'];

export function StatusRefundPanel({ analytics, loading, error, compare }: PanelProps & { compare: boolean }) {
  const sym = useCurrencySymbol();
  const counts = new Map((analytics?.statuses ?? []).map((s) => [s.status, s.count]));
  const total = STATUS_ORDER.reduce((s, k) => s + (counts.get(k) ?? 0), 0);
  const refunded = analytics?.kpis.refunded;
  return (
    <PanelCard title="Status & refunds" subtitle={`All ${total} payment attempts in this period`} loading={loading} error={error} skeletonHeight={260} className="flex-[1_1_340px]">
      {total === 0 ? (
        <p className="flex h-[160px] items-center justify-center text-sm text-muted-foreground">No payments in this period yet.</p>
      ) : (
        <>
          <div className="flex h-4 gap-0.5 overflow-hidden rounded-lg">
            {STATUS_ORDER.filter((k) => (counts.get(k) ?? 0) > 0).map((k) => (
              <div key={k} title={`${PAYMENT_STATUS_META[k].label}: ${counts.get(k)}`} style={{ width: `${((counts.get(k) ?? 0) / total) * 100}%`, background: PAYMENT_STATUS_META[k].color, minWidth: 4 }} />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px] font-semibold">
            {STATUS_ORDER.map((k) => (
              <span key={k} className="flex justify-between">
                <span className="inline-flex items-center gap-2">
                  <span className="size-2 rounded-full" style={{ background: PAYMENT_STATUS_META[k].color }} />
                  {PAYMENT_STATUS_META[k].label}
                </span>
                <b className="tabular-nums">{counts.get(k) ?? 0}</b>
              </span>
            ))}
          </div>
          {refunded ? (
            <div className="mt-[18px] flex items-center justify-between gap-3 rounded-[14px] border p-3.5" style={{ borderColor: 'color-mix(in oklch, var(--destructive) 25%, transparent)', background: 'color-mix(in oklch, var(--destructive) 8%, transparent)' }}>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-destructive">Refund rate</div>
                <div className="text-[22px] font-extrabold tabular-nums text-destructive">{(refunded.rate * 100).toFixed(1)}%</div>
              </div>
              <div className="text-right text-[12.5px] font-bold text-destructive">
                {formatMoney(sym, refunded.value)} across
                <br />
                {refunded.count} refund{refunded.count === 1 ? '' : 's'}
                {compare ? <> · <DeltaText pct={pctChange(num(refunded.value), num(refunded.previous))} goodWhenDown /></> : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </PanelCard>
  );
}

// ── Top plans ─────────────────────────────────────────────────────────────

const PLAN_TONES = ['var(--chart-1)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

export function TopPlansPanel({ analytics, loading, error }: PanelProps) {
  const sym = useCurrencySymbol();
  const plans = (analytics?.topPlans ?? []).slice(0, 4);
  const collected = num(analytics?.kpis.collected.value);
  return (
    <PanelCard title="Top plans by revenue" subtitle="Payments linked to a membership plan" loading={loading} error={error} skeletonHeight={130} className="flex-[2_1_560px]">
      {plans.length === 0 ? (
        <p className="flex h-[110px] items-center justify-center text-sm text-muted-foreground">No plan-linked payments in this period yet.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
          {plans.map((p, i) => {
            const tone = PLAN_TONES[i % PLAN_TONES.length]!;
            return (
              <div key={p.planName} className="rounded-2xl p-4" style={{ backgroundImage: `linear-gradient(135deg, color-mix(in oklch, ${tone} 14%, transparent), color-mix(in oklch, ${tone} 4%, transparent))` }}>
                <div className="truncate text-xs font-bold uppercase tracking-wider text-muted-foreground">{p.planName}</div>
                <div className="my-1.5 text-[22px] font-extrabold tabular-nums">{formatMoney(sym, p.revenue)}</div>
                <div className="text-[12.5px] font-bold" style={{ color: `color-mix(in oklch, ${tone} 60%, var(--foreground))` }}>
                  {collected > 0 ? `${Math.min(Math.round((num(p.revenue) / collected) * 100), 100)}% of revenue · ` : ''}
                  {p.count} sold
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PanelCard>
  );
}

// ── Needs attention ───────────────────────────────────────────────────────

export function AttentionPanel({ analytics, loading, error, onStatus }: PanelProps & { onStatus: (s: MemberPaymentStatus) => void }) {
  const sym = useCurrencySymbol();
  const a = analytics?.attention;
  const rows = a
    ? [
        { n: a.pendingOver24h, text: 'Payments pending over 24h', color: 'var(--chart-4)', onClick: () => onStatus('PENDING') },
        { n: a.failed, text: 'Failed online payments to retry', color: 'var(--chart-8)', onClick: () => onStatus('FAILED') },
        { n: a.overdueInvoices.count, text: `Overdue invoices, ${formatMoney(sym, a.overdueInvoices.amount)} due`, color: 'var(--chart-1)' },
      ]
    : [];
  return (
    <PanelCard title="Needs attention" loading={loading} error={error} skeletonHeight={130} className="flex-[1_1_320px]">
      <div className="flex flex-col gap-2.5">
        {rows.map((r) => {
          const body = (
            <>
              <span className="inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-full px-2.5 text-xs font-bold" style={{ background: `color-mix(in oklch, ${r.color} 22%, transparent)`, color: `color-mix(in oklch, ${r.color} 60%, var(--foreground))` }}>
                {r.n}
              </span>
              <span className="text-left text-[13px] font-bold">{r.text}</span>
            </>
          );
          const cls = 'flex items-center gap-3 rounded-xl p-3';
          const style = { background: `color-mix(in oklch, ${r.color} 9%, transparent)` };
          return r.onClick && r.n > 0 ? (
            <button key={r.text} type="button" onClick={r.onClick} className={`${cls} transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`} style={style}>
              {body}
            </button>
          ) : (
            <div key={r.text} className={cls} style={style}>
              {body}
            </div>
          );
        })}
      </div>
    </PanelCard>
  );
}
