export type PeriodKey = 'today' | '7d' | 'month' | 'lastMonth' | '90d' | 'custom';

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: 'month', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: '90d', label: '90 days' },
  { key: 'custom', label: 'Custom' },
];

/** Local-time yyyy-mm-dd (never `toISOString`, which would shift the day in non-UTC zones). */
export function toYmd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function computeRange(key: PeriodKey, custom: { from: string; to: string }, now: Date = new Date()): { from: string; to: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (key) {
    case 'today':
      return { from: toYmd(today), to: toYmd(today) };
    case '7d':
      return { from: toYmd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)), to: toYmd(today) };
    case 'month':
      return { from: toYmd(new Date(today.getFullYear(), today.getMonth(), 1)), to: toYmd(today) };
    case 'lastMonth':
      return { from: toYmd(new Date(today.getFullYear(), today.getMonth() - 1, 1)), to: toYmd(new Date(today.getFullYear(), today.getMonth(), 0)) };
    case '90d':
      return { from: toYmd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 89)), to: toYmd(today) };
    case 'custom':
      return custom;
  }
}

export function periodNoun(key: PeriodKey): string {
  switch (key) {
    case 'today':
      return 'today';
    case '7d':
      return 'in the last 7 days';
    case 'month':
      return 'this month';
    case 'lastMonth':
      return 'last month';
    case '90d':
      return 'in the last 90 days';
    case 'custom':
      return 'in this period';
  }
}
