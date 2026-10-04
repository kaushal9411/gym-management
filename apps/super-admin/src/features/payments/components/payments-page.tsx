'use client';

/**
 * /payments — banner, range-aware insights, then Payments | Invoices tabs. All state (tab, range, filters, paging) is URL-synced.
 * Old page capabilities (two plain tables + status filter + paging) now live in the two tabs. Dropped: nothing; refunds/retry
 * never existed. Export = server CSV with the current filters (API cap 10,000 rows, audited).
 */
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Download, LineChart, Loader2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

import { useHasPermission } from '@/features/auth/hooks/use-auth';
import { fmtInt } from '@/features/dashboard/components/format';
import { Segmented } from '@/features/dashboard/components/ui';
import { useNow } from '@/features/dashboard/components/use-now';
import { ListFooter } from '@/features/tenants/components/list/list-table';
import { CountChips, ErrorNote } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { cn } from '@/lib/utils';
import { paymentsApi, useInvoiceList, usePaymentList, usePaymentsOverview, type PaymentsRange } from '../api/insights';
import { FilterBar } from './filter-bar';
import { Insights } from './insights';
import { InvoicesSummaryBar, InvoicesTable } from './invoices-table';
import { BANNER_BTN, Banner } from './pay-kit';
import { PaymentsSummaryBar, PaymentsTable } from './payments-table';
import { RANGES, parseFilters, toInvoiceQuery, toPaymentQuery, toSearchString, type PageFilters, type PaymentsTab } from './url-state';

const RANGE_LABEL: Record<PaymentsRange, string> = { '30d': '30D', '90d': '90D', '12m': '12M' };

export function PaymentsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const spKey = sp.toString();
  const canRead = useHasPermission('payments:read');
  const canManage = useHasPermission('payments:manage');
  const filters = React.useMemo(() => parseFilters(new URLSearchParams(spKey)), [spKey]);
  const ref = React.useRef(filters);
  ref.current = filters;
  const now = useNow();
  const [exporting, setExporting] = React.useState(false);

  const replaceQs = React.useCallback((qs: string) => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }), [router, pathname]);
  const update = React.useCallback((patch: Partial<PageFilters>) => {
    const next = { ...ref.current, ...patch };
    if (!('page' in patch)) next.page = 1;
    ref.current = next;
    replaceQs(toSearchString(next));
  }, [replaceQs]);
  const reset = () => replaceQs(toSearchString({ ...parseFilters(new URLSearchParams()), tab: filters.tab, range: filters.range }));
  const switchTab = (tab: PaymentsTab) => replaceQs(toSearchString({ ...parseFilters(new URLSearchParams()), tab, range: filters.range }));

  const isPay = filters.tab === 'payments';
  const payQuery = React.useMemo(() => toPaymentQuery(filters), [filters]);
  const invQuery = React.useMemo(() => toInvoiceQuery(filters), [filters]);
  const overview = usePaymentsOverview(filters.range);
  // On the Invoices tab only the (unfiltered) payment counts are needed for the badge/subtitle.
  const pays = usePaymentList(isPay ? payQuery : { limit: 1 });
  const invs = useInvoiceList(invQuery, !isPay);
  const active = isPay ? pays : invs;
  const payCounts = pays.data?.counts;
  const invCounts = invs.data?.counts;

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await paymentsApi.exportCsv(payQuery);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Payments exported (max 10,000 rows).');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Export failed'); } finally { setExporting(false); }
  };

  if (!canRead) {
    return (
      <div className="grid place-items-center gap-2 rounded-[14px] border bg-card px-4 py-16 text-center">
        <ShieldAlert className="size-8 text-muted-foreground" aria-hidden />
        <p className="font-semibold">You don&apos;t have access to payments</p>
        <p className="text-sm text-muted-foreground">The payments:read permission is required.</p>
      </div>
    );
  }

  const subtitle = payCounts
    ? `${fmtInt(payCounts.all)} payments · ${fmtInt(payCounts.pending)} pending · ${fmtInt(payCounts.failed)} failed`
    : 'Payment history and invoices across every tenant';
  const tabCls = (on: boolean) => cn('-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring', on ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground');
  const badge = 'rounded-full bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-foreground/80';

  const payChips = [
    { value: 'ALL', label: 'All', count: payCounts?.all }, { value: 'SUCCEEDED', label: 'Succeeded', count: payCounts?.succeeded },
    { value: 'PENDING', label: 'Pending', count: payCounts?.pending }, { value: 'FAILED', label: 'Failed', count: payCounts?.failed },
    { value: 'REFUNDED', label: 'Refunded', count: payCounts?.refunded }, { value: 'PARTIALLY_REFUNDED', label: 'Partially refunded', count: payCounts?.partiallyRefunded },
  ];
  const invChips = [
    { value: 'ALL', label: 'All', count: invCounts?.all }, { value: 'DRAFT', label: 'Draft', count: invCounts?.draft }, { value: 'OPEN', label: 'Open', count: invCounts?.open },
    { value: 'PAID', label: 'Paid', count: invCounts?.paid }, { value: 'VOID', label: 'Void', count: invCounts?.void }, { value: 'UNCOLLECTIBLE', label: 'Uncollectible', count: invCounts?.uncollectible },
    { value: 'OVERDUE', label: 'Overdue', count: invCounts?.overdue },
  ];
  const invValue = filters.overdue ? 'OVERDUE' : filters.status || 'ALL';

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <Banner
        actions={
          <>
            <button type="button" className={BANNER_BTN} onClick={() => void exportCsv()} disabled={exporting || !isPay} title={isPay ? 'Exports the current payment filters (max 10,000 rows)' : 'Switch to the Payments tab to export'}>
              {exporting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}Export CSV
            </button>
            <Link href="/revenue" className={BANNER_BTN}><LineChart className="size-4" aria-hidden />Revenue report</Link>
          </>
        }
      >
        <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
        <p className="mt-0.5 text-[13px] text-teal-100" aria-live="polite">{isPay || !invCounts ? subtitle : `${fmtInt(invCounts.all)} invoices · ${fmtInt(invCounts.open)} open · ${fmtInt(invCounts.overdue)} overdue`}</p>
      </Banner>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Insights</h2>
        <Segmented label="Insight range" value={filters.range} onChange={(r) => update({ range: r })} options={RANGES.map((r) => ({ value: r, label: RANGE_LABEL[r] }))} />
      </div>
      <Insights data={overview.data} isLoading={overview.isPending} isError={overview.isError} error={overview.error?.message} onRetry={() => void overview.refetch()} canManage={canManage} now={now} />

      <div className="flex flex-wrap items-center gap-x-1 border-b" role="tablist" aria-label="Payments and invoices">
        <button type="button" role="tab" id="tab-payments" aria-selected={isPay} aria-controls="panel-list" className={tabCls(isPay)} onClick={() => switchTab('payments')}>Payments{payCounts ? <b className={badge}>{fmtInt(payCounts.all)}</b> : null}</button>
        <button type="button" role="tab" id="tab-invoices" aria-selected={!isPay} aria-controls="panel-list" className={tabCls(!isPay)} onClick={() => switchTab('invoices')}>Invoices{invCounts ? <b className={badge}>{fmtInt(invCounts.all)}</b> : null}</button>
      </div>

      <div id="panel-list" role="tabpanel" aria-labelledby={isPay ? 'tab-payments' : 'tab-invoices'} className="space-y-3">
        {isPay ? (
          <CountChips label="Payment status" value={filters.status || 'ALL'} options={payChips} onChange={(v) => update({ status: v === 'ALL' ? '' : v })} />
        ) : (
          <CountChips label="Invoice status" value={invValue} options={invChips} onChange={(v) => update(v === 'OVERDUE' ? { status: '', overdue: true } : { status: v === 'ALL' ? '' : v, overdue: false })} />
        )}
        <FilterBar filters={filters} onApply={update} onReset={reset} />
        <section aria-label={isPay ? 'Payments' : 'Invoices'} aria-busy={active.isFetching} className={cn('overflow-hidden rounded-[14px] border bg-card transition-opacity', active.isFetching && !active.isPending && 'opacity-80')}>
          {active.isError ? (
            <div className="p-4"><ErrorNote what={isPay ? 'payments' : 'invoices'} message={active.error?.message} onRetry={() => void active.refetch()} /></div>
          ) : isPay ? (
            <>
              <PaymentsTable rows={pays.data?.items ?? []} loading={pays.isPending} now={now} sort={filters.sort} dir={filters.dir} onSort={(s, d) => update({ sort: s, dir: d })} onReset={reset} />
              {pays.data ? <PaymentsSummaryBar s={pays.data.summary} /> : null}
            </>
          ) : (
            <>
              <InvoicesTable rows={invs.data?.items ?? []} loading={invs.isPending} now={now} onReset={reset} />
              {invs.data ? <InvoicesSummaryBar s={invs.data.summary} /> : null}
            </>
          )}
          {active.data ? <ListFooter page={active.data.page} limit={active.data.limit} total={active.data.total} totalPages={Math.max(1, active.data.totalPages)} onPage={(p) => update({ page: p })} onLimit={(n) => update({ limit: n })} /> : null}
        </section>
      </div>
    </div>
  );
}
