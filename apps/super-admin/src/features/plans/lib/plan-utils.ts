import { useEffect, useState } from 'react';

import type { Plan } from '../types';

const ACCENTS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-8)', 'var(--chart-6)'];
/** Deterministic accent per plan (hash of slug) — the same plan keeps its colour on every chart and card. */
export function planAccent(slug: string): string {
  let h = 0;
  for (const c of slug) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ACCENTS[h % ACCENTS.length]!;
}

export function slugify(v: string): string {
  return v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

/** Yearly saving vs 12 monthly payments, as a whole-ish percent; null when it cannot be computed. */
export function yearlyDiscount(monthly: number, yearly: number): number | null {
  if (!(monthly > 0) || !(yearly >= 0)) return null;
  return Math.round((1 - yearly / (monthly * 12)) * 1000) / 10;
}

export function useDebounced<T>(value: T, ms = 450): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

export const LIMIT_FIELDS = [
  { key: 'maxMembers', label: 'Members' },
  { key: 'maxStaff', label: 'Staff' },
  { key: 'maxBranches', label: 'Branches' },
  { key: 'maxManagers', label: 'Managers' },
  { key: 'maxTrainers', label: 'Trainers' },
  { key: 'maxReceptionists', label: 'Receptionists' },
  { key: 'maxStorageMb', label: 'Storage' },
] as const satisfies ReadonlyArray<{ key: keyof Plan; label: string }>;

export function fmtStorage(mb: number): string {
  return mb >= 1024 ? `${Math.round((mb / 1024) * 10) / 10} GB` : `${mb} MB`;
}

/** Whole-unit money (no trailing .00) in the plan's own currency. */
export function fmtPrice(amount: string | number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(amount));
  } catch {
    return `${currency} ${amount}`;
  }
}

const csvCell = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Client-side CSV of the plans table (exactly what is listed, current filter + sort). */
export function buildPlansCsv(plans: Plan[]): string {
  const rows: unknown[][] = [['Name', 'Slug', 'Status', 'Currency', 'Monthly price', 'Yearly price', 'Trial days', 'Active subscribers', 'Trial subscribers', 'Past due subscribers', 'MRR', 'MRR share %', 'Max members', 'Max staff', 'Max branches', 'Storage MB']];
  for (const p of plans) {
    rows.push([p.name, p.slug, p.isActive ? 'Active' : 'Inactive', p.currency, p.priceMonthly, p.priceYearly, p.trialDays, p.stats?.activeSubscribers, p.stats?.trialSubscribers, p.stats?.pastDueSubscribers, p.stats?.mrr, p.stats ? Math.round(p.stats.share * 1000) / 10 : '', p.maxMembers, p.maxStaff, p.maxBranches, p.maxStorageMb]);
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

/** Compact money in an arbitrary currency (KPI cards). */
export function compactMoney(v: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 2 }).format(v);
  } catch {
    return `${currency} ${Math.round(v)}`;
  }
}
