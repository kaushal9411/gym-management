'use client';

import * as React from 'react';

import { formatMoney } from '@/features/members/components/detail/detail-ui';
import { compactMoney, num, pctChange } from '@/features/finance/components/payments/payments-ui';
import { useCurrencySymbol } from '@/lib/currency';

export { num, pctChange, compactMoney, formatMoney };

export type ValueFormat = 'number' | 'money' | 'percent' | 'text';

/** Formats a number for display; `compact` shortens money (4.8L / 12k) and numbers (1.2k). */
export function formatValue(format: ValueFormat, value: number, symbol: string, compact = false): string {
  switch (format) {
    case 'money':
      return compact ? compactMoney(symbol, value) : formatMoney(symbol, value);
    case 'percent':
      return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
    default:
      return compact && Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k` : Math.round(value).toLocaleString();
  }
}

/** Hook returning `(n, compact?) => string` for a format, with the tenant currency symbol bound. */
export function useValueFormatter(format: ValueFormat = 'number'): (n: number, compact?: boolean) => string {
  const symbol = useCurrencySymbol();
  return React.useCallback((n: number, compact?: boolean) => formatValue(format, n, symbol, compact), [format, symbol]);
}

/** Short axis/day label from a `yyyy-mm-dd` string (e.g. "4 Oct"). */
export function shortDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString(undefined, opts ?? { day: 'numeric', month: 'short' });
}
