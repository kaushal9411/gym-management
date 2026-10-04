import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { prisma } from '../../../infrastructure/database/prisma';
import {
  aggregateByPlan,
  bucketRenewals,
  computeImpact,
  dominantCurrency,
  EMPTY_AGG,
  DAY_MS,
  money,
  mrrByCurrency,
  planShare,
  summarizeAudit,
  toStats,
  yearlyDiscountPct,
  type Cycle,
  type PlanPricing,
  type SubGroupRow,
} from '../utils/plan-insights.util';

const toPricing = (p: {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  priceMonthly: unknown;
  priceYearly: unknown;
  currency: string;
}): PlanPricing => ({
  id: p.id,
  name: p.name,
  slug: p.slug,
  isActive: p.isActive,
  priceMonthly: Number(p.priceMonthly),
  priceYearly: Number(p.priceYearly),
  currency: p.currency,
});

/** ONE grouped query: subscriptions by (plan, status, cycle). */
async function groupedSubs(planId?: string): Promise<SubGroupRow[]> {
  const rows = await prisma.subscription.groupBy({
    by: ['planId', 'status', 'billingCycle'],
    where: planId ? { planId } : undefined,
    _count: { _all: true },
  });
  return rows.map((r) => ({
    planId: r.planId,
    status: r.status,
    billingCycle: r.billingCycle,
    count: r._count._all,
  }));
}

async function activeRenewals(planId: string | undefined, now: Date, horizonDays: number) {
  return prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      ...(planId ? { planId } : {}),
      currentPeriodEnd: { not: null, lt: new Date(now.getTime() + horizonDays * DAY_MS) },
    },
    select: { planId: true, billingCycle: true, currentPeriodEnd: true },
  });
}

export class PlanInsightsService {
  /** `GET /admin/plans` — existing payload (+ `_count`) with optional filters and per-plan `stats`. */
  async listWithStats(query: { search?: string; status?: 'active' | 'inactive' }) {
    const search = query.search?.trim();
    const plans = await prisma.subscriptionPlan.findMany({
      where: {
        ...(query.status ? { isActive: query.status === 'active' } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { slug: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        features: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { subscriptions: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
    // Share is relative to ALL plans' MRR (not just the filtered ones), so load pricing for every plan.
    const [allPlans, rows] = await Promise.all([
      prisma.subscriptionPlan.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          priceMonthly: true,
          priceYearly: true,
          currency: true,
        },
      }),
      groupedSubs(),
    ]);
    const pricing = allPlans.map(toPricing);
    const aggs = aggregateByPlan(rows, pricing);
    const totals = mrrByCurrency(aggs, pricing);
    const byId = new Map(pricing.map((p) => [p.id, p]));
    return plans.map((plan) => ({
      ...plan,
      stats: toStats(aggs.get(plan.id), byId.get(plan.id)!, totals),
    }));
  }

  async overview(now = new Date()) {
    const plans = (await prisma.subscriptionPlan.findMany({ orderBy: { sortOrder: 'asc' } })).map(
      (p) => ({ ...toPricing(p), sortOrder: p.sortOrder }),
    );
    const [rows, renewals] = await Promise.all([groupedSubs(), activeRenewals(undefined, now, 56)]);
    const aggs = aggregateByPlan(rows, plans);
    const totals = mrrByCurrency(aggs, plans);
    const currency = dominantCurrency(totals);

    let totalSubscribers = 0;
    let activeSubscribers = 0;
    let trialSubscribers = 0;
    let activeInCurrency = 0;
    for (const plan of plans) {
      const a = aggs.get(plan.id) ?? EMPTY_AGG;
      activeSubscribers += a.active;
      trialSubscribers += a.trial;
      totalSubscribers += a.active + a.trial + a.pastDue;
      if (plan.currency === currency) activeInCurrency += a.active;
    }
    const mrr = totals.get(currency) ?? 0;

    return {
      kpis: {
        totalPlans: plans.length,
        activePlans: plans.filter((p) => p.isActive).length,
        totalSubscribers,
        activeSubscribers,
        trialSubscribers,
        mrr: money(mrr),
        arr: money(mrr * 12),
        arpa: activeInCurrency > 0 ? money(mrr / activeInCurrency) : null,
        currency,
      },
      mrrByCurrency: [...totals.entries()]
        .map(([c, value]) => ({ currency: c, mrr: money(value) }))
        .sort((a, b) => Number(b.mrr) - Number(a.mrr)),
      byPlan: plans.map((plan) => {
        const a = aggs.get(plan.id) ?? EMPTY_AGG;
        return {
          planId: plan.id,
          name: plan.name,
          slug: plan.slug,
          isActive: plan.isActive,
          currency: plan.currency,
          activeSubscribers: a.active,
          trialSubscribers: a.trial,
          mrr: money(a.mrr),
          share: planShare(a.mrr, totals.get(plan.currency) ?? 0),
          monthly: a.monthly,
          yearly: a.yearly,
        };
      }),
      priceLadder: plans.map((plan) => ({
        planId: plan.id,
        name: plan.name,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        currency: plan.currency,
        yearlyDiscountPct: yearlyDiscountPct(plan.priceMonthly, plan.priceYearly),
      })),
      upcomingRenewals: bucketRenewals(
        renewals.map((r) => ({
          planId: r.planId,
          billingCycle: r.billingCycle as Cycle,
          currentPeriodEnd: r.currentPeriodEnd!,
        })),
        plans,
        currency,
        now,
      ),
    };
  }

  async planOverview(id: string, now = new Date()) {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id },
      include: { features: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!plan) throw new AppError(ErrorCode.NOT_FOUND, 'Plan not found', 404);
    const pricing = toPricing(plan);
    const allPlans = await prisma.subscriptionPlan.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        priceMonthly: true,
        priceYearly: true,
        currency: true,
      },
    });
    const allPricing = allPlans.map(toPricing);

    const [allRows, renewals, audit, couponInvoices] = await Promise.all([
      groupedSubs(),
      activeRenewals(id, now, 56),
      prisma.adminAuditLog.findMany({
        where: { entityType: 'SubscriptionPlan', entityId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { adminUser: { select: { name: true, email: true } } },
      }),
      prisma.invoice.groupBy({
        by: ['couponId'],
        where: { couponId: { not: null }, status: 'PAID', subscription: { planId: id } },
        _count: { _all: true },
        orderBy: { _count: { couponId: 'desc' } },
        take: 5,
      }),
    ]);
    const aggs = aggregateByPlan(allRows, allPricing);
    const totals = mrrByCurrency(aggs, allPricing);
    const rows = allRows.filter((r) => r.planId === id);

    const statusCounts = new Map<string, number>();
    const cycleCounts = new Map<string, number>();
    for (const r of rows) {
      statusCounts.set(r.status, (statusCounts.get(r.status) ?? 0) + r.count);
      if (r.status === 'ACTIVE')
        cycleCounts.set(r.billingCycle, (cycleCounts.get(r.billingCycle) ?? 0) + r.count);
    }

    const couponIds = couponInvoices.map((c) => c.couponId).filter((c): c is string => c !== null);
    const coupons = couponIds.length
      ? await prisma.coupon.findMany({
          where: { id: { in: couponIds } },
          select: { id: true, code: true },
        })
      : [];
    const codeById = new Map(coupons.map((c) => [c.id, c.code]));

    return {
      plan,
      stats: toStats(aggs.get(id), pricing, totals),
      subscribersByStatus: [...statusCounts.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
      subscribersByCycle: (['MONTHLY', 'YEARLY'] as const).map((cycle) => ({
        cycle,
        count: cycleCounts.get(cycle) ?? 0,
      })),
      upcomingRenewals: bucketRenewals(
        renewals.map((r) => ({
          planId: r.planId,
          billingCycle: r.billingCycle as Cycle,
          currentPeriodEnd: r.currentPeriodEnd!,
        })),
        allPricing,
        pricing.currency,
        now,
      ),
      recentChanges: audit.map((row) => ({
        at: row.createdAt,
        actor: row.adminUser?.name ?? row.adminUser?.email ?? 'System',
        action: row.action,
        summary: summarizeAudit(row.action, row.after),
      })),
      couponsUsed: couponInvoices
        .filter((c) => c.couponId && codeById.has(c.couponId))
        .map((c) => ({ code: codeById.get(c.couponId!)!, redemptions: c._count._all })),
    };
  }

  async impact(
    id: string,
    next: { priceMonthly?: number; priceYearly?: number },
    now = new Date(),
  ) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) throw new AppError(ErrorCode.NOT_FOUND, 'Plan not found', 404);
    const [rows, renewals30] = await Promise.all([
      groupedSubs(id),
      prisma.subscription.count({
        where: {
          planId: id,
          status: 'ACTIVE',
          cancelAtPeriodEnd: false,
          currentPeriodEnd: { not: null, lt: new Date(now.getTime() + 30 * DAY_MS) },
        },
      }),
    ]);
    const agg = aggregateByPlan(rows, [toPricing(plan)]).get(id) ?? EMPTY_AGG;
    return computeImpact(
      toPricing(plan),
      next,
      { monthly: agg.monthly, yearly: agg.yearly },
      renewals30,
    );
  }
}

export const planInsightsService = new PlanInsightsService();
