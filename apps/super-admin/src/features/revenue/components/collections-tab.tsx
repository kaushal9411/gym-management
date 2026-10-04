'use client';

import Link from 'next/link';
import { useReducedMotion } from 'framer-motion';
import { Bar as RBar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { fmtInt } from '@/features/dashboard/components/format';
import { ChartTooltip, Chip, EmptyNote, Panel } from '@/features/dashboard/components/ui';
import { fmtDate, money, TableScroll, tdClass, thClass } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { AGING_COLORS, AXIS, GRID, GrowBar, moneyCompact, num, type TabData } from './common';

/** Days from now (UTC midnight-agnostic, rounded up) until `iso`. */
function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function CollectionsTab({ data }: TabData) {
  const reduce = !!useReducedMotion();
  const cur = data.currency;
  const reasons = data.failureReasons;
  const rMax = Math.max(1, ...reasons.map((r) => r.count));
  const aging = data.invoiceAging.map((a) => ({ ...a, amountN: num(a.amount) }));
  const agingEmpty = aging.every((a) => a.count === 0);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
      <Panel title="Failure reasons" hint="failed payments in range" index={0} className="xl:col-span-5">
        {reasons.length === 0 ? <EmptyNote>No failed payments in this range.</EmptyNote> : (
          <ul className="space-y-3">
            {reasons.map((r) => (
              <li key={r.reason}>
                <div className="mb-1 flex items-baseline gap-2 text-[13px]">
                  <span className="min-w-0 truncate font-medium" title={r.reason}>{r.reason}</span>
                  <b className="ml-auto shrink-0 tabular-nums">{fmtInt(r.count)}</b>
                  <span className="w-[84px] shrink-0 text-right text-xs tabular-nums text-muted-foreground">{money(r.amount, cur)}</span>
                </div>
                <GrowBar pct={(r.count / rMax) * 100} color="var(--chart-5)" />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Invoice aging"
        hint="open invoices by due date"
        index={1}
        className="xl:col-span-7"
        right={<Link href="/payments?tab=invoices" className="rounded text-xs font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">Open invoices</Link>}
      >
        {agingEmpty ? <EmptyNote>No open invoices.</EmptyNote> : (
          <>
            <div className="h-[190px] w-full" role="img" aria-label={`Invoice aging: ${aging.map((a) => `${a.bucket} days ${a.count} invoices`).join(', ')}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aging} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="bucket" tick={AXIS} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => moneyCompact(v, cur)} />
                  <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.5 }} content={<ChartTooltip fmt={(v) => money(v, cur)} names={{ amountN: 'Outstanding' }} />} />
                  <RBar dataKey="amountN" radius={[4, 4, 0, 0]} isAnimationActive={!reduce} animationDuration={250}>
                    {aging.map((a) => <Cell key={a.bucket} fill={AGING_COLORS[a.bucket]} />)}
                  </RBar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {aging.map((a) => (
                <li key={a.bucket} className="rounded-lg border px-2.5 py-2 text-xs" style={{ borderTop: `3px solid ${AGING_COLORS[a.bucket]}` }}>
                  <span className="text-muted-foreground">{a.bucket === 'Current' ? 'Current' : `${a.bucket} days`}</span>
                  <b className="block text-[13px] tabular-nums">{money(a.amount, cur)}</b>
                  <span className="text-muted-foreground">{fmtInt(a.count)} {a.count === 1 ? 'invoice' : 'invoices'}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <Panel title="Dunning" hint="past due and in grace" index={2} className="overflow-hidden md:col-span-2 xl:col-span-12">
        {data.dunning.length === 0 ? <EmptyNote>No tenants are past due or in grace.</EmptyNote> : (
          <TableScroll label="Tenants in dunning">
            <table className="w-full min-w-[720px]">
              <caption className="sr-only">Tenants with overdue subscriptions</caption>
              <thead><tr><th scope="col" className={thClass}>Tenant</th><th scope="col" className={thClass}>Plan</th><th scope="col" className={thClass}>Status</th><th scope="col" className={thClass}>Grace ends</th><th scope="col" className={`${thClass} text-right`}>Amount due</th><th scope="col" className={`${thClass} text-right`}>Days overdue</th><th scope="col" className={`${thClass} relative`}><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {data.dunning.map((d) => {
                  const left = d.graceEndsAt ? daysUntil(d.graceEndsAt) : null;
                  return (
                    <tr key={d.tenantId}>
                      <td className={`${tdClass} font-semibold`}>{d.name}<span className="block text-[11px] font-normal text-muted-foreground">{d.slug}</span></td>
                      <td className={tdClass}>{d.plan ?? '—'}</td>
                      <td className={tdClass}><Chip tone={d.status === 'PAST_DUE' ? 'red' : 'amber'}>{d.status === 'PAST_DUE' ? 'Past due' : 'Grace'}</Chip></td>
                      <td className={tdClass}>
                        {left === null ? '—' : (
                          <span className={left <= 2 ? 'font-semibold text-red-700 dark:text-red-400' : ''}>{left <= 0 ? 'Ended' : `in ${left} ${left === 1 ? 'day' : 'days'}`}<span className="block text-[11px] font-normal text-muted-foreground">{fmtDate(d.graceEndsAt)}</span></span>
                        )}
                      </td>
                      <td className={`${tdClass} text-right tabular-nums`}>{d.amountDue === null ? '—' : money(d.amountDue, cur)}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{d.daysOverdue === null ? '—' : fmtInt(d.daysOverdue)}</td>
                      <td className={`${tdClass} text-right`}><Link href={`/tenants/${d.tenantId}`} className="rounded text-xs font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">View tenant</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        )}
        <p className="mt-3 text-xs text-muted-foreground">Read-only view: the platform has no remind or retry-charge action, so you can only open the tenant.</p>
      </Panel>
    </div>
  );
}
