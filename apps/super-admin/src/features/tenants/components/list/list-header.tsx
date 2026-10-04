'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { Download, Loader2, Megaphone } from 'lucide-react';

import { CountUp } from '@/features/dashboard/components/ui';
import { fmtInt } from '@/features/dashboard/components/format';
import { cn } from '@/lib/utils';
import type { ListCounts } from '../../api/list';
import type { ListFilters } from './url-state';

/*
 * Dropped from the spec on purpose:
 *  - "+ New tenant": there is no admin create-tenant endpoint (tenants self-register).
 *  - "Send notice" / "Export" in the bulk bar: bulk has no notice action and the export endpoint takes filters, not ids.
 */
const BANNER_BTN = 'inline-flex h-9 items-center gap-2 rounded-[9px] border border-white/30 bg-white/15 px-3.5 text-[13px] font-semibold text-white outline-none transition-colors hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60';

export function ListBanner({ counts, exporting, canExport, onExport }: { counts?: ListCounts; exporting: boolean; canExport: boolean; onExport: () => void }) {
  const reduce = useReducedMotion();
  return (
    <motion.header
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="relative flex flex-wrap items-end justify-between gap-3 overflow-hidden rounded-2xl px-6 py-5 text-white"
      style={{ background: 'radial-gradient(600px 220px at 90% -40%, rgba(94,234,212,.45), transparent 60%), linear-gradient(115deg,#0f172a,#115e59 60%,#0e7490)' }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 1px, transparent 1px 14px)' }} />
      <div className="relative min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">Tenants</h1>
        <p className="mt-0.5 text-[13px] text-teal-100" aria-live="polite">
          {counts ? `${fmtInt(counts.all)} ${counts.all === 1 ? 'gym' : 'gyms'} on the platform · ${fmtInt(counts.trial)} in trial · ${fmtInt(counts.suspended)} suspended` : 'Every gym on the platform'}
        </p>
      </div>
      <div className="relative flex flex-wrap gap-2.5">
        {canExport ? (
          <button type="button" className={BANNER_BTN} onClick={onExport} disabled={exporting}>
            {exporting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}Export CSV
          </button>
        ) : null}
        <Link href="/notifications" className={BANNER_BTN}><Megaphone className="size-4" aria-hidden />Send announcement</Link>
      </div>
    </motion.header>
  );
}

interface StatDef { key: string; label: string; value: (c: ListCounts) => number; color: string; patch: Partial<ListFilters>; on: (f: ListFilters) => boolean }
const STATS: StatDef[] = [
  { key: 'all', label: 'All tenants', value: (c) => c.all, color: '#0f766e', patch: { status: '', view: '' }, on: (f) => !f.status && !f.view },
  { key: 'active', label: 'Active', value: (c) => c.active, color: '#16a34a', patch: { status: 'ACTIVE', view: '' }, on: (f) => f.status === 'ACTIVE' && !f.view },
  { key: 'trial', label: 'Trial', value: (c) => c.trial, color: '#d97706', patch: { status: 'TRIAL', view: '' }, on: (f) => f.status === 'TRIAL' && !f.view },
  { key: 'pastDue', label: 'Past due / grace', value: (c) => c.pastDue, color: '#ea580c', patch: { status: 'PAST_DUE', view: '' }, on: (f) => f.status === 'PAST_DUE' && !f.view },
  { key: 'suspended', label: 'Suspended', value: (c) => c.suspended, color: '#dc2626', patch: { status: 'SUSPENDED', view: '' }, on: (f) => f.status === 'SUSPENDED' && !f.view },
  { key: 'cancelled', label: 'Cancelled', value: (c) => c.cancelled, color: '#64748b', patch: { status: 'CANCELLED', view: '' }, on: (f) => f.status === 'CANCELLED' && !f.view },
];

export function StatCards({ counts, filters, onApply }: { counts?: ListCounts; filters: ListFilters; onApply: (p: Partial<ListFilters>) => void }) {
  const reduce = useReducedMotion();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {STATS.map((s, i) => {
        const on = s.on(filters);
        return (
          <motion.button
            key={s.key}
            type="button"
            aria-pressed={on}
            onClick={() => onApply(s.patch)}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: reduce ? 0 : i * 0.04, ease: 'easeOut' }}
            style={{ borderTopColor: s.color }}
            className={cn(
              'min-w-0 rounded-[14px] border border-t-[3px] bg-card px-3.5 py-3 text-left outline-none transition-[box-shadow,transform,border-color] hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring',
              on && 'ring-2 ring-primary/40',
            )}
          >
            <span className="block truncate text-xs text-muted-foreground">{s.label}</span>
            <span className="mt-0.5 block text-[22px] font-semibold tabular-nums">{counts ? <CountUp value={s.value(counts)} format={fmtInt} /> : '—'}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
