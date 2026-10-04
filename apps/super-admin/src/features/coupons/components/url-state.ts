import type { CouponStatus, CouponType } from '../types';

/** List filters live in the URL query string (single source of truth); defaults are omitted. */
export type CouponSort = 'newest' | 'redeemed' | 'discount' | 'expiry';
export type StatusFilter = Exclude<CouponStatus, 'scheduled'> | '';
export interface CouponFilters { q: string; status: StatusFilter; type: CouponType | ''; sort: CouponSort; page: number }

export const STATUS_FILTERS: Array<Exclude<CouponStatus, 'scheduled'>> = ['active', 'disabled', 'expired', 'exhausted'];
export const TYPES: CouponType[] = ['PERCENTAGE', 'FIXED_AMOUNT', 'TRIAL_EXTENSION'];
export const SORTS: Array<{ value: CouponSort; label: string }> = [
  { value: 'newest', label: 'Newest first' }, { value: 'redeemed', label: 'Most redeemed' },
  { value: 'discount', label: 'Discount given' }, { value: 'expiry', label: 'Expiring soonest' },
];
export const PAGE_SIZE = 12;

const pick = <T extends string>(v: string | null, all: readonly T[]): T | '' => (v && (all as readonly string[]).includes(v) ? (v as T) : '');

export function parseFilters(sp: URLSearchParams): CouponFilters {
  return {
    q: sp.get('q') ?? '',
    status: pick(sp.get('status'), STATUS_FILTERS),
    type: pick(sp.get('type'), TYPES),
    sort: pick(sp.get('sort'), SORTS.map((s) => s.value)) || 'newest',
    page: Math.max(1, Math.floor(Number(sp.get('page'))) || 1),
  };
}

export function toSearchString(f: CouponFilters): string {
  const sp = new URLSearchParams();
  if (f.q) sp.set('q', f.q);
  if (f.status) sp.set('status', f.status);
  if (f.type) sp.set('type', f.type);
  if (f.sort !== 'newest') sp.set('sort', f.sort);
  if (f.page > 1) sp.set('page', String(f.page));
  return sp.toString();
}
