'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, RotateCcw, Search, X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { usePlans } from '@/features/plans/hooks/use-plans';
import { cn } from '@/lib/utils';
import type { ListCounts } from '../../api/list';
import { activeFilterCount, HEALTHS, STATUSES, toSearchString, type ListFilters } from './url-state';

const SELECT = 'h-9 rounded-[9px] border border-input bg-card px-2.5 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring';
const STATUS_LABEL: Record<string, string> = { ACTIVE: 'Active', TRIAL: 'Trial', PAST_DUE: 'Past due', SUSPENDED: 'Suspended', CANCELLED: 'Cancelled' };
const HEALTH_LABEL: Record<string, string> = { at_risk: 'At risk (0–40)', fair: 'Fair (41–70)', healthy: 'Healthy (71–100)' };
export const SORT_OPTIONS: Array<{ value: string; label: string; sort: ListFilters['sort']; dir: 'asc' | 'desc' }> = [
  { value: 'mrr:desc', label: 'MRR high → low', sort: 'mrr', dir: 'desc' },
  { value: 'mrr:asc', label: 'MRR low → high', sort: 'mrr', dir: 'asc' },
  { value: 'createdAt:desc', label: 'Newest first', sort: 'createdAt', dir: 'desc' },
  { value: 'createdAt:asc', label: 'Oldest first', sort: 'createdAt', dir: 'asc' },
  { value: 'lastActiveAt:desc', label: 'Recently active', sort: 'lastActiveAt', dir: 'desc' },
  { value: 'lastActiveAt:asc', label: 'Least recently active', sort: 'lastActiveAt', dir: 'asc' },
  { value: 'members:desc', label: 'Most members', sort: 'members', dir: 'desc' },
  { value: 'health:asc', label: 'Health low → high', sort: 'health', dir: 'asc' },
  { value: 'health:desc', label: 'Health high → low', sort: 'health', dir: 'desc' },
  { value: 'name:asc', label: 'Name A → Z', sort: 'name', dir: 'asc' },
];

interface TabDef { key: string; label: string; count?: number; patch: Partial<ListFilters>; on: boolean }
interface SavedView { id: string; name: string; qs: string }
const SAVED_KEY = 'fitcloud-sa-tenant-views';

function readSaved(): SavedView[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(SAVED_KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? (v as SavedView[]).filter((s) => s && typeof s.name === 'string' && typeof s.qs === 'string').slice(0, 12) : [];
  } catch { return []; }
}
function writeSaved(v: SavedView[]) {
  try { window.localStorage.setItem(SAVED_KEY, JSON.stringify(v)); } catch { /* storage unavailable */ }
}

export function ViewTabs({ counts, filters, onApply, onApplyQuery }: {
  counts?: ListCounts; filters: ListFilters; onApply: (p: Partial<ListFilters>) => void; onApplyQuery: (qs: string) => void;
}) {
  const [saved, setSaved] = useState<SavedView[]>([]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setSaved(readSaved()); }, []);
  useEffect(() => { if (naming) nameRef.current?.focus(); }, [naming]);
  const none = !filters.status && !filters.view;
  const view = (v: ListFilters['view']) => filters.view === v && !filters.status;
  const tabs: TabDef[] = [
    { key: 'all', label: 'All tenants', count: counts?.all, patch: { status: '', view: '' }, on: none },
    { key: 'trials_ending', label: 'Trials ending soon', count: counts?.trialsEnding, patch: { status: '', view: 'trials_ending' }, on: view('trials_ending') },
    { key: 'at_risk', label: 'At risk', count: counts?.atRisk, patch: { status: '', view: 'at_risk' }, on: view('at_risk') },
    { key: 'past_due', label: 'Past due', count: counts?.pastDue, patch: { status: '', view: 'past_due' }, on: view('past_due') },
    { key: 'suspended', label: 'Suspended', count: counts?.suspended, patch: { status: '', view: 'suspended' }, on: view('suspended') },
    { key: 'near_limits', label: 'Near limits', count: counts?.nearLimits, patch: { status: '', view: 'near_limits' }, on: view('near_limits') },
  ];
  const currentQs = toSearchString({ ...filters, page: 1 });
  const save = () => {
    const n = name.trim();
    if (!n) return;
    const next = [...saved, { id: String(Date.now()), name: n.slice(0, 24), qs: currentQs }].slice(-12);
    setSaved(next); writeSaved(next); setName(''); setNaming(false);
  };
  const remove = (id: string) => { const next = saved.filter((s) => s.id !== id); setSaved(next); writeSaved(next); };
  const tabCls = (on: boolean) => cn('-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring', on ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground');

  return (
    <div className="flex flex-wrap items-center gap-x-1 border-b" role="tablist" aria-label="Saved views">
      {tabs.map((t) => (
        <button key={t.key} type="button" role="tab" aria-selected={t.on} className={tabCls(t.on)} onClick={() => onApply(t.patch)}>
          {t.label}
          {t.count !== undefined ? <b className="rounded-full bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-foreground/80">{t.count}</b> : null}
        </button>
      ))}
      {saved.map((s) => (
        <span key={s.id} className="-mb-px inline-flex items-center">
          <button type="button" role="tab" aria-selected={s.qs === currentQs} className={tabCls(s.qs === currentQs)} onClick={() => onApplyQuery(s.qs)}>{s.name}</button>
          <button type="button" aria-label={`Delete saved view ${s.name}`} className="-ml-2 rounded p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" onClick={() => remove(s.id)}><X className="size-3" aria-hidden /></button>
        </span>
      ))}
      {naming ? (
        <form className="-mb-px flex items-center gap-1.5 py-1" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <Input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="View name" aria-label="Saved view name" className="h-8 w-36 text-[13px]" />
          <button type="submit" className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">Save</button>
          <button type="button" className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => { setNaming(false); setName(''); }}>Cancel</button>
        </form>
      ) : (
        <button type="button" className="-mb-px inline-flex items-center gap-1 px-3 py-2 text-[13px] font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40" disabled={activeFilterCount(filters) === 0} title={activeFilterCount(filters) === 0 ? 'Apply a filter first' : 'Save the current filters as a view'} onClick={() => setNaming(true)}>
          <Plus className="size-3.5" aria-hidden />Save view
        </button>
      )}
    </div>
  );
}

export function FilterBar({ filters, qInput, onQInput, onApply, onReset, tags, countryHints }: {
  filters: ListFilters; qInput: string; onQInput: (v: string) => void; onApply: (p: Partial<ListFilters>) => void; onReset: () => void;
  tags: Array<{ tag: string; count: number }>; countryHints: string[];
}) {
  const plans = usePlans();
  const [country, setCountry] = useState(filters.country);
  const lastCountry = useRef(filters.country);
  useEffect(() => { if (filters.country !== lastCountry.current) { lastCountry.current = filters.country; setCountry(filters.country); } }, [filters.country]);
  const dirty = activeFilterCount(filters) > 0;
  const lbl = 'flex items-center gap-1.5 text-xs text-muted-foreground';
  return (
    <div className="flex flex-wrap items-center gap-2" role="search" aria-label="Filter tenants">
      <div className="relative min-w-[220px] flex-[1_1_240px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={qInput} onChange={(e) => onQInput(e.target.value)} placeholder="Search name, slug, owner email…" aria-label="Search tenants" className="h-9 rounded-[9px] pl-9 text-[13px]" />
      </div>
      <label className={lbl}><span className="sr-only">Plan</span>
        <select aria-label="Plan" className={SELECT} value={filters.plan} onChange={(e) => onApply({ plan: e.target.value })}>
          <option value="">Plan: All</option>
          {(plans.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          {filters.plan && !(plans.data ?? []).some((p) => p.id === filters.plan) ? <option value={filters.plan}>{filters.plan}</option> : null}
        </select>
      </label>
      <select aria-label="Status" className={SELECT} value={filters.status} onChange={(e) => onApply({ status: e.target.value as ListFilters['status'] })}>
        <option value="">Status: All</option>
        {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
      </select>
      <Input
        aria-label="Country (ISO code)" list="tl-countries" placeholder="Country" maxLength={2} value={country}
        onChange={(e) => { const v = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); setCountry(v); if (v.length === 2 || v === '') { lastCountry.current = v; onApply({ country: v }); } }}
        className="h-9 w-[92px] rounded-[9px] text-[13px] uppercase"
      />
      <datalist id="tl-countries">{countryHints.map((c) => <option key={c} value={c} />)}</datalist>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>Created</span>
        <Input type="date" aria-label="Created from" value={filters.from} max={filters.to || undefined} onChange={(e) => onApply({ from: e.target.value })} className="h-9 w-[138px] rounded-[9px] px-2 text-[13px]" />
        <span aria-hidden>–</span>
        <Input type="date" aria-label="Created to" value={filters.to} min={filters.from || undefined} onChange={(e) => onApply({ to: e.target.value })} className="h-9 w-[138px] rounded-[9px] px-2 text-[13px]" />
      </div>
      <select aria-label="Health" className={SELECT} value={filters.health} onChange={(e) => onApply({ health: e.target.value as ListFilters['health'] })}>
        <option value="">Health: Any</option>
        {HEALTHS.map((h) => <option key={h} value={h}>{HEALTH_LABEL[h]}</option>)}
      </select>
      {tags.length > 0 ? (
        <select aria-label="Tag" className={SELECT} value={filters.tag} onChange={(e) => onApply({ tag: e.target.value })}>
          <option value="">Tag: Any</option>
          {tags.map((t) => <option key={t.tag} value={t.tag}>{t.tag} ({t.count})</option>)}
        </select>
      ) : null}
      <select aria-label="Sort" className={SELECT} value={`${filters.sort}:${filters.dir}`} onChange={(e) => { const o = SORT_OPTIONS.find((s) => s.value === e.target.value); if (o) onApply({ sort: o.sort, dir: o.dir }); }}>
        {!SORT_OPTIONS.some((o) => o.value === `${filters.sort}:${filters.dir}`) ? <option value={`${filters.sort}:${filters.dir}`}>Sort: {filters.sort} {filters.dir}</option> : null}
        {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>Sort: {o.label}</option>)}
      </select>
      <button type="button" onClick={onReset} disabled={!dirty} className="inline-flex h-9 items-center gap-1.5 rounded-[9px] px-2.5 text-[13px] font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">
        <RotateCcw className="size-3.5" aria-hidden />Reset
      </button>
    </div>
  );
}
