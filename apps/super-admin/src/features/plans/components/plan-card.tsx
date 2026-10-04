'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Check, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Bar, Chip } from '@/features/dashboard/components/ui';
import { fmtInt, fmtPct } from '@/features/dashboard/components/format';
import { PagerBar, TableScroll, tdClass, thClass } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { cn } from '@/lib/utils';
import { fmtPrice, fmtStorage, planAccent, yearlyDiscount } from '../lib/plan-utils';
import type { Plan } from '../types';
import { PlanActionButtons, PlanActionPanel, type PlanActionKind } from './plan-actions';

export interface CardHandlers {
  open: PlanActionKind | null;
  highlight: boolean;
  onAction: (k: PlanActionKind) => void;
  onEdit: () => void;
  onClose: () => void;
  onDuplicated: (p: Plan) => void;
}

const STATUS = (p: Plan) => <Chip tone={p.isActive ? 'green' : 'slate'}>{p.isActive ? 'Active' : 'Inactive'}</Chip>;

function Limit({ label, value }: { label: string; value: string }) {
  return <span className="rounded-md bg-secondary px-2 py-0.5 text-[11.5px] text-secondary-foreground"><b className="tabular-nums">{value}</b> {label}</span>;
}

export function PlanCard({ plan, index, h }: { plan: Plan; index: number; h: CardHandlers }) {
  const reduce = useReducedMotion();
  const [all, setAll] = React.useState(false);
  const ref = React.useRef<HTMLElement>(null);
  React.useEffect(() => { if (h.highlight) ref.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); }, [h.highlight, reduce]);
  const accent = planAccent(plan.slug);
  const s = plan.stats;
  const disc = yearlyDiscount(Number(plan.priceMonthly), Number(plan.priceYearly));
  const feats = all ? plan.features : plan.features.slice(0, 5);
  return (
    <motion.article
      ref={ref}
      aria-label={`${plan.name} plan`}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: reduce ? 0 : Math.min(index, 8) * 0.03, ease: 'easeOut' }}
      style={{ borderTopColor: accent }}
      className={cn('flex min-w-0 flex-col gap-3.5 rounded-[14px] border border-t-[3px] bg-card p-4 transition-shadow hover:shadow-md', h.highlight && 'ring-2 ring-primary', !plan.isActive && 'opacity-90')}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">{plan.name}</h3>
          <p className="truncate font-mono text-xs text-muted-foreground">{plan.slug}</p>
        </div>
        {STATUS(plan)}
      </header>

      <div>
        <p className="tabular-nums"><span className="text-[28px] font-semibold tracking-tight">{fmtPrice(plan.priceMonthly, plan.currency)}</span><span className="text-sm text-muted-foreground"> /mo · {plan.currency}</span></p>
        <p className="text-xs text-muted-foreground">
          or <b className="text-foreground">{fmtPrice(plan.priceYearly, plan.currency)}</b> /yr
          {disc !== null && disc > 0 ? <Chip tone="green" className="ml-1.5">save {fmtPct(disc)}</Chip> : null}
          <span className="ml-1.5">· {plan.trialDays}-day trial</span>
        </p>
        {plan.description ? <p className="mt-1.5 line-clamp-2 text-[13px] text-muted-foreground">{plan.description}</p> : null}
      </div>

      <div className="flex flex-wrap gap-1.5" aria-label="Limits">
        <Limit label="members" value={fmtInt(plan.maxMembers)} />
        <Limit label="staff" value={fmtInt(plan.maxStaff)} />
        <Limit label={plan.maxBranches === 1 ? 'branch' : 'branches'} value={fmtInt(plan.maxBranches)} />
        <Limit label="storage" value={fmtStorage(plan.maxStorageMb)} />
      </div>

      {plan.features.length > 0 ? (
        <div>
          <ul className="space-y-1 text-[13px]">
            {feats.map((f) => (
              <li key={f.key} className="flex items-start gap-1.5">
                {f.included ? <Check className="mt-0.5 size-3.5 shrink-0 text-green-700 dark:text-green-400" aria-label="Included" /> : <X className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-label="Not included" />}
                <span className={f.included ? '' : 'text-muted-foreground line-through'}>{f.label}</span>
              </li>
            ))}
          </ul>
          {plan.features.length > 5 ? <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className="mt-1 rounded text-xs font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring">{all ? 'Show less' : `+${plan.features.length - 5} more`}</button> : null}
        </div>
      ) : <p className="text-xs text-muted-foreground">No features listed.</p>}

      <div className="mt-auto space-y-2 border-t pt-3">
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div><dd className="text-lg font-semibold tabular-nums">{s ? fmtInt(s.activeSubscribers) : '—'}</dd><dt className="text-[11px] text-muted-foreground">Active</dt></div>
          <div><dd className="text-lg font-semibold tabular-nums">{s ? fmtInt(s.trialSubscribers) : '—'}</dd><dt className="text-[11px] text-muted-foreground">Trial</dt></div>
          <div><dd className="truncate text-lg font-semibold tabular-nums">{s ? fmtPrice(s.mrr, plan.currency) : '—'}</dd><dt className="text-[11px] text-muted-foreground">MRR</dt></div>
        </dl>
        <div title="Share of MRR in this currency"><Bar pct={(s?.share ?? 0) * 100} color={accent} /><p className="mt-1 text-[11px] text-muted-foreground">{fmtPct((s?.share ?? 0) * 100)} of MRR</p></div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <PlanActionButtons plan={plan} open={h.open} onToggle={h.onAction} onEdit={h.onEdit} />
        <Button asChild size="sm"><Link href={`/plans/${plan.id}`}>View<ArrowUpRight className="size-3.5" aria-hidden /></Link></Button>
      </div>
      {h.open && h.open !== 'edit' ? <PlanActionPanel plan={plan} kind={h.open} onClose={h.onClose} onDuplicated={h.onDuplicated} /> : null}
    </motion.article>
  );
}

export type SortKey = 'order' | 'mrr' | 'subs' | 'price';
export function PlansTable({ plans, handlers, sort }: { plans: Plan[]; handlers: (p: Plan) => CardHandlers; sort: SortKey }) {
  const ariaSort = (k: SortKey) => (sort === k ? ('descending' as const) : undefined);
  return (
    <div className="rounded-[14px] border bg-card px-4 pb-3 pt-3">
      <TableScroll label="Plans table">
        <table className="w-full min-w-[820px] border-collapse">
          <thead>
            <tr>
              <th scope="col" className={thClass}>Plan</th>
              <th scope="col" className={thClass}>Status</th>
              <th scope="col" aria-sort={ariaSort('price')} className={thClass}>Monthly</th>
              <th scope="col" className={thClass}>Yearly</th>
              <th scope="col" className={thClass}>Trial</th>
              <th scope="col" aria-sort={ariaSort('subs')} className={thClass}>Active / trial</th>
              <th scope="col" aria-sort={ariaSort('mrr')} className={thClass}>MRR</th>
              <th scope="col" className={thClass}>Share</th>
              <th scope="col" className={`${thClass} relative`}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => {
              const h = handlers(p);
              const accent = planAccent(p.slug);
              return (
                <React.Fragment key={p.id}>
                  <tr className={cn(h.highlight && 'bg-primary/5')}>
                    <td className={tdClass}><span className="flex items-center gap-2"><i className="size-2.5 shrink-0 rounded-sm" style={{ background: accent }} aria-hidden /><span><Link href={`/plans/${p.id}`} className="font-semibold hover:underline">{p.name}</Link><span className="block font-mono text-[11px] text-muted-foreground">{p.slug}</span></span></span></td>
                    <td className={tdClass}>{STATUS(p)}</td>
                    <td className={cn(tdClass, 'tabular-nums')}>{fmtPrice(p.priceMonthly, p.currency)}</td>
                    <td className={cn(tdClass, 'tabular-nums')}>{fmtPrice(p.priceYearly, p.currency)}</td>
                    <td className={cn(tdClass, 'tabular-nums')}>{p.trialDays}d</td>
                    <td className={cn(tdClass, 'tabular-nums')}>{p.stats ? `${fmtInt(p.stats.activeSubscribers)} / ${fmtInt(p.stats.trialSubscribers)}` : '—'}</td>
                    <td className={cn(tdClass, 'tabular-nums')}>{p.stats ? fmtPrice(p.stats.mrr, p.currency) : '—'}</td>
                    <td className={cn(tdClass, 'w-28')}><Bar pct={(p.stats?.share ?? 0) * 100} color={accent} /></td>
                    <td className={tdClass}><div className="flex flex-wrap gap-1.5"><PlanActionButtons plan={p} open={h.open} onToggle={h.onAction} onEdit={h.onEdit} /></div></td>
                  </tr>
                  {h.open && h.open !== 'edit' ? <tr><td colSpan={9} className="border-b p-3"><PlanActionPanel plan={p} kind={h.open} onClose={h.onClose} onDuplicated={h.onDuplicated} /></td></tr> : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </TableScroll>
      <PagerBar page={1} totalPages={1} total={plans.length} onPage={() => undefined} />
    </div>
  );
}
