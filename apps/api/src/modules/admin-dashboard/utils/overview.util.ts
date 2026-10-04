import {
  addDaysStr,
  resolveRanges,
  type DateRange,
} from '../../finance/utils/payments-analytics.util';

export const OVERVIEW_RANGES = ['7d', '30d', '90d', '12m'] as const;
export type OverviewRange = (typeof OVERVIEW_RANGES)[number];

const DAY_MS = 86_400_000;

/** Window length in days: `Nd` = N, `12m` = 365. */
export const rangeDays = (range: OverviewRange): number =>
  range === '12m' ? 365 : Number.parseInt(range, 10);

/** `7d` = today and the 6 days before it (UTC days, inclusive). Previous = the immediately preceding window of equal length (reuses the finance `resolveRanges`). */
export function resolveOverviewRanges(
  range: OverviewRange,
  now: Date = new Date(),
): { range: DateRange; previousRange: DateRange } {
  const days = rangeDays(range);
  const to = now.toISOString().slice(0, 10);
  const r = resolveRanges(addDaysStr(to, -(days - 1)), to, now);
  return { range: r.range, previousRange: r.previousRange };
}

export const money = (n: number): string => n.toFixed(2);

export interface DailyPoint {
  date: string;
  value: number;
}

/** Every UTC day in [from,to], missing days = 0. */
export function zeroFillDays(range: DateRange, byDay: Map<string, number>): DailyPoint[] {
  const out: DailyPoint[] = [];
  for (let d = range.from; d <= range.to; d = addDaysStr(d, 1))
    out.push({ date: d, value: byDay.get(d) ?? 0 });
  return out;
}

/** Current series with the previous-window value at the same index (null when the previous window is shorter). */
export function alignSeries(
  range: DateRange,
  previousRange: DateRange,
  byDay: Map<string, number>,
): Array<{ date: string; value: number; previousValue: number }> {
  const current = zeroFillDays(range, byDay);
  const previous = zeroFillDays(previousRange, byDay);
  return current.map((p, i) => ({
    date: p.date,
    value: p.value,
    previousValue: previous[i]?.value ?? 0,
  }));
}

export const sumValues = (points: Array<{ value: number }>): number =>
  points.reduce((s, p) => s + p.value, 0);

/** Share (0..1) of trials that ended in a window and are now ACTIVE paid; null when no trial ended. */
export function trialConversionRate(ended: number, converted: number): number | null {
  if (ended <= 0) return null;
  return Math.min(1, converted / ended);
}

export function daysLeft(trialEndsAt: Date, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / DAY_MS));
}

export function oldestOpenDays(createdAt: Date | null, now: Date = new Date()): number | null {
  return createdAt ? Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / DAY_MS)) : null;
}

/** Monthly-normalised plan price (yearly / 12). */
export function monthlyPrice(
  cycle: 'MONTHLY' | 'YEARLY',
  priceMonthly: number,
  priceYearly: number,
): number {
  return cycle === 'YEARLY' ? priceYearly / 12 : priceMonthly;
}

// ── At-risk ────────────────────────────────────────────────────────────────
export type AtRiskReason =
  'PAYMENT_FAILED' | 'GRACE' | 'PAST_DUE' | 'SUSPENDED_RECENTLY' | 'NEAR_LIMIT';
/** Most severe first. */
export const AT_RISK_PRECEDENCE: AtRiskReason[] = [
  'PAYMENT_FAILED',
  'GRACE',
  'PAST_DUE',
  'SUSPENDED_RECENTLY',
  'NEAR_LIMIT',
];

export interface AtRiskCandidate {
  tenantId: string;
  slug: string;
  name: string;
  reason: AtRiskReason;
  detail: string;
}

/** Each tenant once with its most severe reason; ordered by severity (stable within a reason); capped. */
export function pickAtRisk(candidates: AtRiskCandidate[], max = 10): AtRiskCandidate[] {
  const rank = (r: AtRiskReason) => AT_RISK_PRECEDENCE.indexOf(r);
  const best = new Map<string, AtRiskCandidate>();
  for (const c of candidates) {
    const existing = best.get(c.tenantId);
    if (!existing || rank(c.reason) < rank(existing.reason)) best.set(c.tenantId, c);
  }
  return [...best.values()]
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c.reason) - rank(b.c.reason) || a.i - b.i)
    .slice(0, max)
    .map((x) => x.c);
}

// ── Activity summary ───────────────────────────────────────────────────────
const KNOWN_ACTIONS: Record<string, string> = {
  'admin.tenant_status_changed': 'Tenant status changed',
  'admin.tenant_deleted': 'Tenant deleted',
  'admin.tenant_owner_password_reset': 'Tenant owner password reset sent',
  'admin.tenant_impersonated': 'Tenant impersonation started',
  'admin.tenant_trial_extended': 'Tenant trial extended',
  'admin.tenant_maintenance_changed': 'Tenant maintenance mode changed',
  'admin.tenant_force_logout': 'Tenant sessions force-revoked',
};

/** Short human string from action + entity type. Never includes ids, emails or payload values (no PII). */
export function buildActivitySummary(action: string, entityType: string | null): string {
  const known = KNOWN_ACTIONS[action];
  if (known) return known;
  const words = action
    .replace(/^admin[._]/, '')
    .split(/[._]+/)
    .join(' ')
    .trim();
  const text = words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Admin action';
  return entityType && !text.toLowerCase().includes(entityType.toLowerCase())
    ? `${text} (${entityType})`
    : text;
}

// ── Trial funnel / ARPA / top tenants ──────────────────────────────────────
export interface TrialFunnel {
  started: number;
  activated: number;
  converted: number;
  expired: number;
}

/** Counts are clamped to be non-negative integers; null when no trial started in the window. */
export function buildTrialFunnel(raw: {
  started: number;
  activated: number;
  converted: number;
  expired: number;
}): TrialFunnel | null {
  const n = (v: number) => Math.max(0, Math.round(Number(v) || 0));
  if (n(raw.started) === 0) return null;
  return {
    started: n(raw.started),
    activated: n(raw.activated),
    converted: n(raw.converted),
    expired: n(raw.expired),
  };
}

/** MRR ÷ ACTIVE paid subscriptions (one per tenant). Null when MRR is unknown or there are none; previous null when MRR previous is null. */
export function buildArpa(
  mrr: number | null,
  activePaid: number,
  previousMrr: number | null = null,
): { value: string; previous: string | null } | null {
  if (mrr === null || activePaid <= 0) return null;
  return {
    value: money(mrr / activePaid),
    previous: previousMrr === null ? null : money(previousMrr / activePaid),
  };
}

export interface TopTenantRow {
  mrr: number | null;
  members: number | null;
}

/** MRR desc (nulls last), then members desc (nulls last). Stable. */
export function sortTopTenants<T extends TopTenantRow>(rows: T[]): T[] {
  const cmp = (a: number | null, b: number | null) =>
    a === b ? 0 : a === null ? 1 : b === null ? -1 : b - a;
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => cmp(a.r.mrr, b.r.mrr) || cmp(a.r.members, b.r.members) || a.i - b.i)
    .map((x) => x.r);
}
