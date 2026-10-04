'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Pencil, Power, SearchX, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fmtInt, fmtMoney } from '@/features/dashboard/components/format';
import { Chip, EmptyNote, Panel } from '@/features/dashboard/components/ui';
import { useNow } from '@/features/dashboard/components/use-now';
import { ErrorNote, Stat, TableScroll, fmtDate, fmtDateTime, money, tdClass, thClass } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { cn } from '@/lib/utils';
import { useCouponDetail, useSetCouponActive } from '../api/insights';
import { toCouponError } from '../hooks/use-coupons';
import { CopyCode, StatusChip, ValueChip } from './coupon-bits';
import { RedemptionsTrend } from './coupon-charts';
import { CouponFormPanel } from './coupon-form';
import { DeleteCouponConfirm } from './delete-confirm';
import { SCOPE_LABEL, TYPE_LABEL, daysLeft, expiryInfo, relativeAgo } from './lib';

const BTN = 'inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/30 bg-white/15 px-3.5 text-[13px] font-semibold text-white outline-none transition-colors hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50';

function Ring({ pct, label }: { pct: number | null; label: string }) {
  const reduce = useReducedMotion();
  const r = 26;
  const c = 2 * Math.PI * r;
  const v = pct === null ? 0 : Math.min(100, pct);
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={label} className="shrink-0">
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--muted)" strokeWidth="7" />
      <motion.circle
        cx="32" cy="32" r={r} fill="none" stroke={v >= 90 ? 'var(--chart-4)' : 'var(--chart-1)'} strokeWidth="7" strokeLinecap="round" transform="rotate(-90 32 32)"
        strokeDasharray={c} initial={reduce ? false : { strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - v / 100) }} transition={{ duration: 0.25, ease: 'easeOut' }}
      />
      <text x="32" y="36" textAnchor="middle" className="fill-foreground text-[13px] font-semibold">{pct === null ? '∞' : `${Math.round(v)}%`}</text>
    </svg>
  );
}

export function CouponDetailView({ couponId }: { couponId: string }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const now = useNow();
  const q = useCouponDetail(couponId);
  const toggle = useSetCouponActive();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const c = q.data;

  const back = <Link href="/coupons" className="inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="size-4" aria-hidden />All coupons</Link>;

  if (q.isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading coupon">
        {back}<Skeleton className="h-28 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-[14px]" />)}</div>
        <Skeleton className="h-64 rounded-[14px]" />
      </div>
    );
  }
  if (q.isError || !c) {
    const msg = q.error ? toCouponError(q.error).message : '';
    const notFound = /not.?found|404/i.test(msg) || (q.error as { code?: string } | null)?.code === 'NOT_FOUND';
    return (
      <div className="space-y-3">
        {back}
        {notFound ? (
          <div className="flex flex-col items-center gap-3 rounded-[14px] border border-dashed bg-card px-4 py-14 text-center">
            <SearchX className="size-8 text-muted-foreground" aria-hidden />
            <h1 className="text-lg font-semibold">Coupon not found</h1>
            <p className="text-sm text-muted-foreground">It may have been deleted, or the link is wrong.</p>
            <Button asChild size="sm"><Link href="/coupons">Back to coupons</Link></Button>
          </div>
        ) : <ErrorNote what="this coupon" message={msg} onRetry={() => void q.refetch()} />}
      </div>
    );
  }

  const comp = c.computed;
  const ex = expiryInfo(c.expiresAt, now);
  const left = c.expiresAt && now !== null ? daysLeft(c.expiresAt, now) : null;
  const drift = comp.redemptions !== c.timesRedeemed;
  const onToggle = () => {
    const next = !c.isActive;
    toggle.mutate({ id: c.id, isActive: next }, { onSuccess: () => toast.success(`${c.code} ${next ? 'enabled' : 'disabled'}`), onError: (e) => toast.error(toCouponError(e).message) });
  };

  return (
    <div className="space-y-4">
      {back}
      <motion.header
        initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative flex flex-wrap items-end justify-between gap-3 overflow-hidden rounded-2xl px-6 py-5 text-white"
        style={{ background: 'radial-gradient(600px 220px at 90% -40%, rgba(94,234,212,.45), transparent 60%), linear-gradient(115deg,#0f172a,#115e59 60%,#0e7490)' }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 1px, transparent 1px 14px)' }} />
        <div className="relative min-w-0">
          <h1 className="flex items-center gap-1 break-all font-mono text-3xl font-bold tracking-wide">{c.code}<CopyCode code={c.code} light className="size-8" /></h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ValueChip coupon={c} /><StatusChip status={comp.status} /><Chip tone="slate">{SCOPE_LABEL[c.scope]}</Chip>
            <span className="text-[13px] text-teal-100">{TYPE_LABEL[c.type]} · created {fmtDate(c.createdAt)}</span>
          </div>
        </div>
        <div className="relative flex flex-wrap gap-2.5">
          <button type="button" className={BTN} onClick={() => { setDeleting(false); setEditing((v) => !v); }} aria-expanded={editing}><Pencil className="size-4" aria-hidden />Edit</button>
          <button type="button" className={BTN} onClick={onToggle} disabled={toggle.isPending}><Power className="size-4" aria-hidden />{c.isActive ? 'Disable' : 'Enable'}</button>
          <button type="button" className={BTN} onClick={() => { setEditing(false); setDeleting((v) => !v); }} aria-expanded={deleting}><Trash2 className="size-4" aria-hidden />Delete</button>
        </div>
      </motion.header>

      {editing ? <CouponFormPanel coupon={c} redeemed={comp.redemptions} onClose={() => setEditing(false)} /> : null}
      {deleting ? <div className="max-w-3xl"><DeleteCouponConfirm coupon={c} redemptions={comp.redemptions} onCancel={() => setDeleting(false)} onDeleted={() => router.push('/coupons')} /></div> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat index={0} label="Redemptions logged" value={fmtInt(comp.redemptions)} caption="rows in the redemption log" />
        <motion.div initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: 0.03 }} className="flex min-w-0 items-center gap-3 rounded-[14px] border bg-card px-4 py-3">
          <Ring pct={comp.usagePct} label={comp.usagePct === null ? 'Unlimited uses' : `${Math.round(comp.usagePct)} percent of uses consumed`} />
          <div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">Uses vs limit</p><p className="text-xl font-semibold tabular-nums">{c.timesRedeemed}<span className="text-sm text-muted-foreground"> / {c.maxRedemptions ?? '∞'}</span></p></div>
        </motion.div>
        <Stat index={2} label="Remaining" value={comp.remaining === null ? 'Unlimited' : fmtInt(comp.remaining)} caption={`${c.maxRedemptionsPerTenant} per tenant`} />
        <Stat index={3} label="Discount given" value={fmtMoney(comp.discountGiven)} caption="on paid invoices" />
        <Stat index={4} label="Last redeemed" value={relativeAgo(comp.lastRedeemedAt, now)} caption={comp.lastRedeemedAt ? fmtDate(comp.lastRedeemedAt) : undefined} />
        <Stat index={5} label="Expires" value={c.expiresAt ? (ex.past ? 'Expired' : ex.text) : 'Never'} caption={c.expiresAt ? (left !== null && !ex.past ? `${left} day${left === 1 ? '' : 's'} left · ${ex.date}` : ex.date) : 'no expiry date'} tone={ex.soon || ex.past ? 'bad' : undefined} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
        <RedemptionsTrend data={c.redemptionsDaily} index={0} title="Redemptions per day" className="md:col-span-2 xl:col-span-7" />
        <Panel title="Top tenants" hint="by redemptions" index={1} className="md:col-span-2 xl:col-span-5">
          {c.topTenants.length === 0 ? <EmptyNote>No tenant has redeemed this coupon.</EmptyNote> : (
            <TableScroll label="Top tenants">
              <table className="w-full border-collapse"><thead><tr><th scope="col" className={thClass}>Tenant</th><th scope="col" className={cn(thClass, 'text-right')}>Redemptions</th></tr></thead>
                <tbody>{c.topTenants.map((t) => (
                  <tr key={t.tenantId}><td className={tdClass}><Link href={`/tenants/${t.tenantId}`} className="rounded font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">{t.name}</Link><span className="ml-2 text-xs text-muted-foreground">{t.slug}</span></td><td className={cn(tdClass, 'text-right tabular-nums')}>{t.redemptions}</td></tr>
                ))}</tbody>
              </table>
            </TableScroll>
          )}
        </Panel>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Panel title="Paid invoices using this coupon" hint="latest 10" index={2}>
          {c.invoices.length === 0 ? <EmptyNote>No paid invoice carries this coupon yet.</EmptyNote> : (
            <TableScroll label="Invoices">
              <table className="w-full min-w-[480px] border-collapse"><thead><tr>{['Invoice', 'Tenant', 'Discount', 'Total', 'Paid'].map((h) => <th key={h} scope="col" className={thClass}>{h}</th>)}</tr></thead>
                <tbody>{c.invoices.map((i) => (
                  <tr key={i.id}>
                    <td className={cn(tdClass, 'font-mono text-xs')}>{i.number}</td>
                    <td className={tdClass}><Link href={`/tenants/${i.tenant.id}`} className="rounded hover:underline focus-visible:ring-2 focus-visible:ring-ring">{i.tenant.name}</Link></td>
                    <td className={cn(tdClass, 'tabular-nums')}>{money(i.discountAmount)}</td>
                    <td className={cn(tdClass, 'tabular-nums')}>{money(i.total)}</td>
                    <td className={cn(tdClass, 'whitespace-nowrap text-muted-foreground')}>{fmtDate(i.paidAt)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </TableScroll>
          )}
        </Panel>
        <Panel title="Redemption history" hint={`latest ${c.redemptions.length}`} index={3}>
          {drift ? <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">The usage counter shows {c.timesRedeemed} use{c.timesRedeemed === 1 ? '' : 's'} but {comp.redemptions} redemption{comp.redemptions === 1 ? ' is' : 's are'} logged. Validation enforces the counter.</p> : null}
          {c.redemptions.length === 0 ? <EmptyNote>No redemptions recorded.</EmptyNote> : (
            <TableScroll label="Redemption history">
              <table className="w-full min-w-[360px] border-collapse"><thead><tr><th scope="col" className={thClass}>Tenant</th><th scope="col" className={thClass}>Redeemed</th></tr></thead>
                <tbody>{c.redemptions.map((r) => (
                  <tr key={r.id}>
                    <td className={tdClass}><Link href={`/tenants/${r.tenantId}`} className="rounded font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring">{r.tenant?.name ?? r.tenantId.slice(0, 8)}</Link>{r.tenant?.slug ? <span className="ml-2 text-xs text-muted-foreground">{r.tenant.slug}</span> : null}</td>
                    <td className={cn(tdClass, 'whitespace-nowrap')} title={fmtDateTime(r.redeemedAt)}>{relativeAgo(r.redeemedAt, now)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </TableScroll>
          )}
        </Panel>
      </div>
    </div>
  );
}
