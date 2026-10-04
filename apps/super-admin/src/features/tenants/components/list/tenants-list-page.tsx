'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SearchX } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { TenantControlCard } from '@/features/dashboard/components/tenant-control-card';
import type { TenantRef } from '@/features/dashboard/components/command-console';
import { useNow } from '@/features/dashboard/components/use-now';
import { tenantListService, useTenantInsights, useTenantList, useTenantTags, type ListSort, type TenantRow } from '../../api/list';
import { toTenantError } from '../../hooks/use-tenants';
import { BulkBar } from './bulk-bar';
import { ListBanner, StatCards } from './list-header';
import { ListInsights } from './list-insights';
import { FilterBar, ViewTabs } from './list-toolbar';
import { ListFooter, TenantTable } from './list-table';
import { parseFilters, toApiQuery, toSearchString, type ListFilters } from './url-state';

const MAX_SELECT = 100; // bulk endpoint cap

export function TenantsListPage() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const spKey = sp.toString();
  const filters = useMemo(() => parseFilters(new URLSearchParams(spKey)), [spKey]);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const replaceQs = useCallback((qs: string) => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }), [router, pathname]);
  const update = useCallback((patch: Partial<ListFilters>) => {
    const next = { ...filtersRef.current, ...patch };
    if (!('page' in patch)) next.page = 1;
    filtersRef.current = next;
    replaceQs(toSearchString(next));
  }, [replaceQs]);
  const reset = useCallback(() => { setQInput(''); lastQ.current = ''; replaceQs(''); }, [replaceQs]);

  // Debounced search: input is local, URL is the source of truth. `lastQ` stops the URL->input sync from clobbering typing.
  const [qInput, setQInput] = useState(filters.q);
  const lastQ = useRef(filters.q);
  useEffect(() => {
    if (qInput === lastQ.current) return;
    const id = window.setTimeout(() => { lastQ.current = qInput; update({ q: qInput.trim() }); }, 300);
    return () => window.clearTimeout(id);
  }, [qInput, update]);
  useEffect(() => { if (filters.q !== lastQ.current) { lastQ.current = filters.q; setQInput(filters.q); } }, [filters.q]);

  const query = useMemo(() => toApiQuery(filters), [filters]);
  const list = useTenantList(query);
  const insights = useTenantInsights();
  const tags = useTenantTags();
  const now = useNow();
  const data = list.data;
  const rows = useMemo(() => data?.items ?? [], [data]);

  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const [quick, setQuick] = useState<TenantRef | null>(null);
  const [exporting, setExporting] = useState(false);

  const toggle = (t: TenantRow) => setSelected((prev) => {
    const next = new Map(prev);
    if (next.has(t.id)) next.delete(t.id);
    else if (next.size >= MAX_SELECT) toast.warning(`Bulk actions are limited to ${MAX_SELECT} tenants at a time.`);
    else next.set(t.id, t.name);
    return next;
  });
  const togglePage = (on: boolean) => setSelected((prev) => {
    const next = new Map(prev);
    for (const r of rows) {
      if (!on) next.delete(r.id);
      else if (next.size < MAX_SELECT) next.set(r.id, r.name);
    }
    return next;
  });
  const dropSelected = useCallback((ids: string[]) => setSelected((prev) => { const next = new Map(prev); ids.forEach((i) => next.delete(i)); return next; }), []);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await tenantListService.exportCsv(query);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tenants-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Tenants exported');
    } catch (e) {
      toast.error(toTenantError(e).message);
    } finally { setExporting(false); }
  };

  const onSort = (s: ListSort, dir: 'asc' | 'desc') => update({ sort: s, dir });
  const countryHints = useMemo(() => [...new Set(rows.map((r) => r.country).filter((c): c is string => !!c))], [rows]);
  const loading = list.isPending;
  const empty = !loading && !list.isError && rows.length === 0;

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <ListBanner counts={data?.counts} exporting={exporting} canExport onExport={() => void exportCsv()} />
      <StatCards counts={data?.counts} filters={filters} onApply={(p) => update(p)} />
      <ListInsights data={insights.data} isLoading={insights.isPending} isError={insights.isError} onRetry={() => void insights.refetch()} health={filters.health} onHealth={(h) => update({ health: filters.health === h ? '' : h })} />
      <ViewTabs counts={data?.counts} filters={filters} onApply={(p) => update(p)} onApplyQuery={(qs) => { replaceQs(qs); }} />
      <FilterBar filters={filters} qInput={qInput} onQInput={setQInput} onApply={(p) => update(p)} onReset={reset} tags={tags.data ?? []} countryHints={countryHints} />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 xl:order-first">
          <section aria-label="Tenants" aria-busy={list.isFetching} className={`rounded-[14px] border bg-card transition-opacity ${list.isFetching && !loading ? 'opacity-80' : ''}`}>
            {list.isError ? (
              <div className="grid place-items-center gap-3 px-4 py-14 text-center">
                <p className="text-sm text-muted-foreground">Unable to load tenants. {toTenantError(list.error).message}</p>
                <Button size="sm" onClick={() => void list.refetch()}>Retry</Button>
              </div>
            ) : (
              <>
                <TenantTable rows={rows} loading={loading} now={now} filters={filters} selected={selected} onToggle={toggle} onTogglePage={togglePage} onSort={onSort} quickId={quick?.id ?? null} onQuick={(t) => setQuick((q) => (q?.id === t.id ? null : { id: t.id, slug: t.slug, name: t.name, status: t.status }))} />
                {empty ? (
                  <div className="grid place-items-center gap-2 px-4 py-14 text-center">
                    <SearchX className="size-8 text-muted-foreground" aria-hidden />
                    <p className="font-semibold">No tenants match these filters</p>
                    <Button size="sm" variant="outline" onClick={reset}>Reset filters</Button>
                  </div>
                ) : null}
                {data ? <ListFooter page={data.page} limit={data.limit} total={data.total} totalPages={Math.max(1, data.totalPages)} onPage={(p) => update({ page: p })} onLimit={(n) => update({ limit: n })} /> : null}
              </>
            )}
            <BulkBar selected={selected} onClear={() => setSelected(new Map())} onSucceeded={dropSelected} />
          </section>
        </div>
        {quick ? (
          <div className="order-first w-full shrink-0 xl:order-last xl:sticky xl:top-4 xl:w-[360px]">
            <TenantControlCard key={quick.id} tenant={quick} focus={null} onClose={() => setQuick(null)} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
