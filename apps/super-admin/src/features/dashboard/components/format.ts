const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const int = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export const fmtMoney = (v: number | string): string => inr.format(Number(v));
export const fmtInt = (v: number): string => int.format(Math.round(v));
export const fmtPct = (v: number): string => `${Math.round(v * 10) / 10}%`;
const pad = (n: number) => String(n).padStart(2, '0');

export function fmtUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}h ${pad(m)}m`;
}

export interface Delta {
  /** null when the previous value is 0 (percentage undefined). */
  pct: number | null;
  direction: 'up' | 'down' | 'flat';
}
export function delta(cur: number, prev: number | null | undefined): Delta | null {
  if (prev === null || prev === undefined) return null;
  if (cur === prev) return { pct: 0, direction: 'flat' };
  return { pct: prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100, direction: cur > prev ? 'up' : 'down' };
}

export function shortDate(d: string): string {
  return d.slice(5).replace('-', '/');
}

const ACTION_COLORS: Array<[RegExp, string]> = [
  [/suspend|delete|fail|revoke|force/i, 'var(--chart-5)'],
  [/create|activate|reactivate|extend|login/i, 'var(--chart-6)'],
  [/update|reset|maintenance|impersonate|plan/i, 'var(--chart-4)'],
];
/** Dot colour by audit-action family. */
export function actionColor(action: string): string {
  return ACTION_COLORS.find(([re]) => re.test(action))?.[1] ?? 'var(--chart-1)';
}

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 2 });
/** ₹ compact (en-IN: K / L / Cr style units come out as "L"/"Cr"). */
export const fmtMoneyCompact = (v: number | string): string => money.format(Number(v));
const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
export const fmtCompact = (v: number): string => compact.format(v);

export function timeAgo(from: number, now: number): string {
  const m = Math.max(0, Math.round((now - from) / 60_000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '?') + (p.length > 1 ? (p[p.length - 1]?.[0] ?? '') : '')).toUpperCase();
}
const AV = ['#0f766e', '#2563eb', '#7c3aed', '#d97706', '#db2777', '#16a34a'];
/** Stable avatar colour from a string. */
export function avatarColor(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AV[h % AV.length]!;
}
