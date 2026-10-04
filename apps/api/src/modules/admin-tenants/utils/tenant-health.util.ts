/**
 * Tenant health score (0..100) — deterministic weighted blend of four components, each 0..100:
 *
 *   score = round( 0.40·engagement + 0.30·billing + 0.15·utilisation + 0.15·support )
 *
 * - engagement  = 0.6·recency + 0.4·volume
 *     recency: days since the last tenant activity (staff login or attendance check-in):
 *       ≤1d 100 · ≤3d 90 · ≤7d 75 · ≤14d 55 · ≤30d 30 · older 10 · never 0 (never + tenant ≤3 days old = 50, a grace for new sign-ups)
 *     volume: check-ins in the last 14 days (capped at 1000) per member; 0.5/member = 100. Unknown/zero members -> 60 if any check-in else 0.
 * - billing     = min(tenant-status base, subscription-status base), minus 40 if the latest platform payment FAILED (floored at 0)
 *     tenant: ACTIVE 100 · TRIAL 70 (20 once the trial has lapsed) · PAST_DUE 25 · SUSPENDED 5 · CANCELLED 0
 *     subscription: ACTIVE 100 · TRIALING 70 · none 70 · PAST_DUE 25 · GRACE 10 · SUSPENDED/CANCELED/EXPIRED 0
 * - utilisation: ≥100% of any limit 30 · ≥90% 50 · otherwise, on a PAID plan, members/limit: <5% 30 · <15% 55 · <30% 75 · else 100;
 *     unpaid (trial/free) tenants with headroom score a neutral 80.
 * - support     = open + in-progress tickets: 0 -> 100 · 1 -> 80 · 2 -> 60 · 3-4 -> 40 · ≥5 -> 20
 *
 * Buckets: at_risk 0-40 · fair 41-70 · healthy 71-100. `HEALTH_DISTRIBUTION_BUCKETS` are the 5 insight bands.
 * Pure — no I/O — so the tenant-detail overview can reuse `computeHealth`.
 */
const DAY_MS = 86_400_000;

export interface HealthInputs {
  tenantStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED' | string;
  subscriptionStatus: string | null;
  trialEndsAt: Date | null;
  /** Latest platform payment of the tenant is FAILED. */
  paymentFailed: boolean;
  /** Latest staff login / attendance check-in; null = never. */
  lastActiveAt: Date | null;
  /** Attendance check-ins in the last 14 days (cap 1000 applied here). */
  attendanceRecent: number;
  members: number | null;
  /** Highest usage/limit ratio across metrics (1 = at limit); null if unknown. */
  maxUtilisation: number | null;
  /** members / max members (1 = at limit); null if unknown or unlimited. */
  membersUtilisation: number | null;
  /** True when the tenant is on an ACTIVE paid subscription. */
  paid: boolean;
  /** Open + in-progress support tickets. */
  openTickets: number;
  createdAt: Date;
}

export interface HealthComponents {
  engagement: number;
  billing: number;
  utilisation: number;
  support: number;
}

export const HEALTH_WEIGHTS = {
  engagement: 0.4,
  billing: 0.3,
  utilisation: 0.15,
  support: 0.15,
} as const;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function recencyScore(i: HealthInputs, now: Date): number {
  if (!i.lastActiveAt) {
    return now.getTime() - i.createdAt.getTime() <= 3 * DAY_MS ? 50 : 0;
  }
  const days = (now.getTime() - i.lastActiveAt.getTime()) / DAY_MS;
  if (days <= 1) return 100;
  if (days <= 3) return 90;
  if (days <= 7) return 75;
  if (days <= 14) return 55;
  if (days <= 30) return 30;
  return 10;
}

function volumeScore(i: HealthInputs): number {
  const recent = Math.min(1000, Math.max(0, i.attendanceRecent));
  if (!i.members || i.members <= 0) return recent > 0 ? 60 : 0;
  return clamp((recent / i.members / 0.5) * 100);
}

const TENANT_BILLING: Record<string, number> = {
  ACTIVE: 100,
  TRIAL: 70,
  PAST_DUE: 25,
  SUSPENDED: 5,
  CANCELLED: 0,
};
const SUB_BILLING: Record<string, number> = {
  ACTIVE: 100,
  TRIALING: 70,
  PAST_DUE: 25,
  GRACE: 10,
  SUSPENDED: 0,
  CANCELED: 0,
  EXPIRED: 0,
};

function billingScore(i: HealthInputs, now: Date): number {
  let tenantBase = TENANT_BILLING[i.tenantStatus] ?? 50;
  if (i.tenantStatus === 'TRIAL' && i.trialEndsAt && i.trialEndsAt.getTime() < now.getTime())
    tenantBase = 20;
  const subBase = i.subscriptionStatus ? (SUB_BILLING[i.subscriptionStatus] ?? 50) : 70;
  const base = Math.min(tenantBase, subBase);
  return clamp(i.paymentFailed ? base - 40 : base);
}

function utilisationScore(i: HealthInputs): number {
  const u = i.maxUtilisation;
  if (u !== null && u >= 1) return 30;
  if (u !== null && u >= 0.9) return 50;
  if (!i.paid) return 80;
  const m = i.membersUtilisation;
  if (m === null) return 55;
  if (m < 0.05) return 30;
  if (m < 0.15) return 55;
  if (m < 0.3) return 75;
  return 100;
}

function supportScore(open: number): number {
  if (open <= 0) return 100;
  if (open === 1) return 80;
  if (open === 2) return 60;
  if (open <= 4) return 40;
  return 20;
}

export function computeHealth(
  inputs: HealthInputs,
  now: Date = new Date(),
): { score: number; components: HealthComponents } {
  const components: HealthComponents = {
    engagement: clamp(0.6 * recencyScore(inputs, now) + 0.4 * volumeScore(inputs)),
    billing: billingScore(inputs, now),
    utilisation: utilisationScore(inputs),
    support: supportScore(inputs.openTickets),
  };
  const score = clamp(
    HEALTH_WEIGHTS.engagement * components.engagement +
      HEALTH_WEIGHTS.billing * components.billing +
      HEALTH_WEIGHTS.utilisation * components.utilisation +
      HEALTH_WEIGHTS.support * components.support,
  );
  return { score, components };
}

export type HealthBucket = 'at_risk' | 'fair' | 'healthy';
export const HEALTH_BUCKETS: HealthBucket[] = ['at_risk', 'fair', 'healthy'];

export function healthBucket(score: number): HealthBucket {
  if (score <= 40) return 'at_risk';
  if (score <= 70) return 'fair';
  return 'healthy';
}

export const HEALTH_DISTRIBUTION_BUCKETS = ['0-20', '21-40', '41-60', '61-80', '81-100'] as const;

export function distributionBucket(score: number): (typeof HEALTH_DISTRIBUTION_BUCKETS)[number] {
  if (score <= 20) return '0-20';
  if (score <= 40) return '21-40';
  if (score <= 60) return '41-60';
  if (score <= 80) return '61-80';
  return '81-100';
}

export function healthDistribution(scores: number[]): Array<{ bucket: string; count: number }> {
  const counts = new Map<string, number>(HEALTH_DISTRIBUTION_BUCKETS.map((b) => [b, 0]));
  for (const s of scores) {
    const b = distributionBucket(s);
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  return HEALTH_DISTRIBUTION_BUCKETS.map((bucket) => ({ bucket, count: counts.get(bucket) ?? 0 }));
}
