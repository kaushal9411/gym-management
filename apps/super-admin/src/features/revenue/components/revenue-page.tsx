'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Download, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';

import { Skeleton } from '@/components/ui/skeleton';
import { useHasPermission } from '@/features/auth/hooks/use-auth';
import { downloadCsv } from '@/features/dashboard/components/export-csv';
import { Segmented } from '@/features/dashboard/components/ui';
import { TabBar } from '@/features/tenants/components/detail/shell/tab-bar';
import { ErrorNote, TabSkeleton } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { REVENUE_RANGES, revenueOverviewService, useRevenueOverview, type RevenueRange } from '../api/overview';
import { CollectionsTab } from './collections-tab';
import { GeoTab } from './geo-tab';
import { OverviewTab } from './overview-tab';
import { PlansTab } from './plans-tab';

/*
 * Dropped on purpose (no backing data): MRR history / trend, new-vs-churned MRR, refunds (no refund model),
 * growth by cohort. The old page's top-plans / top-countries / by-gateway / by-currency cards live on in the
 * Plans & MRR and Geography & gateways tabs; the 30-day growth bars are now the daily collected chart.
 */
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'plans', label: 'Plans & MRR' },
  { id: 'geo', label: 'Geography & gateways' },
  { id: 'collections', label: 'Collections' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const RANGE_TEXT: Record<RevenueRange, string> = { '30d': 'Last 30 days vs previous 30', '90d': 'Last 90 days vs previous 90', '12m': 'Last 12 months vs previous 12' };
const BANNER_BTN = 'inline-flex h-9 items-center gap-2 rounded-[9px] border border-white/30 bg-white/15 px-3.5 text-[13px] font-semibold text-white outline-none transition-colors hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60';
const PRINT_CSS = `@media print{
  aside,header.sticky,[data-sonner-toaster],[data-no-print],.fixed{display:none!important}
  html,body{background:#fff!important}
  main{padding:0!important}
  .print-only{display:block!important}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}`;

export function RevenuePage() {
  const canRead = useHasPermission('revenue:read');
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const reduce = useReducedMotion();
  const [compare, setCompare] = useState(true);
  const [exporting, setExporting] = useState(false);

  const rawRange = sp.get('range');
  const range: RevenueRange = REVENUE_RANGES.includes(rawRange as RevenueRange) ? (rawRange as RevenueRange) : '30d';
  const rawTab = sp.get('tab');
  const tab: TabId = TABS.some((t) => t.id === rawTab) ? (rawTab as TabId) : 'overview';

  const q = useRevenueOverview(range);
  const data = q.data;

  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    const s = next.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };

  const onExport = async () => {
    setExporting(true);
    try {
      const blob = await revenueOverviewService.exportCsv(range);
      downloadCsv(`revenue-${range}.csv`, await blob.text());
      toast.success('Revenue report exported');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally { setExporting(false); }
  };

  if (!canRead) {
    return <div role="alert" className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">You do not have permission to view revenue (revenue:read).</div>;
  }

  return (
    <div className="space-y-4">
      <style>{PRINT_CSS}</style>
      <motion.header
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative flex flex-wrap items-end justify-between gap-3 overflow-hidden rounded-2xl px-6 py-5 text-white"
        style={{ background: 'radial-gradient(600px 220px at 90% -40%, rgba(94,234,212,.45), transparent 60%), linear-gradient(115deg,#0f172a,#115e59 60%,#0e7490)' }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 1px, transparent 1px 14px)' }} />
        <div className="relative min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Revenue &amp; reporting</h1>
          <p className="mt-0.5 text-[13px] text-teal-100" aria-live="polite">{RANGE_TEXT[range]}{data ? ` · ${data.currency}` : ''}</p>
        </div>
        <div data-no-print className="relative flex flex-wrap items-center gap-2.5">
          <div>
            <Segmented label="Range" value={range} onChange={(v) => setParam({ range: v === '30d' ? null : v })} options={REVENUE_RANGES.map((r) => ({ value: r, label: r.toUpperCase() }))} />
          </div>
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[9px] border border-white/30 bg-white/15 px-3 text-[13px] font-semibold focus-within:ring-2 focus-within:ring-white">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="size-4 accent-teal-400" />Compare with previous
          </label>
          <button type="button" className={BANNER_BTN} onClick={onExport} disabled={exporting}>
            {exporting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}Export CSV
          </button>
          <button type="button" className={BANNER_BTN} onClick={() => window.print()} title="Opens the browser print dialog — choose “Save as PDF”">
            <Printer className="size-4" aria-hidden />Print / save as PDF
          </button>
        </div>
      </motion.header>

      <TabBar tabs={[...TABS]} active={tab} onChange={(id) => setParam({ tab: id === 'overview' ? null : id })} idPrefix="rev" />

      <div id={`rev-panel-${tab}`} role="tabpanel" aria-labelledby={`rev-tab-${tab}`} tabIndex={-1} className="outline-none">
        {q.isError && !data ? (
          <ErrorNote what="revenue" message={q.error instanceof Error ? q.error.message : undefined} onRetry={() => void q.refetch()} />
        ) : !data ? (
          <div className="space-y-3"><TabSkeleton kpis={8} rows={4} /><Skeleton className="h-64 rounded-[14px]" /></div>
        ) : (
          <div className={q.isPlaceholderData ? 'opacity-70 transition-opacity' : 'transition-opacity'} aria-busy={q.isPlaceholderData}>
            {data.currencyNote ? (
              <p role="note" className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                {data.currencyNote}{data.currencies ? ` Currencies: ${data.currencies.join(', ')}.` : ''}
              </p>
            ) : null}
            {q.isError ? <div className="mb-3"><ErrorNote what="fresh revenue data" onRetry={() => void q.refetch()} /></div> : null}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={tab} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                {tab === 'overview' ? <OverviewTab data={data} compare={compare} />
                  : tab === 'plans' ? <PlansTab data={data} compare={compare} />
                  : tab === 'geo' ? <GeoTab data={data} compare={compare} />
                  : <CollectionsTab data={data} compare={compare} />}
              </motion.div>
            </AnimatePresence>
            <p className="mt-4 text-xs text-muted-foreground print:text-black">Data windows are UTC · money KPIs in {data.currency}. Refunds, MRR history and cohort growth are not tracked.</p>
          </div>
        )}
      </div>
    </div>
  );
}
