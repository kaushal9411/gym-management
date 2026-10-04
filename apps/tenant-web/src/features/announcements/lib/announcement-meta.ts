import { Globe, UserCog, Users, type LucideIcon } from 'lucide-react';
import * as React from 'react';

import { accentColor, seriesColor } from '@/features/reports/lib/reports-theme';
import type { AnnouncementAudience, AnnouncementStatus } from '../types';

/**
 * "Communication" accent. The shared `ReportAccent` union has no such entry (and the shared theme is not ours to edit),
 * so it is composed locally from existing chart tokens: rose -> orange hero, magenta as the solid accent colour.
 */
export const COMM_COLOR = accentColor('staff');
export const COMM_HERO_GRADIENT =
  'radial-gradient(900px 320px at 88% -30%, color-mix(in oklch, #f97316 75%, transparent), transparent 60%), linear-gradient(115deg, #be185d, #e11d48 60%, #f97316)';
export const commTint = (pct = 14): string => `color-mix(in oklch, ${COMM_COLOR} ${pct}%, transparent)`;
export const tint = (color: string, pct = 14): string => `color-mix(in oklch, ${color} ${pct}%, transparent)`;

export const STATUS_META: Record<AnnouncementStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'var(--muted-foreground)' },
  SCHEDULED: { label: 'Scheduled', color: accentColor('operations') },
  PUBLISHED: { label: 'Published', color: 'var(--success)' },
  EXPIRED: { label: 'Expired', color: accentColor('staff') },
};

export const AUDIENCE_META: Record<AnnouncementAudience, { label: string; short: string; hint: string; icon: LucideIcon; color: string }> = {
  ALL: { label: 'Everyone', short: 'Everyone', hint: 'Members and staff', icon: Globe, color: seriesColor(0) },
  MEMBERS: { label: 'Members only', short: 'Members', hint: 'Visible to gym members', icon: Users, color: seriesColor(2) },
  STAFF: { label: 'Staff only', short: 'Staff', hint: 'Visible to your team', icon: UserCog, color: seriesColor(3) },
};

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function fmtDay(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "in 2h 15m" / "in 3d" / "now" / "2d ago" relative to `now` (ms). */
export function relativeTo(iso: string, now: number): string {
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const mins = Math.floor(abs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const text = days >= 2 ? `${days}d` : hours >= 1 ? `${hours}h ${mins % 60}m` : mins >= 1 ? `${mins}m` : '';
  if (!text) return 'now';
  return diff >= 0 ? `in ${text}` : `${text} ago`;
}

/** Expiry timestamps are stored as dates; treat them as end-of-day when counting down. */
export function expiryRelative(iso: string, now: number): string {
  const d = new Date(iso);
  if (iso.length <= 10 || (d.getUTCHours() === 0 && d.getUTCMinutes() === 0)) d.setHours(23, 59, 59, 0);
  return relativeTo(d.toISOString(), now);
}

/** Ticks once a minute so countdowns stay fresh. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
