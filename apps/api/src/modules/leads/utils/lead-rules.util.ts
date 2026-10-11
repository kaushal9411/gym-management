import type { LeadStatusValue } from '../validators/lead.validators';

export const OPEN_STATUSES: readonly LeadStatusValue[] = ['NEW', 'CONTACTED', 'VISIT_SCHEDULED', 'TRIAL_DONE', 'NEGOTIATION'];
export const CLOSED_STATUSES: readonly LeadStatusValue[] = ['CONVERTED', 'LOST'];

export const isOpenStatus = (s: LeadStatusValue): boolean => OPEN_STATUSES.includes(s);

/** Funnel order — index = how far a lead got (CONVERTED is the last stage). */
export const FUNNEL_STAGES: readonly LeadStatusValue[] = ['NEW', 'CONTACTED', 'VISIT_SCHEDULED', 'TRIAL_DONE', 'NEGOTIATION', 'CONVERTED'];

/** Digits only, last 10 — so "+91 90000-00001", "090000 00001" and "9000000001" all collide. */
export function phoneKeyOf(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function normalizeLeadEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** A lead blocks a new/updated lead with the same phone/email only while it is still being worked. */
export function isBlockingLeadStatus(status: LeadStatusValue): boolean {
  return isOpenStatus(status);
}

/**
 * Returns the reason a status change is refused, or null when allowed.
 * Open -> any other open status (forward or back) and Open -> LOST are fine; LOST can be re-opened to any open status;
 * CONVERTED is terminal and only reachable through the convert endpoint.
 */
export function statusTransitionError(from: LeadStatusValue, to: LeadStatusValue, lostReason?: string | null): string | null {
  if (from === to) return `The lead is already ${to}.`;
  if (to === 'CONVERTED') return 'Use the convert endpoint to convert a lead into a member.';
  if (from === 'CONVERTED') return 'A converted lead cannot change status.';
  if (to === 'LOST' && !lostReason) return 'A reason is required when marking a lead as lost.';
  return null;
}

export type FollowUpBucket = 'overdue' | 'today' | 'upcoming' | 'none';

export const utcDayStart = (d: Date): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** UTC-day buckets: overdue = before today, today = today, upcoming = after today. Closed leads never have a follow-up. */
export function followUpBucket(nextFollowUpAt: Date | null, status: LeadStatusValue, now: Date = new Date()): FollowUpBucket {
  if (!nextFollowUpAt || !isOpenStatus(status)) return 'none';
  const start = utcDayStart(now).getTime();
  const t = nextFollowUpAt.getTime();
  if (t < start) return 'overdue';
  if (t < start + 86_400_000) return 'today';
  return 'upcoming';
}

/** Day boundaries (UTC) used by the follow-up filters/counters. */
export function followUpBoundaries(now: Date = new Date()): { start: Date; end: Date } {
  const start = utcDayStart(now);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

/** Spreadsheet-safe CSV cell: neutralises formula triggers (= + - @ tab CR) and quotes when needed. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function splitName(full: string): { firstName: string; lastName: string | null } {
  const parts = full.trim().split(/\s+/);
  const firstName = parts.shift() ?? '';
  return { firstName, lastName: parts.length ? parts.join(' ') : null };
}

/** Maps a lead source onto the closest member `awarenessSource` so the conversion keeps the marketing attribution. */
export function awarenessSourceFor(source: string): 'SOCIAL_MEDIA' | 'FRIEND_REFERRAL' | 'WALK_IN' | 'ADVERTISEMENT' | 'ONLINE_SEARCH' | 'OTHER' {
  switch (source) {
    case 'WALK_IN':
      return 'WALK_IN';
    case 'SOCIAL_MEDIA':
      return 'SOCIAL_MEDIA';
    case 'REFERRAL':
      return 'FRIEND_REFERRAL';
    case 'ADVERTISEMENT':
      return 'ADVERTISEMENT';
    case 'WEBSITE':
      return 'ONLINE_SEARCH';
    default:
      return 'OTHER';
  }
}
