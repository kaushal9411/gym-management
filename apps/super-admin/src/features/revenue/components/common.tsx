'use client';

import { motion, useReducedMotion } from 'framer-motion';

import type { RevenueOverview } from '../api/overview';

export interface TabData {
  data: RevenueOverview;
  /** Show previous-period series and deltas. */
  compare: boolean;
}

export const AXIS = { fontSize: 11, fill: 'var(--muted-foreground)' } as const;
export const GRID = 'var(--border)';
export const CHART = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-6)', 'var(--chart-8)', 'var(--chart-7)'];
/** Green to red ramp for invoice-aging buckets. */
export const AGING_COLORS: Record<string, string> = { Current: '#16a34a', '1-30': '#65a30d', '31-60': '#d97706', '61-90': '#ea580c', '90+': '#dc2626' };

export const num = (v: string | number | null | undefined): number => Number(v ?? 0);
export const provLabel = (p: string): string => p.charAt(0) + p.slice(1).toLowerCase();

const compactFmt = new Map<string, Intl.NumberFormat>();
/** Compact money in the given currency (axis ticks). */
export function moneyCompact(v: number, currency: string): string {
  let f = compactFmt.get(currency);
  if (!f) {
    try { f = new Intl.NumberFormat('en-IN', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }); }
    catch { f = new Intl.NumberFormat('en-IN', { notation: 'compact' }); }
    compactFmt.set(currency, f);
  }
  return f.format(v);
}

/** Horizontal bar row with a growing fill (<=250 ms, reduced-motion aware). */
export function GrowBar({ pct, color }: { pct: number; color: string }) {
  const reduce = useReducedMotion();
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted" role="presentation">
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={reduce ? false : { width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      />
    </div>
  );
}

/** Muted placeholder for series the platform does not store. */
export function NotTracked({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/40 px-4 py-5 text-sm">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-muted-foreground">Not tracked yet — needs historical MRR snapshots. {children}</p>
    </div>
  );
}

/** Whole-unit money for KPI cards (no paise, so large values never truncate). */
export function moneyWhole(v: number | string, currency: string): string {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(v)); }
  catch { return `${currency} ${Math.round(Number(v))}`; }
}
