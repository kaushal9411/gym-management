import type { Campaign } from '../types';

const DAY_FMT = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const TIME_FMT = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
const FULL_FMT = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** "Today 9:40 am" / "Tomorrow 9:00 am" / "17 Oct, 6:00 pm" in the viewer's time zone. */
export function formatWhen(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const time = TIME_FMT.format(d).toLowerCase();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return `Today ${time}`;
  if (sameDay(d, tomorrow)) return `Tomorrow ${time}`;
  if (sameDay(d, yesterday)) return `Yesterday ${time}`;
  return `${DAY_FMT.format(d)}, ${time}`;
}

export function formatFull(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : FULL_FMT.format(d).toLowerCase();
}

/** The time that best describes a campaign row: scheduled send, otherwise when it started (or was created). */
export function campaignWhen(c: Campaign): string {
  if (c.status === 'SCHEDULED') return `Scheduled · ${formatWhen(c.scheduledAt)}`;
  return formatWhen(c.startedAt ?? c.createdAt);
}

export const fmtNum = (n: number): string => n.toLocaleString('en-IN');
