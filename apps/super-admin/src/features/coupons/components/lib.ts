import type { ChipTone } from '@/features/dashboard/components/ui';
import { fmtDate, money } from '@/features/tenants/components/detail/tabs/_shared/kit';
import type { Coupon, CouponScope, CouponStatus, CouponType } from '../types';

export const TYPE_LABEL: Record<CouponType, string> = { PERCENTAGE: 'Percentage', FIXED_AMOUNT: 'Fixed amount', TRIAL_EXTENSION: 'Trial extension' };
export const SCOPE_LABEL: Record<CouponScope, string> = { ONE_TIME: 'One-time', RECURRING: 'Recurring', REFERRAL: 'Referral' };
export const TYPE_COLOR: Record<CouponType, string> = { PERCENTAGE: 'var(--chart-1)', FIXED_AMOUNT: 'var(--chart-2)', TRIAL_EXTENSION: 'var(--chart-3)' };
export const STATUS_TONE: Record<CouponStatus, ChipTone> = { active: 'green', disabled: 'slate', expired: 'red', exhausted: 'amber', scheduled: 'blue' };
export const STATUS_LABEL: Record<CouponStatus, string> = { active: 'Active', disabled: 'Disabled', expired: 'Expired', exhausted: 'Exhausted', scheduled: 'Scheduled' };
export const TYPE_TONE: Record<CouponType, ChipTone> = { PERCENTAGE: 'blue', FIXED_AMOUNT: 'violet', TRIAL_EXTENSION: 'green' };

const num = (v: string | number | null | undefined) => (v === null || v === undefined ? 0 : Number(v));

export function valueLabel(c: Pick<Coupon, 'type' | 'percentOff' | 'amountOff' | 'currency' | 'trialExtensionDays'>): string {
  if (c.type === 'PERCENTAGE') return `${num(c.percentOff)}% off`;
  if (c.type === 'FIXED_AMOUNT') return `${money(num(c.amountOff), c.currency ?? 'INR')} off`;
  return `+${num(c.trialExtensionDays)} trial days`;
}

export function couponStatus(c: Coupon, now: number): CouponStatus {
  if (c.computed) return c.computed.status;
  if (!c.isActive) return 'disabled';
  if (c.expiresAt && new Date(c.expiresAt).getTime() < now) return 'expired';
  if (c.maxRedemptions && c.timesRedeemed >= c.maxRedemptions) return 'exhausted';
  return 'active';
}

export const daysLeft = (iso: string, now: number): number => Math.ceil((new Date(iso).getTime() - now) / 86_400_000);

/** "in 5d" / "today" / "3d ago" plus an urgency flag for the red styling. */
export function expiryInfo(iso: string | null, now: number | null): { text: string; date: string; soon: boolean; past: boolean } {
  if (!iso) return { text: 'Never', date: '', soon: false, past: false };
  if (now === null) return { text: fmtDate(iso), date: fmtDate(iso), soon: false, past: false };
  const d = daysLeft(iso, now);
  if (d < 0) return { text: `${-d}d ago`, date: fmtDate(iso), soon: false, past: true };
  return { text: d === 0 ? 'today' : `in ${d}d`, date: fmtDate(iso), soon: d <= 7, past: false };
}

export function relativeAgo(iso: string | null | undefined, now: number | null): string {
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

/** Random, unambiguous code (no I/O/0/1), matching the API's bulk alphabet. */
export function randomCode(prefix = 'FIT', len = 6): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  return `${prefix}${Array.from(buf, (n) => A[n % A.length]).join('')}`;
}

export const csvCell = (v: unknown): string => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows: unknown[][]): string => rows.map((r) => r.map(csvCell).join(',')).join('\n');

/** End of the picked local day as ISO (so "today" still counts as the future on create). */
export const endOfDayIso = (ymd: string): string => new Date(`${ymd}T23:59:59`).toISOString();
export const toYmd = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const todayYmd = (): string => toYmd(new Date().toISOString());

/** Same rules as the API (create/bulk), used for inline field errors before submitting. */
export interface ValueFields { type: CouponType; percentOff: string; amountOff: string; currency: string; trialDays: string }
export function validateValue(v: ValueFields): Record<string, string> {
  const e: Record<string, string> = {};
  if (v.type === 'PERCENTAGE') {
    const n = Number(v.percentOff);
    if (!v.percentOff || Number.isNaN(n) || n < 1 || n > 100) e.percentOff = 'Enter 1–100.';
  } else if (v.type === 'FIXED_AMOUNT') {
    if (!(Number(v.amountOff) > 0)) e.amountOff = 'Enter an amount above 0.';
    if (!/^[A-Za-z]{3}$/.test(v.currency.trim())) e.currency = '3-letter code, e.g. INR.';
  } else {
    const n = Number(v.trialDays);
    if (!Number.isInteger(n) || n < 1) e.trialExtensionDays = 'Enter whole days (1+).';
  }
  return e;
}
export function valuePayload(v: ValueFields): { percentOff?: number; amountOff?: number; currency?: string; trialExtensionDays?: number } {
  if (v.type === 'PERCENTAGE') return { percentOff: Number(v.percentOff) };
  if (v.type === 'FIXED_AMOUNT') return { amountOff: Number(v.amountOff), currency: v.currency.trim().toUpperCase() };
  return { trialExtensionDays: Number(v.trialDays) };
}
export function optInt(s: string): { ok: boolean; value?: number } {
  if (!s.trim()) return { ok: true };
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? { ok: true, value: n } : { ok: false };
}
