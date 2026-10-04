'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Download, LayoutGrid, Plus, Search, SearchX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { downloadCsv } from '@/features/dashboard/components/export-csv';
import { fmtInt, fmtMoney } from '@/features/dashboard/components/format';
import { KpiCard } from '@/features/dashboard/components/kpi-card';
import { Segmented } from '@/features/dashboard/components/ui';
import { CountChips, ErrorNote } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { usePlansOverview } from '../api/insights';
import { toPlanError, usePlans } from '../hooks/use-plans';
import { buildPlansCsv, compactMoney } from '../lib/plan-utils';
import type { Plan } from '../types';
import { BANNER_BTN, PageBanner } from './banner';
import { type PlanActionKind } from './plan-actions';
import { PlanCard, PlansTable, type CardHandlers, type SortKey } from './plan-card';
import { PlanForm } from './plan-form';
import { PlansInsights } from './plans-insights';

/*
 * Dropped (no backing data): plan versioning / grandfathering of existing subscribers - the API has neither, price edits simply apply at each next renewal.
 * Filters live in the URL (?q=&status=&sort=); the grid/table choice is a per-browser preference (localStorage).
 */
type StatusFilter = '' | 'active' | 'inactive';
const SORTS: SortKey[] = ['order', 'mrr', 'subs', 'price'];
const SORT_LABEL: Record<SortKey, string> = { order: 'Display order', mrr: 'MRR (high to low)', subs: 'Subscribers (high to low)', price: 'Monthly price (high to low)' };
const VIEW_KEY = 'sa-plans-view';
const SELECT = 'h-9 rounded-[9px] border border-input bg-card px-2.5 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring';

const subsOf = (p: Plan) => (p.stats ? p.stats.activeSubscribers + p.stats.trialSubscribers + p.stats.pastDueSubscribers : 0);
function sortPlans(list: Plan[], sort: SortKey): Plan[] {
  const out = [...list];
  if (sort === 'mrr') out.sort((a, b) => Number(b.stats?.mrr ?? 0) - Number(a.stats?.mrr ?? 0));
  else if (sort === 'subs') out.sort((a, b) => subsOf(b) - subsOf(a));
  else if (sort === 'price') out.sort((a, b) => Number(b.priceMonthly) - Number(a.priceMonthly));
  else out.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  return out;
}

function ScrollTo({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, []);
  return <div ref={ref}>{children}</div>;
}

export function PlansListPage() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const q = sp.get('q') ?? '';
  const status: StatusFilter = sp.get('status') === 'active' ? 'active' : sp.get('status') === 'inactive' ? 'inactive' : '';
  const sort: SortKey = SORTS.includes(sp.get('sort') as SortKey) ? (sp.get('sort') as SortKey) : 'order';
  const setQs = React.useCallback((patch: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    const s = next.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }, [sp, router, pathname]);

  // Debounced search (input local, URL is the source of truth).
  const [qInput, setQInput] = React.useState(q);
  const lastQ = React.useRef(q);
  React.useEffect(() => {
    if (qInput === lastQ.current) return;
    const id = window.setTimeout(() => { lastQ.current = qInput; setQs({ q: qInput.trim() }); }, 300);
    return () => window.clearTimeout(id);
  }, [qInput, setQs]);
  React.useEffect(() => { if (q !== lastQ.current) { lastQ.current = q; setQInput(q); } }, [q]);

  const [view, setView] = React.useState<'grid' | 'table'>('grid');
  React.useEffect(() => { try { if (localStorage.getItem(VIEW_KEY) === 'table') setView('table'); } catch { /* storage unavailable */ } }, []);
  const changeView = (v: 'grid' | 'table') => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ } };

  const plansQ = usePlans();
  const overview = usePlansOverview();
  const plans = plansQ.data;
  const [editing, setEditing] = React.useState<Plan | 'create' | null>(null);
  const [panel, setPanel] = React.useState<{ id: string; kind: PlanActionKind } | null>(null);
  const [highlight, setHighlight] = React.useState<string | null>(null);

  const counts = React.useMemo(() => ({ all: plans?.length ?? 0, active: plans?.filter((p) => p.isActive).length ?? 0, inactive: plans?.filter((p) => !p.isActive).length ?? 0 }), [plans]);
  const shown = React.useMemo(() => {
    const needle = q.toLowerCase();
    const filtered = (plans ?? []).filter((p) => (status === '' || (status === 'active') === p.isActive) && (!needle || `${p.name} ${p.slug} ${p.description ?? ''}`.toLowerCase().includes(needle)));
    return sortPlans(filtered, sort);
  }, [plans, q, status, sort]);

  const handlers = (p: Plan): CardHandlers => ({
    open: panel?.id === p.id ? panel.kind : editing !== 'create' && editing?.id === p.id ? 'edit' : null,
    highlight: highlight === p.id,
    onAction: (k) => { setEditing(null); setPanel((cur) => (cur?.id === p.id && cur.kind === k ? null : { id: p.id, kind: k })); },
    onEdit: () => { setPanel(null); setEditing((cur) => (cur !== 'create' && cur?.id === p.id ? null : p)); },
    onClose: () => setPanel(null),
    onDuplicated: (np) => {
      setQInput(''); lastQ.current = '';
      router.replace(pathname, { scroll: false });
      setHighlight(np.id);
      window.setTimeout(() => setHighlight((h) => (h === np.id ? null : h)), 4000);
    },
  });

  const k = overview.data?.kpis;
  const cur = k?.currency ?? 'INR';
  const subtitle = k ? `${fmtInt(k.totalPlans)} plan${k.totalPlans === 1 ? '' : 's'} · ${fmtInt(k.activePlans)} active · ${fmtInt(k.totalSubscribers)} subscriber${k.totalSubscribers === 1 ? '' : 's'}` : plans ? `${counts.all} plans · ${counts.active} active` : 'Subscription catalogue';
  const reset = () => { setQInput(''); lastQ.current = ''; router.replace(pathname, { scroll: false }); };

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <PageBanner title="Plans" subtitle={subtitle}>
        <button type="button" className={BANNER_BTN} onClick={() => { setPanel(null); setEditing('create'); }}><Plus className="size-4" aria-hidden />New plan</button>
        <button type="button" className={BANNER_BTN} disabled={!plans?.length} onClick={() => downloadCsv(`plans-${new Date().toISOString().slice(0, 10)}.csv`, buildPlansCsv(shown))}><Download className="size-4" aria-hidden />Export CSV</button>
      </PageBanner>

      {editing ? (
        <ScrollTo key={editing === 'create' ? 'create' : editing.id}>
          <PlanForm mode={editing} onClose={() => setEditing(null)} onSaved={(p) => { if (editing === 'create') { setHighlight(p.id); window.setTimeout(() => setHighlight((h) => (h === p.id ? null : h)), 4000); } }} />
        </ScrollTo>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard index={0} label="Plans" value={k?.totalPlans ?? 0} format={fmtInt} color="var(--chart-1)" caption={k ? `${k.activePlans} active` : ''} />
        <KpiCard index={1} label="Active subscribers" value={k?.activeSubscribers ?? 0} format={fmtInt} color="var(--chart-6)" caption="paying tenants" />
        <KpiCard index={2} label="Trial subscribers" value={k?.trialSubscribers ?? 0} format={fmtInt} color="var(--chart-2)" caption="not yet billed" />
        <KpiCard index={3} label={`MRR (${cur})`} value={k ? Number(k.mrr) : 0} format={(v) => compactMoney(v, cur)} color="var(--chart-1)" caption="active, monthly-normalised" />
        <KpiCard index={4} label={`ARR (${cur})`} value={k ? Number(k.arr) : 0} format={(v) => compactMoney(v, cur)} color="var(--chart-3)" caption="MRR × 12" />
        <KpiCard index={5} label={`ARPA (${cur})`} value={k?.arpa ? Number(k.arpa) : 0} format={(v) => (cur === 'INR' ? fmtMoney(v) : compactMoney(v, cur))} color="var(--chart-4)" caption={k?.arpa ? 'MRR per active subscriber' : 'no active subscribers'} />
      </div>

      <PlansInsights data={overview.data} plans={plans ?? []} isLoading={overview.isPending} isError={overview.isError} onRetry={() => void overview.refetch()} />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[14px] border bg-card px-3.5 py-2.5">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" aria-label="Search plans" placeholder="Search name or slug…" value={qInput} onChange={(e) => setQInput(e.target.value)} className={`${SELECT} w-full pl-8`} />
        </div>
        <CountChips label="Status" value={status} onChange={(v) => setQs({ status: v })} options={[{ value: '', label: 'All', count: counts.all }, { value: 'active', label: 'Active', count: counts.active }, { value: 'inactive', label: 'Inactive', count: counts.inactive }]} />
        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">Sort
            <select className={SELECT} value={sort} onChange={(e) => setQs({ sort: e.target.value === 'order' ? '' : e.target.value })}>
              {SORTS.map((s) => <option key={s} value={s}>{SORT_LABEL[s]}</option>)}
            </select>
          </label>
          <Segmented label="View" value={view} onChange={changeView} options={[{ value: 'grid', label: 'Cards' }, { value: 'table', label: 'Table' }]} />
        </div>
      </div>

      {plansQ.isError ? (
        <ErrorNote what="plans" message={toPlanError(plansQ.error).message} onRetry={() => void plansQ.refetch()} />
      ) : plansQ.isPending || !plans ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading plans">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[430px] rounded-[14px]" />)}</div>
      ) : plans.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-[14px] border border-dashed bg-card px-4 py-16 text-center">
          <LayoutGrid className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-semibold">No plans yet — create your first plan</p>
          <Button size="sm" onClick={() => setEditing('create')}><Plus className="size-4" aria-hidden />New plan</Button>
        </div>
      ) : shown.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-[14px] border bg-card px-4 py-14 text-center">
          <SearchX className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-semibold">No plans match these filters</p>
          <Button size="sm" variant="outline" onClick={reset}>Reset filters</Button>
        </div>
      ) : view === 'table' ? (
        <PlansTable plans={shown} handlers={handlers} sort={sort} />
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((p, i) => <PlanCard key={p.id} plan={p} index={i} h={handlers(p)} />)}
        </div>
      )}
      <p className="sr-only" aria-live="polite">{shown.length} plans shown</p>
    </div>
  );
}
