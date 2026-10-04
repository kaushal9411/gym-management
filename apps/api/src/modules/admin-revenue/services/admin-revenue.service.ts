import { prisma } from '../../../infrastructure/database/prisma';
import { addDaysStr } from '../../finance/utils/payments-analytics.util';
import { aggregateMrr, dayStart, fillDays, money } from '../utils/revenue-insights.util';

import { loadMrrRows } from './revenue-insights.service';

export class AdminRevenueService {
  /**
   * MRR — ACTIVE paid subscriptions only, monthly-normalised (yearly / 12), same definition as the dashboard/tenants/plans.
   * TRIALING is reported separately as `mrrTrialing` (pipeline). Mixed currencies are summed here for the legacy numeric field;
   * use `mrrByCurrency` for the per-currency split.
   */
  async mrr(): Promise<number> {
    const agg = aggregateMrr(await loadMrrRows());
    return agg.byCurrency.reduce((sum, c) => sum + c.mrr, 0);
  }

  async arr(): Promise<number> {
    return (await this.mrr()) * 12;
  }

  /** Daily SUCCEEDED revenue for the last `days` UTC days (today inclusive). `currency` omitted = all currencies summed (points carry `currency: null`). */
  async growth(days = 30, currency?: string) {
    const to = new Date().toISOString().slice(0, 10);
    const from = addDaysStr(to, -(days - 1));
    const start = dayStart(from);
    const endExcl = dayStart(addDaysStr(to, 1));
    const rows = currency
      ? await prisma.$queryRaw<Array<{ d: string; amt: number | string | null }>>`
          SELECT to_char(COALESCE(paid_at, created_at), 'YYYY-MM-DD') AS d, sum(amount)::float8 AS amt FROM payments
          WHERE status::text = 'SUCCEEDED' AND currency = ${currency}
            AND COALESCE(paid_at, created_at) >= ${start} AND COALESCE(paid_at, created_at) < ${endExcl} GROUP BY 1`
      : await prisma.$queryRaw<Array<{ d: string; amt: number | string | null }>>`
          SELECT to_char(COALESCE(paid_at, created_at), 'YYYY-MM-DD') AS d, sum(amount)::float8 AS amt FROM payments
          WHERE status::text = 'SUCCEEDED'
            AND COALESCE(paid_at, created_at) >= ${start} AND COALESCE(paid_at, created_at) < ${endExcl} GROUP BY 1`;
    const byDay = new Map(rows.map((r) => [r.d, Number(r.amt ?? 0)]));
    return fillDays({ from, to }, byDay).map((p) => ({
      date: p.date,
      amount: p.value,
      currency: currency ?? null,
    }));
  }

  async topPlans(limit = 5) {
    const grouped = await prisma.subscription.groupBy({
      by: ['planId'],
      where: { status: { in: ['ACTIVE', 'TRIALING'] } },
      _count: { planId: true },
      orderBy: { _count: { planId: 'desc' } },
      take: limit,
    });
    const plans = await prisma.subscriptionPlan.findMany({
      where: { id: { in: grouped.map((g) => g.planId) } },
    });
    const nameById = new Map(plans.map((p) => [p.id, p.name]));
    return grouped.map((g) => ({
      planId: g.planId,
      planName: nameById.get(g.planId) ?? 'Unknown',
      subscriptions: g._count.planId,
    }));
  }

  async topCountries(limit = 10) {
    const grouped = await prisma.billingAddress.groupBy({
      by: ['country'],
      _count: { country: true },
      orderBy: { _count: { country: 'desc' } },
      take: limit,
    });
    return grouped.map((g) => ({ country: g.country, tenantCount: g._count.country }));
  }

  async revenueByCurrency() {
    const grouped = await prisma.payment.groupBy({
      by: ['currency'],
      where: { status: 'SUCCEEDED' },
      _sum: { amount: true },
    });
    return grouped.map((g) => ({ currency: g.currency, total: Number(g._sum.amount ?? 0) }));
  }

  async revenueByGateway() {
    const grouped = await prisma.payment.groupBy({
      by: ['provider'],
      where: { status: 'SUCCEEDED' },
      _sum: { amount: true },
      _count: { provider: true },
    });
    return grouped.map((g) => ({
      provider: g.provider,
      total: Number(g._sum.amount ?? 0),
      transactionCount: g._count.provider,
    }));
  }

  async summary() {
    const mrrRows = await loadMrrRows();
    const agg = aggregateMrr(mrrRows);
    const [topPlans, topCountries, byCurrency, byGateway] = await Promise.all([
      this.topPlans(),
      this.topCountries(),
      this.revenueByCurrency(),
      this.revenueByGateway(),
    ]);
    const mrr = agg.byCurrency.reduce((sum, c) => sum + c.mrr, 0);
    const trialing = agg.byCurrency.reduce((sum, c) => sum + c.mrrTrialing, 0);
    return {
      mrr,
      arr: mrr * 12,
      mrrTrialing: money(trialing),
      mrrByCurrency: agg.byCurrency.map((c) => ({ currency: c.currency, mrr: money(c.mrr) })),
      topPlans,
      topCountries,
      revenueByCurrency: byCurrency,
      revenueByGateway: byGateway,
    };
  }
}

export const adminRevenueService = new AdminRevenueService();
