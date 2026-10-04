'use client';

/** Small building blocks shared by the five tenant-detail tabs (cards/chips/colours come from the dashboard kit). */
import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ChipTone } from '@/features/dashboard/components/ui';

export const fieldClass = cn(
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
);

export interface TabProps {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  canManage: boolean;
}

export function money(amount: string | number, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount));
  } catch {
    return `${currency} ${amount}`;
  }
}

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const fmtDate = (v: string | null | undefined): string => (v ? dateFmt.format(new Date(v)) : '—');
export const fmtDateTime = (v: string | null | undefined): string => (v ? dateTimeFmt.format(new Date(v)) : '—');

const STATUS_TONE: Record<string, ChipTone> = {
  SUCCEEDED: 'green', PAID: 'green', ACTIVE: 'green', RESOLVED: 'green',
  PENDING: 'amber', OPEN: 'amber', TRIALING: 'blue', PAST_DUE: 'amber', GRACE: 'amber', IN_PROGRESS: 'blue',
  FAILED: 'red', SUSPENDED: 'red', URGENT: 'red', HIGH: 'amber', MEDIUM: 'blue', LOW: 'slate',
  CANCELED: 'slate', CANCELLED: 'slate', EXPIRED: 'slate', VOID: 'slate', CLOSED: 'slate', INVITED: 'blue', DEACTIVATED: 'slate',
};
export const statusTone = (s: string): ChipTone => STATUS_TONE[s] ?? 'slate';
export const statusLabel = (s: string): string => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/** KPI tile: label / value / optional caption — same card language as the dashboard KpiCard, for already-formatted strings. */
export function Stat({ label, value, caption, index = 0, tone }: { label: string; value: string; caption?: string; index?: number; tone?: 'bad' | 'good' }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: reduce ? 0 : index * 0.03 }}
      className="min-w-0 rounded-[14px] border bg-card px-4 py-3.5"
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-1 truncate text-2xl font-semibold leading-tight tracking-tight tabular-nums', tone === 'bad' && 'text-red-700 dark:text-red-400', tone === 'good' && 'text-green-700 dark:text-green-400')}>{value}</p>
      {caption ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{caption}</p> : null}
    </motion.div>
  );
}

export function StatRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

export function ErrorNote({ message, onRetry, what }: { message?: string; onRetry: () => void; what: string }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
      <AlertTriangle className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">Couldn&apos;t load {what}{message ? ` — ${message}` : ''}.</span>
      <Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>
    </div>
  );
}

export function TabSkeleton({ kpis = 4, rows = 5 }: { kpis?: number; rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {kpis > 0 ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: kpis }).map((_, i) => <Skeleton key={i} className="h-[88px] rounded-[14px]" />)}
        </div>
      ) : null}
      <div className="space-y-2 rounded-[14px] border bg-card p-4">
        {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-8" />)}
      </div>
    </div>
  );
}

/** Horizontal-scroll wrapper so wide tables never cause page scroll. */
export function TableScroll({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region must be keyboard-focusable (WCAG 2.1.1)
    <div className="-mx-4 overflow-x-auto px-4" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}
export const thClass = 'whitespace-nowrap border-b px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';
export const tdClass = 'border-b border-border/60 px-3 py-2.5 align-middle text-[13px]';

/** Filter chips with counts (radio semantics). */
export function CountChips<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string; count?: number }>; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              on ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {o.label}{o.count !== undefined ? <span className="ml-1.5 tabular-nums opacity-80">{o.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Pager (client or server paged). */
export function PagerBar({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return <p className="pt-2 text-xs text-muted-foreground">{total} row{total === 1 ? '' : 's'}</p>;
  return (
    <div className="flex items-center justify-between gap-2 pt-3 text-xs">
      <span className="text-muted-foreground">Page {page} of {totalPages} · {total} rows</span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

/** Horizontal stacked-share bar with legend (role mix, status mix, action mix). Bars grow on mount. */
export function MixBar({ items, label }: { items: Array<{ label: string; value: number; color: string }>; label: string }) {
  const reduce = useReducedMotion();
  const total = items.reduce((a, i) => a + i.value, 0);
  if (total === 0) return null;
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${label}: ${items.map((i) => `${i.label} ${i.value}`).join(', ')}`}>
        {items.filter((i) => i.value > 0).map((i) => (
          <motion.div
            key={i.label}
            style={{ background: i.color }}
            initial={reduce ? false : { width: 0 }}
            animate={{ width: `${(i.value / total) * 100}%` }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          />
        ))}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {items.map((i) => (
          <li key={i.label} className="flex items-center gap-1.5 text-muted-foreground">
            <i className="size-2 rounded-sm" style={{ background: i.color }} aria-hidden />
            {i.label} <b className="tabular-nums text-foreground">{i.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function relTime(iso: string | null | undefined, now: number | null): string {
  if (!iso) return 'Never';
  if (now === null) return fmtDate(iso);
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 60 ? `${d}d ago` : fmtDate(iso);
}
