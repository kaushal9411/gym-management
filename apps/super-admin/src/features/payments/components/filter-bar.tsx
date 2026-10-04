'use client';

import * as React from 'react';
import { RotateCcw, Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { statusLabel } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { SELECT } from './pay-kit';
import { MODES, PROVIDERS, activeFilterCount, type PageFilters } from './url-state';

/** Local text state that commits to the URL after a pause; follows external (reset / back) changes without clobbering typing. */
function DebouncedInput({ value, onCommit, ms = 350, ...rest }: { value: string; onCommit: (v: string) => void; ms?: number } & Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'>) {
  const [local, setLocal] = React.useState(value);
  const last = React.useRef(value);
  React.useEffect(() => {
    if (local === last.current) return;
    const id = window.setTimeout(() => { last.current = local; onCommit(local); }, ms);
    return () => window.clearTimeout(id);
  }, [local, ms, onCommit]);
  React.useEffect(() => { if (value !== last.current) { last.current = value; setLocal(value); } }, [value]);
  return <Input {...rest} value={local} onChange={(e) => setLocal(e.target.value)} />;
}

const PAYMENT_SORTS = [
  { v: 'createdAt:desc', l: 'Newest first' }, { v: 'createdAt:asc', l: 'Oldest first' },
  { v: 'amount:desc', l: 'Amount high → low' }, { v: 'amount:asc', l: 'Amount low → high' },
  { v: 'paidAt:desc', l: 'Paid latest' }, { v: 'paidAt:asc', l: 'Paid earliest' },
];
const INVOICE_SORTS = [
  { v: 'createdAt:desc', l: 'Newest first' }, { v: 'createdAt:asc', l: 'Oldest first' },
  { v: 'total:desc', l: 'Total high → low' }, { v: 'total:asc', l: 'Total low → high' },
  { v: 'dueDate:asc', l: 'Due soonest' }, { v: 'dueDate:desc', l: 'Due latest' },
];

export function FilterBar({ filters, onApply, onReset }: { filters: PageFilters; onApply: (p: Partial<PageFilters>) => void; onReset: () => void }) {
  const isPay = filters.tab === 'payments';
  const sorts = isPay ? PAYMENT_SORTS : INVOICE_SORTS;
  const dirty = activeFilterCount(filters) > 0;
  const commitQ = React.useCallback((v: string) => onApply({ q: v.trim() }), [onApply]);
  const commitMin = React.useCallback((v: string) => onApply({ min: /^\d+(\.\d{1,2})?$/.test(v) ? v : '' }), [onApply]);
  const commitMax = React.useCallback((v: string) => onApply({ max: /^\d+(\.\d{1,2})?$/.test(v) ? v : '' }), [onApply]);
  const commitCur = React.useCallback((v: string) => onApply({ currency: v.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) }), [onApply]);
  return (
    <div className="flex flex-wrap items-center gap-2" role="search" aria-label={isPay ? 'Filter payments' : 'Filter invoices'}>
      <div className="relative min-w-[200px] flex-[1_1_220px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <DebouncedInput value={filters.q} onCommit={commitQ} placeholder="Search tenant name or slug…" aria-label="Search tenant" className="h-9 rounded-[9px] pl-9 text-[13px]" />
      </div>
      {isPay ? (
        <>
          <select aria-label="Provider" className={SELECT} value={filters.provider} onChange={(e) => onApply({ provider: e.target.value })}>
            <option value="">Provider: All</option>
            {PROVIDERS.map((p) => <option key={p} value={p}>{statusLabel(p)}</option>)}
          </select>
          <select aria-label="Payment mode" className={SELECT} value={filters.mode} onChange={(e) => onApply({ mode: e.target.value })}>
            <option value="">Mode: All</option>
            {MODES.map((m) => <option key={m} value={m}>{statusLabel(m)}</option>)}
          </select>
        </>
      ) : (
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[9px] border border-input bg-card px-2.5 text-[13px]">
          <input type="checkbox" checked={filters.overdue} onChange={(e) => onApply({ overdue: e.target.checked })} className="size-3.5 accent-[var(--primary)]" />
          Overdue only
        </label>
      )}
      <DebouncedInput value={filters.currency} onCommit={commitCur} placeholder="Currency" aria-label="Currency (ISO code)" list="pay-currencies" maxLength={3} className="h-9 w-[112px] rounded-[9px] text-[13px] uppercase" />
      <datalist id="pay-currencies"><option value="INR" /><option value="USD" /><option value="EUR" /><option value="GBP" /></datalist>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>{isPay ? 'Paid' : 'Issued'}</span>
        <Input type="date" aria-label="From date" value={filters.from} max={filters.to || undefined} onChange={(e) => onApply({ from: e.target.value })} className="h-9 w-[138px] rounded-[9px] px-2 text-[13px]" />
        <span aria-hidden>–</span>
        <Input type="date" aria-label="To date" value={filters.to} min={filters.from || undefined} onChange={(e) => onApply({ to: e.target.value })} className="h-9 w-[138px] rounded-[9px] px-2 text-[13px]" />
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>Amount</span>
        <DebouncedInput value={filters.min} onCommit={commitMin} inputMode="decimal" placeholder="Min" aria-label="Minimum amount" className="h-9 w-[84px] rounded-[9px] px-2 text-[13px]" />
        <span aria-hidden>–</span>
        <DebouncedInput value={filters.max} onCommit={commitMax} inputMode="decimal" placeholder="Max" aria-label="Maximum amount" className="h-9 w-[84px] rounded-[9px] px-2 text-[13px]" />
      </div>
      <select aria-label="Sort" className={SELECT} value={`${filters.sort}:${filters.dir}`} onChange={(e) => { const [s, d] = e.target.value.split(':'); onApply({ sort: s, dir: d === 'asc' ? 'asc' : 'desc' }); }}>
        {sorts.map((o) => <option key={o.v} value={o.v}>Sort: {o.l}</option>)}
      </select>
      <button type="button" onClick={onReset} disabled={!dirty} className="inline-flex h-9 items-center gap-1.5 rounded-[9px] px-2.5 text-[13px] font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">
        <RotateCcw className="size-3.5" aria-hidden />Reset
      </button>
    </div>
  );
}
