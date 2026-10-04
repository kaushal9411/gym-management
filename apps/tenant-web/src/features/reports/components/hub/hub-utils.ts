import type { ReportsOverview } from '../../types';

export const WEEKDAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const NUM_TO_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Normalises the API weekday (0-6 with 0=Sunday, 7=Sunday, or a name) to a Mon-first 3-letter label. */
export function weekdayLabel(w: number | string): string {
  if (typeof w === 'number') return NUM_TO_DAY[w % 7] ?? String(w);
  const n = Number(w);
  if (w.trim() !== '' && Number.isFinite(n)) return NUM_TO_DAY[n % 7] ?? w;
  const s = w.slice(0, 3);
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function hourLabel(h: number): string {
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh} ${suffix}`;
}

export function titleCase(s: string): string {
  return s
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export type HubOverview = ReportsOverview | undefined;
