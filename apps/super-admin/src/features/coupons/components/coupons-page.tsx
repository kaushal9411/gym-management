'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { Download, Layers, Pencil, Plus, Power, Search, SearchX, Ticket, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { downloadCsv } from '@/features/dashboard/components/export-csv';
import { fmtInt, fmtMoney } from '@/features/dashboard/components/format';
import { KpiCard } from '@/features/dashboard/components/kpi-card';
import { CountUp, EmptyNote, Panel } from '@/features/dashboard/components/ui';
import { useNow } from '@/features/dashboard/components/use-now';
import { CountChips, ErrorNote, PagerBar, TableScroll, tdClass, thClass, MixBar } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { cn } from '@/lib/utils';
import { useSetCouponActive, useCouponOverview } from '../api/insights';
import { toCouponError, useCoupons } from '../hooks/use-coupons';
import type { Coupon, CouponType } from '../types';
import { BulkGeneratePanel } from './bulk-panel';
import { ByTypePanel, ExpiringPanel, RedemptionsTrend, TopCouponsPanel } from './coupon-charts';
import { CopyCode, StatusChip, UsageBar, ValueChip } from './coupon-bits';
import { CouponFormPanel } from './coupon-form';
import { DeleteCouponConfirm } from './delete-confirm';
import { SCOPE_LABEL, TYPE_LABEL, couponStatus, expiryInfo, relativeAgo, toCsv, valueLabel } from './lib';
import { PAGE_SIZE, SORTS, STATUS_FILTERS, TYPES, parseFilters, toSearchString, type CouponFilters, type CouponSort, type StatusFilter } from './url-state';

const BANNER_BTN = 'inline-flex h-9 items-center gap-2 rounded-[9px] border border-white/30 bg-white/15 px-3.5 text-[13px] font-semibold text-white outline-none transition-colors hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60';
const SELECT = 'h-9 rounded-[9px] border border-input bg-card px-2.5 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring';
const ICON_BTN = 'inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-semibold outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';

type Panelkind = null | 'create' | 'bulk' | { edit: Coupon };

export function CouponsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const spKey = sp.toString();
  const reduce = useReducedMotion();
  const now = useNow();
  const filters = useMemo(() => parseFilters(new URLSearchParams(spKey)), [spKey]);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const replaceQs = useCallback((qs: string) => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }), [router, pathname]);
  const update = useCallback((patch: Partial<CouponFilters>) => {
    const next = { ...filtersRef.current, ...patch };
    if (!('page' in patch)) next.page = 1;
    filtersRef.current = next;
    replaceQs(toSearchString(next));
  }, [replaceQs]);

  // Debounced search: input local, URL is the source of truth; `lastQ` stops the URL->input sync clobbering typing.
  const [qInput, setQInput] = useState(filters.q);
  const lastQ = useRef(filters.q);
  useEffect(() => {
    if (qInput === lastQ.current) return;
    const id = window.setTimeout(() => { lastQ.current = qInput; update({ q: qInput.trim() }); }, 300);
    return () => window.clearTimeout(id);
  }, [qInput, update]);
  useEffect(() => { if (filters.q !== lastQ.current) { lastQ.current = filters.q; setQInput(filters.q); } }, [filters.q]);

  const list = useCoupons();
  const overview = useCouponOverview();
  const toggle = useSetCouponActive();
  const all = useMemo(() => list.data ?? [], [list.data]);
  const [panel, setPanel] = useState<Panelkind>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const open = (p: Panelkind) => { setPanel(p); window.setTimeout(() => panelRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' }), 30); };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length, active: 0, disabled: 0, expired: 0, exhausted: 0 };
    for (const x of all) { const s = couponStatus(x, now ?? 0); if (s in c) c[s] = (c[s] ?? 0) + 1; }
    return c;
  }, [all, now]);

  const rows = useMemo(() => {
    const q = filters.q.toLowerCase();
    const n = now ?? 0;
    const out = all.filter((c) => (!q || c.code.toLowerCase().includes(q)) && (!filters.type || c.type === filters.type) && (!filters.status || couponStatus(c, n) === filters.status));
    const money = (c: Coupon) => Number(c.computed?.discountGiven ?? 0);
    const sorters: Record<CouponSort, (a: Coupon, b: Coupon) => number> = {
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      redeemed: (a, b) => b.timesRedeemed - a.timesRedeemed,
      discount: (a, b) => money(b) - money(a),
      expiry: (a, b) => (a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity) - (b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity),
    };
    return out.sort(sorters[filters.sort]);
  }, [all, filters, now]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const k = overview.data?.kpis;
  const filtered = !!(filters.q || filters.status || filters.type);

  const exportCsv = () => {
    const header = ['Code', 'Type', 'Value', 'Scope', 'Status', 'Uses (timesRedeemed)', 'Max redemptions', 'Redemptions logged', 'Discount given', 'Expires', 'Last redeemed', 'Created'];
    const body = rows.map((c) => [c.code, TYPE_LABEL[c.type], valueLabel(c), SCOPE_LABEL[c.scope], couponStatus(c, now ?? 0), c.timesRedeemed, c.maxRedemptions ?? '', c.computed?.redemptions ?? c._count?.redemptions ?? '', c.computed?.discountGiven ?? '', c.expiresAt ?? '', c.computed?.lastRedeemedAt ?? '', c.createdAt]);
    downloadCsv(`coupons-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([header, ...body]));
    toast.success(`Exported ${rows.length} coupon${rows.length === 1 ? '' : 's'}`);
  };

  const onToggle = (c: Coupon) => {
    const next = !c.isActive;
    toggle.mutate({ id: c.id, isActive: next }, {
      onSuccess: () => toast.success(`${c.code} ${next ? 'enabled' : 'disabled'}`),
      onError: (e) => toast.error(toCouponError(e).message),
    });
  };

  const subtitle = k
    ? `${fmtInt(k.total)} coupon${k.total === 1 ? '' : 's'} · ${fmtInt(k.active)} active · ${fmtInt(k.redemptions30d)} redemptions this month`
    : list.data ? `${fmtInt(counts.all ?? 0)} coupons · ${fmtInt(counts.active ?? 0)} active` : 'Discount codes for plans and trials';
  const series = overview.data?.redemptionsDaily.map((d) => d.count);

  return (
    <div className="space-y-4">
      <motion.header
        initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative flex flex-wrap items-end justify-between gap-3 overflow-hidden rounded-2xl px-6 py-5 text-white"
        style={{ background: 'radial-gradient(600px 220px at 90% -40%, rgba(94,234,212,.45), transparent 60%), linear-gradient(115deg,#0f172a,#115e59 60%,#0e7490)' }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 1px, transparent 1px 14px)' }} />
        <div className="relative min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Ticket className="size-6" aria-hidden />Coupons</h1>
          <p className="mt-0.5 text-[13px] text-teal-100" aria-live="polite">{subtitle}</p>
        </div>
        <div className="relative flex flex-wrap gap-2.5">
          <button type="button" className={cn(BANNER_BTN, 'border-white bg-white text-teal-900 hover:bg-white/90')} onClick={() => open('create')}><Plus className="size-4" aria-hidden />New coupon</button>
          <button type="button" className={BANNER_BTN} onClick={() => open('bulk')}><Layers className="size-4" aria-hidden />Bulk generate</button>
          <button type="button" className={BANNER_BTN} onClick={exportCsv} disabled={rows.length === 0}><Download className="size-4" aria-hidden />Export CSV</button>
        </div>
      </motion.header>

      <div ref={panelRef} className="scroll-mt-4">
        {panel === 'create' ? <CouponFormPanel key="create" onClose={() => setPanel(null)} /> : null}
        {panel === 'bulk' ? <BulkGeneratePanel onClose={() => setPanel(null)} /> : null}
        {panel && typeof panel === 'object' ? (
          <CouponFormPanel key={panel.edit.id} coupon={panel.edit} redeemed={panel.edit.computed?.redemptions ?? 0} onClose={() => setPanel(null)} />
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {k ? (
          <>
            <KpiCard index={0} label="Total coupons" value={k.total} format={fmtInt} color="var(--chart-1)" fallbackCaption="all time" />
            <KpiCard index={1} label="Active" value={k.active} format={fmtInt} color="var(--chart-6)" fallbackCaption="redeemable now" />
            <MixCard index={2} k={k} />
            <KpiCard index={3} label="Redemptions (30d)" value={k.redemptions30d} previous={k.redemptionsPrev30d} format={fmtInt} series={series} color="var(--chart-2)" caption="vs prev 30d" />
            <KpiCard index={4} label="Discount given (30d)" value={Number(k.discountGiven30d)} format={fmtMoney} color="var(--chart-4)" fallbackCaption="paid invoices" />
            <KpiCard index={5} label="Discount given (all time)" value={Number(k.discountGivenAllTime)} format={fmtMoney} color="var(--chart-3)" fallbackCaption="paid invoices" />
          </>
        ) : overview.isError ? (
          <div className="col-span-full"><ErrorNote what="coupon insights" message={toCouponError(overview.error).message} onRetry={() => void overview.refetch()} /></div>
        ) : Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-[14px]" />)}
      </div>

      {overview.data ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
          <RedemptionsTrend data={overview.data.redemptionsDaily} index={0} className="md:col-span-2 xl:col-span-8" />
          <ByTypePanel data={overview.data.byType} index={1} className="md:col-span-2 xl:col-span-4" />
          <TopCouponsPanel data={overview.data.topCoupons} index={2} className="xl:col-span-6" />
          <ExpiringPanel data={overview.data.expiringSoon} now={now} index={3} className="xl:col-span-6" />
        </div>
      ) : overview.isLoading ? <Skeleton className="h-64 rounded-[14px]" /> : null}

      <Panel title="All coupons" hint={list.data ? `${rows.length}${filtered ? ` of ${all.length}` : ''}` : undefined} index={4} bodyClassName="space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input type="search" aria-label="Search coupon codes" placeholder="Search code…" value={qInput} onChange={(e) => setQInput(e.target.value)} className={cn(SELECT, 'w-full pl-8')} />
          </div>
          <select aria-label="Type" className={SELECT} value={filters.type} onChange={(e) => update({ type: e.target.value as CouponType | '' })}>
            <option value="">All types</option>
            {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
          <select aria-label="Sort by" className={SELECT} value={filters.sort} onChange={(e) => update({ sort: e.target.value as CouponSort })}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {filtered ? <button type="button" className={cn(ICON_BTN, 'h-9')} onClick={() => { setQInput(''); lastQ.current = ''; replaceQs(''); }}><X className="size-3.5" aria-hidden />Clear filters</button> : null}
        </div>
        <CountChips<StatusFilter | 'all'>
          label="Filter by status" value={filters.status || 'all'} onChange={(v) => update({ status: v === 'all' ? '' : v })}
          options={[{ value: 'all', label: 'All', count: counts.all ?? 0 }, ...STATUS_FILTERS.map((s) => ({ value: s, label: s[0]!.toUpperCase() + s.slice(1), count: counts[s] ?? 0 }))]}
        />

        {list.isLoading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading coupons">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
        ) : list.isError ? (
          <ErrorNote what="coupons" message={toCouponError(list.error).message} onRetry={() => void list.refetch()} />
        ) : all.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-3 py-10 text-center">
            <Ticket className="size-8 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">No coupons yet. Create one or generate a batch.</p>
            <div className="flex gap-2"><Button size="sm" onClick={() => open('create')}><Plus className="size-4" aria-hidden />New coupon</Button><Button size="sm" variant="outline" onClick={() => open('bulk')}>Bulk generate</Button></div>
          </div>
        ) : rows.length === 0 ? (
          <EmptyNote><SearchX className="mx-auto mb-1 size-5" aria-hidden />No coupons match these filters.</EmptyNote>
        ) : (
          <>
            <TableScroll label="Coupons table">
              <table className="w-full min-w-[980px] border-collapse">
                <thead>
                  <tr>
                    {['Code', 'Discount', 'Status', 'Usage', 'Logged', 'Discount given', 'Expires', 'Last redeemed'].map((h) => <th key={h} scope="col" className={thClass}>{h}</th>)}
                    <th scope="col" className={cn(thClass, 'text-right')}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((c) => {
                    const st = couponStatus(c, now ?? 0);
                    const ex = expiryInfo(c.expiresAt, now);
                    const logged = c.computed?.redemptions ?? c._count?.redemptions ?? 0;
                    return (
                      <FragmentRow key={c.id}>
                        <tr className="transition-colors hover:bg-muted/40">
                          <td className={tdClass}>
                            <span className="flex items-center gap-1">
                              <Link href={`/coupons/${c.id}`} className="rounded font-mono text-[13px] font-semibold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">{c.code}</Link>
                              <CopyCode code={c.code} />
                            </span>
                          </td>
                          <td className={tdClass}><ValueChip coupon={c} /><span className="mt-0.5 block text-[11px] text-muted-foreground">{SCOPE_LABEL[c.scope]}</span></td>
                          <td className={tdClass}><StatusChip status={st} /></td>
                          <td className={tdClass}><UsageBar used={c.timesRedeemed} max={c.maxRedemptions} /></td>
                          <td className={cn(tdClass, 'tabular-nums')}>{fmtInt(logged)}</td>
                          <td className={cn(tdClass, 'tabular-nums')}>{fmtMoney(c.computed?.discountGiven ?? 0)}</td>
                          <td className={tdClass}>
                            {c.expiresAt ? <span className={cn('block whitespace-nowrap', ex.soon && 'font-semibold text-red-700 dark:text-red-400')}>{ex.text}<span className="block text-[11px] font-normal text-muted-foreground">{ex.date}</span></span> : <span className="text-muted-foreground">Never</span>}
                          </td>
                          <td className={cn(tdClass, 'whitespace-nowrap text-muted-foreground')}>{relativeAgo(c.computed?.lastRedeemedAt, now)}</td>
                          <td className={cn(tdClass, 'text-right')}>
                            <span className="inline-flex gap-1.5">
                              <button type="button" className={ICON_BTN} onClick={() => { setDeleting(null); open({ edit: c }); }} aria-label={`Edit ${c.code}`} title="Edit"><Pencil className="size-3.5" aria-hidden /><span className="hidden 2xl:inline">Edit</span></button>
                              <button type="button" className={ICON_BTN} onClick={() => onToggle(c)} aria-label={`${c.isActive ? 'Disable' : 'Enable'} ${c.code}`} title={c.isActive ? 'Disable' : 'Enable'}><Power className="size-3.5" aria-hidden /><span className="hidden 2xl:inline">{c.isActive ? 'Disable' : 'Enable'}</span></button>
                              <button type="button" className={cn(ICON_BTN, 'text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10')} onClick={() => setDeleting(c.id)} aria-label={`Delete ${c.code}`} title="Delete"><Trash2 className="size-3.5" aria-hidden /><span className="hidden 2xl:inline">Delete</span></button>
                            </span>
                          </td>
                        </tr>
                        {deleting === c.id ? (
                          <tr><td colSpan={9} className="border-b bg-muted/20 p-3"><div className="max-w-2xl"><DeleteCouponConfirm coupon={c} redemptions={logged} onCancel={() => setDeleting(null)} onDeleted={() => setDeleting(null)} /></div></td></tr>
                        ) : null}
                      </FragmentRow>
                    );
                  })}
                </tbody>
              </table>
            </TableScroll>
            <PagerBar page={page} totalPages={totalPages} total={rows.length} onPage={(p) => update({ page: p })} />
          </>
        )}
      </Panel>
    </div>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) { return <>{children}</>; }

function MixCard({ index, k }: { index: number; k: { expired: number; exhausted: number; disabled: number } }) {
  const reduce = useReducedMotion();
  const sum = k.expired + k.exhausted + k.disabled;
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: reduce ? 0 : index * 0.03 }} className="min-w-0 rounded-[14px] border bg-card px-4 py-3.5">
      <p className="text-xs font-medium text-muted-foreground">Not redeemable</p>
      <p className="mb-1.5 mt-1 text-[26px] font-semibold leading-[1.15] tracking-tight tabular-nums"><CountUp value={sum} format={fmtInt} /></p>
      {sum > 0 ? <MixBar label="Not redeemable coupons" items={[{ label: 'Expired', value: k.expired, color: 'var(--chart-5)' }, { label: 'Exhausted', value: k.exhausted, color: 'var(--chart-4)' }, { label: 'Disabled', value: k.disabled, color: 'var(--chart-7)' }]} /> : <p className="text-xs text-muted-foreground">Expired, exhausted or disabled</p>}
    </motion.div>
  );
}

