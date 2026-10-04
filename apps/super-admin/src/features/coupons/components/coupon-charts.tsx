'use client';

import { useReducedMotion, motion } from 'framer-motion';
import Link from 'next/link';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { ChartTooltip, Chip, EmptyNote, Panel } from '@/features/dashboard/components/ui';
import { fmtInt, fmtMoney, shortDate } from '@/features/dashboard/components/format';
import type { CouponOverview } from '../api/insights';
import { TYPE_COLOR, TYPE_LABEL, daysLeft } from './lib';

const AXIS = { fontSize: 11, fill: 'var(--muted-foreground)' } as const;

/** Redemptions per day (30 UTC days): this vs previous 30. Also used by the detail page (no `previousCount`). */
export function RedemptionsTrend({ data, index, title = 'Redemptions per day', className }: { data: Array<{ date: string; count: number; previousCount?: number }>; index: number; title?: string; className?: string }) {
  const rows = data.map((d) => ({ label: shortDate(d.date), cur: d.count, prev: d.previousCount ?? null }));
  const total = rows.reduce((a, r) => a + r.cur, 0);
  const hasPrev = rows.some((r) => r.prev);
  return (
    <Panel title={title} hint="last 30 days (UTC)" index={index} className={className}>
      {total === 0 && !hasPrev ? <EmptyNote>No redemptions in the last 30 days.</EmptyNote> : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 rounded bg-[var(--chart-1)]" aria-hidden />This period<b className="ml-1 tabular-nums text-foreground">{fmtInt(total)}</b></span>
            {hasPrev ? <span className="flex items-center gap-1.5"><i className="w-4 border-t-2 border-dashed border-slate-400" aria-hidden />Previous 30 days</span> : null}
          </div>
          <div className="h-[220px] w-full" role="img" aria-label={`${title}, ${total} redemptions in the last 30 days`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="red-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} minTickGap={32} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                <Tooltip content={<ChartTooltip fmt={fmtInt} names={{ cur: 'This period', prev: 'Previous' }} />} />
                {hasPrev ? <Area type="monotone" dataKey="prev" stroke="var(--chart-7)" strokeWidth={2} strokeDasharray="5 5" fill="none" dot={false} isAnimationActive={false} /> : null}
                <Area type="monotone" dataKey="cur" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#red-fill)" dot={false} activeDot={{ r: 4.5, strokeWidth: 2.5, fill: 'var(--card)' }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Panel>
  );
}

function GrowBar({ pct, color }: { pct: number; color: string }) {
  const reduce = useReducedMotion();
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted" role="presentation">
      <motion.div className="h-full rounded-full" style={{ background: color }} initial={reduce ? false : { width: 0 }} animate={{ width: `${Math.max(2, Math.min(100, pct))}%` }} transition={{ duration: 0.25, ease: 'easeOut' }} />
    </div>
  );
}

export function ByTypePanel({ data, index, className }: { data: CouponOverview['byType']; index: number; className?: string }) {
  const max = Math.max(1, ...data.map((d) => d.redemptions));
  return (
    <Panel title="Redemptions by type" hint="all time" index={index} className={className}>
      {data.every((d) => d.coupons === 0) ? <EmptyNote>No coupons yet.</EmptyNote> : (
        <ul className="space-y-3.5">
          {data.map((d) => (
            <li key={d.type}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
                <span className="font-medium">{TYPE_LABEL[d.type]}</span>
                <span className="text-xs text-muted-foreground"><b className="tabular-nums text-foreground">{fmtInt(d.redemptions)}</b> redemptions · {d.coupons} coupon{d.coupons === 1 ? '' : 's'}</span>
              </div>
              <GrowBar pct={(d.redemptions / max) * 100} color={TYPE_COLOR[d.type]} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function TopCouponsPanel({ data, index, className }: { data: CouponOverview['topCoupons']; index: number; className?: string }) {
  const max = Math.max(1, ...data.map((d) => d.redemptions));
  return (
    <Panel title="Top coupons" hint="by redemptions" index={index} className={className}>
      {data.length === 0 ? <EmptyNote>Nothing redeemed yet.</EmptyNote> : (
        <ol className="space-y-3">
          {data.map((c, i) => (
            <li key={c.couponId}>
              <div className="mb-1 flex items-center gap-2 text-[13px]">
                <span className="w-4 text-xs font-semibold text-muted-foreground">{i + 1}</span>
                <Link href={`/coupons/${c.couponId}`} className="truncate rounded font-mono font-semibold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">{c.code}</Link>
                <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground"><b className="tabular-nums text-foreground">{fmtInt(c.redemptions)}</b> uses · {fmtMoney(c.discountGiven)} off</span>
              </div>
              <GrowBar pct={(c.redemptions / max) * 100} color="var(--chart-1)" />
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

export function ExpiringPanel({ data, now, index, className }: { data: CouponOverview['expiringSoon']; now: number | null; index: number; className?: string }) {
  return (
    <Panel title="Expiring soon" hint="active, next 14 days" index={index} className={className}>
      {data.length === 0 ? <EmptyNote>No active coupons expire in the next 14 days.</EmptyNote> : (
        <ul className="divide-y">
          {data.map((c) => {
            const d = now === null ? null : daysLeft(c.expiresAt, now);
            return (
              <li key={c.couponId} className="flex items-center gap-2 py-2 text-[13px]">
                <Link href={`/coupons/${c.couponId}`} className="truncate rounded font-mono font-semibold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">{c.code}</Link>
                <span className="text-xs text-muted-foreground">{c.remaining === null ? 'unlimited uses' : `${c.remaining} left`}</span>
                {d !== null ? <Chip tone={d <= 3 ? 'red' : 'amber'} className="ml-auto">{d <= 0 ? 'today' : `${d}d left`}</Chip> : null}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
