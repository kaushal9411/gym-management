/**
 * Pure logic for the admin Plans page (stats, MRR, impact, duplicate slugs,
 * delete blocking). No I/O — everything is unit-tested in plan-insights.util.spec.ts.
 *
 * MRR rule (Prompt 120–123): ACTIVE paid subscriptions only, monthly-normalised
 * (MONTHLY -> priceMonthly, YEARLY -> priceYearly / 12), at the plan's CURRENT price.
 * Money is only ever summed within one currency.
 */

export type Cycle = 'MONTHLY' | 'YEARLY';

export const DAY_MS = 86_400_000;

/** Statuses that block `DELETE /admin/plans/:id` (tenants still depend on the plan). */
export const PLAN_DELETE_BLOCKING_STATUSES = ['ACTIVE', 'TRIALING', 'PAST_DUE', 'GRACE'] as const;

export const money = (n: number): string => n.toFixed(2);

export interface PlanPricing {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
}

/** One row of `subscription.groupBy({ by: [planId, status, billingCycle] })`. */
export interface SubGroupRow {
  planId: string;
  status: string;
  billingCycle: Cycle;
  count: number;
}

export interface PlanStats {
  activeSubscribers: number;
  trialSubscribers: number;
  pastDueSubscribers: number;
  mrr: string;
  share: number;
}

export interface PlanAgg {
  active: number;
  trial: number;
  pastDue: number;
  monthly: number;
  yearly: number;
  mrr: number;
}

/** Monthly-normalised value of one subscription on a cycle. */
export const monthlyValue = (
  plan: Pick<PlanPricing, 'priceMonthly' | 'priceYearly'>,
  cycle: Cycle,
): number => (cycle === 'YEARLY' ? plan.priceYearly / 12 : plan.priceMonthly);

/** Amount billed at the next renewal for one subscription on a cycle. */
export const renewalValue = (
  plan: Pick<PlanPricing, 'priceMonthly' | 'priceYearly'>,
  cycle: Cycle,
): number => (cycle === 'YEARLY' ? plan.priceYearly : plan.priceMonthly);

/** Collapse grouped rows into per-plan aggregates (PAST_DUE + GRACE both count as past due). */
export function aggregateByPlan(rows: SubGroupRow[], plans: PlanPricing[]): Map<string, PlanAgg> {
  const byId = new Map(plans.map((p) => [p.id, p]));
  const out = new Map<string, PlanAgg>();
  for (const row of rows) {
    const plan = byId.get(row.planId);
    if (!plan) continue;
    const agg = out.get(row.planId) ?? {
      active: 0,
      trial: 0,
      pastDue: 0,
      monthly: 0,
      yearly: 0,
      mrr: 0,
    };
    if (row.status === 'ACTIVE') {
      agg.active += row.count;
      if (row.billingCycle === 'YEARLY') agg.yearly += row.count;
      else agg.monthly += row.count;
      agg.mrr += row.count * monthlyValue(plan, row.billingCycle);
    } else if (row.status === 'TRIALING') agg.trial += row.count;
    else if (row.status === 'PAST_DUE' || row.status === 'GRACE') agg.pastDue += row.count;
    out.set(row.planId, agg);
  }
  return out;
}

export const EMPTY_AGG: PlanAgg = {
  active: 0,
  trial: 0,
  pastDue: 0,
  monthly: 0,
  yearly: 0,
  mrr: 0,
};

/** Total MRR per currency. */
export function mrrByCurrency(
  aggs: Map<string, PlanAgg>,
  plans: PlanPricing[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const plan of plans) {
    const agg = aggs.get(plan.id);
    if (!agg || agg.mrr === 0) continue;
    out.set(plan.currency, (out.get(plan.currency) ?? 0) + agg.mrr);
  }
  return out;
}

/** The headline currency: INR when it has MRR (platform default), else the currency with the most MRR, else INR. */
export function dominantCurrency(totals: Map<string, number>): string {
  if ((totals.get('INR') ?? 0) > 0) return 'INR';
  let best = 'INR';
  let bestValue = -1;
  for (const [currency, value] of totals) {
    if (value > bestValue) {
      best = currency;
      bestValue = value;
    }
  }
  return best;
}

/** Share of the plan's MRR within its own currency's total (0..1, 4 dp). */
export function planShare(planMrr: number, currencyTotal: number): number {
  if (currencyTotal <= 0) return 0;
  return Math.round((planMrr / currencyTotal) * 10_000) / 10_000;
}

export function toStats(
  agg: PlanAgg | undefined,
  plan: PlanPricing,
  totals: Map<string, number>,
): PlanStats {
  const a = agg ?? EMPTY_AGG;
  return {
    activeSubscribers: a.active,
    trialSubscribers: a.trial,
    pastDueSubscribers: a.pastDue,
    mrr: money(a.mrr),
    share: planShare(a.mrr, totals.get(plan.currency) ?? 0),
  };
}

/** Yearly discount vs paying monthly for 12 months; null when the monthly price is 0. */
export function yearlyDiscountPct(priceMonthly: number, priceYearly: number): number | null {
  if (priceMonthly <= 0) return null;
  return Math.round((1 - priceYearly / (priceMonthly * 12)) * 1000) / 10;
}

export interface RenewalSub {
  planId: string;
  billingCycle: Cycle;
  currentPeriodEnd: Date;
}

export interface RenewalWeek {
  weekStart: string;
  subscriptions: number;
  expectedRevenue: string;
}

export const startOfUtcDay = (d: Date): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/**
 * Bucket ACTIVE subscriptions by their next renewal into `weeks` 7-day buckets starting at today's
 * UTC midnight (weekStart = YYYY-MM-DD). Revenue only sums subscriptions whose plan is in `currency`
 * (the count includes all currencies). Overdue renewals (before today) fall in the first bucket.
 */
export function bucketRenewals(
  subs: RenewalSub[],
  plans: PlanPricing[],
  currency: string,
  now: Date,
  weeks = 8,
): RenewalWeek[] {
  const byId = new Map(plans.map((p) => [p.id, p]));
  const start = startOfUtcDay(now).getTime();
  const buckets = Array.from({ length: weeks }, () => ({ subscriptions: 0, revenue: 0 }));
  for (const sub of subs) {
    const idx = Math.max(0, Math.floor((sub.currentPeriodEnd.getTime() - start) / (7 * DAY_MS)));
    if (idx >= weeks) continue;
    const bucket = buckets[idx]!;
    bucket.subscriptions += 1;
    const plan = byId.get(sub.planId);
    if (plan && plan.currency === currency) bucket.revenue += renewalValue(plan, sub.billingCycle);
  }
  return buckets.map((b, i) => ({
    weekStart: new Date(start + i * 7 * DAY_MS).toISOString().slice(0, 10),
    subscriptions: b.subscriptions,
    expectedRevenue: money(b.revenue),
  }));
}

export interface ImpactResult {
  affected: { activeSubscribers: number; monthlyCycle: number; yearlyCycle: number };
  currentMrr: string;
  projectedMrr: string;
  mrrDelta: string;
  mrrDeltaPct: number | null;
  renewalsInNext30Days: number;
  note: string;
}

export const IMPACT_NOTE =
  "Read-only projection. A price change applies only at each tenant's next renewal (renewals are re-priced from the plan's current price; the period already paid for is never re-billed), so MRR moves gradually as renewals occur. Coupons are not re-applied at renewal. Disabled plans cannot be renewed through self-service.";

export function computeImpact(
  plan: Pick<PlanPricing, 'priceMonthly' | 'priceYearly'>,
  next: { priceMonthly?: number; priceYearly?: number },
  counts: { monthly: number; yearly: number },
  renewalsInNext30Days: number,
): ImpactResult {
  const newMonthly = next.priceMonthly ?? plan.priceMonthly;
  const newYearly = next.priceYearly ?? plan.priceYearly;
  const current = counts.monthly * plan.priceMonthly + (counts.yearly * plan.priceYearly) / 12;
  const projected = counts.monthly * newMonthly + (counts.yearly * newYearly) / 12;
  const delta = projected - current;
  return {
    affected: {
      activeSubscribers: counts.monthly + counts.yearly,
      monthlyCycle: counts.monthly,
      yearlyCycle: counts.yearly,
    },
    currentMrr: money(current),
    projectedMrr: money(projected),
    mrrDelta: money(delta),
    mrrDeltaPct: current > 0 ? Math.round((delta / current) * 10_000) / 100 : null,
    renewalsInNext30Days,
    note: IMPACT_NOTE,
  };
}

const SLUG_MAX = 40;

/** `<slug>-copy`, `<slug>-copy-2`, ... first one not in `taken`; the base is trimmed so the result fits the 40-char slug column. */
export function nextCopySlug(baseSlug: string, taken: ReadonlySet<string>): string {
  for (let n = 1; n < 10_000; n += 1) {
    const suffix = n === 1 ? '-copy' : `-copy-${n}`;
    const candidate = `${baseSlug.slice(0, SLUG_MAX - suffix.length).replace(/-+$/, '')}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error('Could not find a free slug');
}

/** Counts of a plan's subscriptions per status, and whether any blocks deletion. */
export function deleteBlockers(countsByStatus: Record<string, number>): {
  blocked: boolean;
  total: number;
  message: string;
} {
  const blocking = PLAN_DELETE_BLOCKING_STATUSES.filter((s) => (countsByStatus[s] ?? 0) > 0);
  const total = blocking.reduce((sum, s) => sum + (countsByStatus[s] ?? 0), 0);
  return {
    blocked: blocking.length > 0,
    total,
    message: `Cannot delete a plan with ${total} live subscription(s) (${blocking.map((s) => `${s}: ${countsByStatus[s]}`).join(', ')}). Disable it instead.`,
  };
}

const AUDIT_SUMMARY_SKIP = new Set(['features']);

/** Human summary of an audit row. Audit rows store the request body as `after` with no `before`, so we can only list the fields that were sent. */
export function summarizeAudit(action: string, after: unknown): string {
  const fields =
    after && typeof after === 'object' && !Array.isArray(after)
      ? (after as Record<string, unknown>)
      : {};
  switch (action) {
    case 'admin.plan_created':
      return `Plan created${typeof fields.name === 'string' ? `: ${fields.name}` : ''}`;
    case 'admin.plan_updated': {
      const parts = Object.entries(fields).map(([key, value]) => {
        if (AUDIT_SUMMARY_SKIP.has(key))
          return Array.isArray(value) ? `features (${value.length})` : key;
        return typeof value === 'object' && value !== null ? key : `${key} -> ${String(value)}`;
      });
      return parts.length ? `Updated ${parts.join(', ')}` : 'Plan updated';
    }
    case 'admin.plan_enabled':
      return 'Plan enabled';
    case 'admin.plan_disabled':
      return 'Plan disabled';
    case 'admin.plan_duplicated':
      return `Duplicated${typeof fields.sourceSlug === 'string' ? ` from ${fields.sourceSlug}` : ''}${typeof fields.slug === 'string' ? ` as ${fields.slug}` : ''}`;
    case 'admin.plan_deleted':
      return 'Plan deleted';
    default:
      return action;
  }
}
