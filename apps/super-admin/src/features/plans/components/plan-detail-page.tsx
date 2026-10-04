'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useReducedMotion } from 'framer-motion';
import { ArrowLeft, Check, X } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { Skeleton } from '@/components/ui/skeleton';
import { notifyProgrammaticNavigation } from '@/components/navigation-progress-provider';
import { Input } from '@/components/ui/input';
import { actionColor, fmtInt, fmtPct, timeAgo } from '@/features/dashboard/components/format';
import { KpiCard } from '@/features/dashboard/components/kpi-card';
import { ChartTooltip, Chip, EmptyNote, Panel } from '@/features/dashboard/components/ui';
import { useNow } from '@/features/dashboard/components/use-now';
import { ErrorNote } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { usePlanOverview, usePriceImpact } from '../api/insights';
import { toPlanError } from '../hooks/use-plans';
import { compactMoney, fmtPrice, fmtStorage, LIMIT_FIELDS, planAccent, useDebounced, yearlyDiscount } from '../lib/plan-utils';
import type { Plan } from '../types';
import { GrowBar } from './bars';
import { BANNER_BTN, PageBanner } from './banner';
import { ImpactView } from './impact-view';
import { PlanActionButtons, PlanActionPanel, usePlanActionState } from './plan-actions';
import { PlanForm } from './plan-form';
import { RenewalsChart } from './plans-insights';
import { SubscribersTable } from './subscribers-table';

/*
 * Dropped (no backing data): plan versioning / grandfathering; before/after diffs in "Recent changes" (the audit log stores `after` only,
 * so the API summary lists the fields that were sent).
 */
const STATUS_COLOR: Record<string, string> = { ACTIVE: 'var(--chart-6)', TRIALING: 'var(--chart-2)', PAST_DUE: 'var(--chart-4)', GRACE: 'var(--chart-8)', SUSPENDED: 'var(--chart-5)', CANCELED: 'var(--chart-7)', CANCELLED: 'var(--chart-7)', EXPIRED: 'var(--chart-7)' };
const label = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

function Simulator({ plan }: { plan: Plan }) {
  const [m, setM] = React.useState(String(Number(plan.priceMonthly)));
  const [y, setY] = React.useState(String(Number(plan.priceYearly)));
  const dm = useDebounced(m);
  const dy = useDebounced(y);
  const nm = dm.trim() === '' ? NaN : Number(dm);
  const ny = dy.trim() === '' ? NaN : Number(dy);
  const mOk = nm >= 0 && nm !== Number(plan.priceMonthly);
  const yOk = ny >= 0 && ny !== Number(plan.priceYearly);
  const impact = usePriceImpact(plan.id, { priceMonthly: mOk ? nm : undefined, priceYearly: yOk ? ny : undefined }, mOk || yOk);
  const disc = yearlyDiscount(Number(m), Number(y));
  return (
    <Panel title="Simulate a price change" hint="read-only" index={4} className="lg:col-span-2">
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label htmlFor="sim-m" className="mb-1 block text-xs font-medium text-muted-foreground">Monthly price ({plan.currency})</label><Input id="sim-m" type="number" min={0} step="0.01" className="h-9" value={m} onChange={(e) => setM(e.target.value)} /></div>
        <div><label htmlFor="sim-y" className="mb-1 block text-xs font-medium text-muted-foreground">Yearly price ({plan.currency})</label><Input id="sim-y" type="number" min={0} step="0.01" className="h-9" value={y} onChange={(e) => setY(e.target.value)} /></div>
        <p className="self-end pb-2 text-sm" aria-live="polite">{disc === null ? '—' : <>Yearly saving <b>{fmtPct(disc)}</b></>}</p>
      </div>
      <div className="mt-3"><ImpactView data={mOk || yOk ? impact.data : undefined} loading={impact.isFetching} error={impact.isError ? toPlanError(impact.error).message : undefined} currency={plan.currency} /></div>
      <p className="mt-3 text-xs text-muted-foreground">This does not change anything until you save in Edit.</p>
    </Panel>
  );
}

export function PlanDetailPage() {
  const params = useParams<{ planId: string }>();
  const router = useRouter();
  const reduce = useReducedMotion();
  const q = usePlanOverview(params.planId);
  const now = useNow();
  const act = usePlanActionState();
  const [editing, setEditing] = React.useState(false);

  if (q.isError) {
    return (
      <div className="mx-auto max-w-[1600px] space-y-4">
        <Link href="/plans" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"><ArrowLeft className="size-4" aria-hidden />Back to plans</Link>
        <ErrorNote what="this plan" message={toPlanError(q.error).message} onRetry={() => void q.refetch()} />
      </div>
    );
  }
  if (q.isPending) {
    return (
      <div className="mx-auto max-w-[1600px] space-y-4" aria-busy="true" aria-label="Loading plan">
        <Skeleton className="h-28 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[88px] rounded-[14px]" />)}</div>
        <div className="grid gap-3 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-60 rounded-[14px]" />)}</div>
      </div>
    );
  }

  const o = q.data;
  const plan: Plan = { ...o.plan, stats: o.stats };
  const accent = planAccent(plan.slug);
  const disc = yearlyDiscount(Number(plan.priceMonthly), Number(plan.priceYearly));
  const cur = plan.currency;
  const active = o.stats.activeSubscribers;
  const arpa = active > 0 ? Number(o.stats.mrr) / active : 0;
  const totalSubs = o.stats.activeSubscribers + o.stats.trialSubscribers + o.stats.pastDueSubscribers;
  const statusRows = o.subscribersByStatus.filter((s) => s.count > 0).map((s) => ({ name: label(s.status), value: s.count, color: STATUS_COLOR[s.status] ?? 'var(--chart-7)' }));
  const statusTotal = statusRows.reduce((a, r) => a + r.value, 0);
  const cycleTotal = o.subscribersByCycle.reduce((a, c) => a + c.count, 0);
  const goPlans = () => { notifyProgrammaticNavigation('/plans'); router.push('/plans'); };

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <PageBanner
        above={<Link href="/plans" className="mb-1.5 inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-teal-100 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white"><ArrowLeft className="size-3.5" aria-hidden />All plans</Link>}
        title={<span className="flex flex-wrap items-center gap-2.5">{plan.name}<Chip tone={plan.isActive ? 'green' : 'slate'}>{plan.isActive ? 'Active' : 'Inactive'}</Chip></span>}
        subtitle={<><span className="font-mono">{plan.slug}</span>{plan.description ? ` · ${plan.description}` : ''}</>}
        chips={<>
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold tabular-nums">{fmtPrice(plan.priceMonthly, cur)} /mo</span>
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold tabular-nums">{fmtPrice(plan.priceYearly, cur)} /yr{disc !== null && disc > 0 ? ` · save ${fmtPct(disc)}` : ''}</span>
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold">{plan.trialDays}-day trial</span>
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold">{cur}</span>
        </>}
      >
        <PlanActionButtons banner plan={plan} open={editing ? 'edit' : act.open} onToggle={(k) => { setEditing(false); act.toggleOpen(k); }} onEdit={() => { act.setOpen(null); setEditing((e) => !e); }} />
        <Link href="/plans" className={BANNER_BTN}>Back to plans</Link>
      </PageBanner>

      {editing ? <PlanForm key={`${plan.id}-${plan.priceMonthly}-${plan.priceYearly}-${plan.name}`} mode={plan} onClose={() => setEditing(false)} /> : null}
      {act.open && act.open !== 'edit' ? (
        <PlanActionPanel plan={plan} kind={act.open} onClose={() => act.setOpen(null)} onDeleted={goPlans} onDuplicated={(np) => { notifyProgrammaticNavigation(`/plans/${np.id}`); router.push(`/plans/${np.id}`); }} />
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard index={0} label="Active subscribers" value={o.stats.activeSubscribers} format={fmtInt} color="var(--chart-6)" caption="paying" />
        <KpiCard index={1} label="Trial subscribers" value={o.stats.trialSubscribers} format={fmtInt} color="var(--chart-2)" caption="not yet billed" />
        <KpiCard index={2} label="Past due / grace" value={o.stats.pastDueSubscribers} format={fmtInt} color="var(--chart-4)" caption={o.stats.pastDueSubscribers ? 'needs follow-up' : 'all clear'} />
        <KpiCard index={3} label={`MRR (${cur})`} value={Number(o.stats.mrr)} format={(v) => compactMoney(v, cur)} color={accent} caption="this plan" />
        <KpiCard index={4} label="MRR share" value={o.stats.share * 100} format={fmtPct} color="var(--chart-3)" caption={`of ${cur} MRR`} />
        <KpiCard index={5} label={`ARPA (${cur})`} value={arpa} format={(v) => compactMoney(v, cur)} color="var(--chart-1)" caption={active ? 'MRR ÷ active' : 'no active subscribers'} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Subscribers by status" hint={`${fmtInt(totalSubs)} live`} index={1}>
          {statusTotal === 0 ? <EmptyNote>No subscribers yet.</EmptyNote> : (
            <div className="flex items-center gap-4">
              <div className="size-[140px] shrink-0" role="img" aria-label={`Subscribers by status: ${statusRows.map((r) => `${r.name} ${r.value}`).join(', ')}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip content={<ChartTooltip fmt={fmtInt} />} />
                    <Pie data={statusRows} dataKey="value" nameKey="name" innerRadius={42} outerRadius={64} paddingAngle={2} stroke="none" isAnimationActive={!reduce} animationDuration={250}>
                      {statusRows.map((r) => <Cell key={r.name} fill={r.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="min-w-0 flex-1 space-y-1.5 text-[13px]">
                {statusRows.map((r) => <li key={r.name} className="flex items-center gap-2"><i className="size-2.5 shrink-0 rounded-sm" style={{ background: r.color }} aria-hidden /><span className="min-w-0 flex-1 truncate">{r.name}</span><b className="tabular-nums">{fmtInt(r.value)}</b></li>)}
              </ul>
            </div>
          )}
        </Panel>

        <Panel title="Billing cycle" hint="active subscribers" index={2}>
          {cycleTotal === 0 ? <EmptyNote>No active subscribers.</EmptyNote> : (
            <ul className="space-y-3.5">
              {o.subscribersByCycle.map((c, i) => (
                <li key={c.cycle}>
                  <div className="mb-1 flex justify-between text-[13px]"><span className="font-medium">{label(c.cycle)}</span><span className="tabular-nums text-muted-foreground"><b className="text-foreground">{fmtInt(c.count)}</b> · {fmtPct((c.count / cycleTotal) * 100)}</span></div>
                  <GrowBar pct={(c.count / cycleTotal) * 100} color={c.cycle === 'YEARLY' ? 'var(--chart-3)' : 'var(--chart-1)'} delay={i * 0.03} height={10} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Upcoming renewals" hint="next 8 weeks" index={3} className="lg:col-span-2 xl:col-span-1">
          <RenewalsChart data={o.upcomingRenewals} currency={cur} color={accent} />
        </Panel>

        <Simulator key={`${plan.priceMonthly}-${plan.priceYearly}`} plan={plan} />

        <Panel title="Coupons used" hint="top 5 by paid invoices" index={5}>
          {o.couponsUsed.length === 0 ? <EmptyNote>No coupon redemptions on this plan.</EmptyNote> : (
            <ul className="space-y-2">
              {o.couponsUsed.map((c) => <li key={c.code} className="flex items-center justify-between gap-2 text-[13px]"><code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">{c.code}</code><span className="tabular-nums text-muted-foreground"><b className="text-foreground">{c.redemptions}</b> redemption{c.redemptions === 1 ? '' : 's'}</span></li>)}
            </ul>
          )}
        </Panel>

        <Panel title="Limits" index={6}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            {LIMIT_FIELDS.map((l) => (
              <div key={l.key}><dt className="text-xs text-muted-foreground">{l.label}</dt><dd className="text-sm font-semibold tabular-nums">{l.key === 'maxStorageMb' ? fmtStorage(plan.maxStorageMb) : fmtInt(plan[l.key])}</dd></div>
            ))}
          </dl>
        </Panel>

        <Panel title="Features" hint={`${plan.features.filter((f) => f.included).length} of ${plan.features.length} included`} index={7}>
          {plan.features.length === 0 ? <EmptyNote>No features listed.</EmptyNote> : (
            <ul className="grid gap-1.5 text-[13px]">
              {plan.features.map((f) => (
                <li key={f.key} className="flex items-start gap-1.5">
                  {f.included ? <Check className="mt-0.5 size-3.5 shrink-0 text-green-700 dark:text-green-400" aria-label="Included" /> : <X className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-label="Not included" />}
                  <span className={f.included ? '' : 'text-muted-foreground line-through'}>{f.label}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent changes" hint="audit log" index={7} className="lg:col-span-2 xl:col-span-1">
          {o.recentChanges.length === 0 ? <EmptyNote>No recorded changes.</EmptyNote> : (
            <ol className="space-y-3 border-l pl-3.5">
              {o.recentChanges.map((c, i) => (
                <li key={`${c.at}-${i}`} className="relative">
                  <i className="absolute -left-[19px] top-1.5 size-2 rounded-full ring-2 ring-card" style={{ background: actionColor(c.action) }} aria-hidden />
                  <p className="text-[13px] font-semibold">{c.action}</p>
                  <p className="break-words text-xs text-muted-foreground">{c.summary}</p>
                  <p className="text-[11px] text-muted-foreground">{c.actor ?? 'system'} · {now === null ? c.at.slice(0, 10) : timeAgo(new Date(c.at).getTime(), now)}</p>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <SubscribersTable plan={plan} total={totalSubs} />
    </div>
  );
}
