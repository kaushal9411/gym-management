'use client';

import * as React from 'react';

import { useTenant } from '@/features/tenant/tenant-provider';

/**
 * Portal-local formatters. The staff `useCurrencySymbol` calls the staff
 * `apiClient` (business settings), which must never run on the member plane,
 * so currency comes from the tenant context (`tenant.currency`, ISO code).
 */

export function currencySymbol(code: string | undefined): string {
  try {
    const part = new Intl.NumberFormat('en', { style: 'currency', currency: code || 'INR', currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((p) => p.type === 'currency');
    return part?.value ?? '₹';
  } catch {
    return '₹';
  }
}

export function parseMoney(v: string | number | null | undefined): number {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function formatMoneyFor(code: string | undefined, value: string | number | null | undefined, compact = false): string {
  const n = parseMoney(value);
  const symbol = currencySymbol(code);
  const locale = (code ?? 'INR') === 'INR' ? 'en-IN' : undefined;
  if (compact && Math.abs(n) >= 1000) {
    const s = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
    return `${symbol}${s}`;
  }
  return `${symbol}${n.toLocaleString(locale, { maximumFractionDigits: 2 })}`;
}

/** `{symbol, code, format(value, compact?)}` bound to the tenant currency (member-plane safe). */
export function usePortalMoney() {
  const { currency } = useTenant();
  return React.useMemo(
    () => ({ code: currency, symbol: currencySymbol(currency), format: (v: string | number | null | undefined, compact = false) => formatMoneyFor(currency, v, compact) }),
    [currency],
  );
}

function toDate(iso: string): Date {
  return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
}

/** "4 Oct 2026" */
export function formatDate(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return '';
  return toDate(iso).toLocaleDateString(undefined, opts ?? { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "Today" / "Tomorrow" / "Mon, 6 Oct" */
export function formatDay(iso: string): string {
  const d = toDate(iso);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(d) - start(new Date())) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "18:30" -> "6:30 PM" (anything unparsable is returned as-is) */
export function formatTime(hhmm: string | null | undefined): string {
  if (!hhmm) return '';
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function timeGreeting(date = new Date()): string {
  const h = date.getHours();
  return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Good night';
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase() || '?';
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
