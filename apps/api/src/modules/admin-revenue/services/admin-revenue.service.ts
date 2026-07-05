import { prisma } from '../../../infrastructure/database/prisma';

const DAY_MS = 86_400_000;

export class AdminRevenueService {
  /** MRR — normalizes every ACTIVE/TRIALING subscription's plan price to a monthly figure. */
  async mrr(): Promise<number> {
    const subscriptions = await prisma.subscription.findMany({
      where: { status: { in: ['ACTIVE', 'TRIALING'] } },
      include: { plan: true },
    });
    return subscriptions.reduce((sum, sub) => {
      const monthly = sub.billingCycle === 'YEARLY' ? Number(sub.plan.priceYearly) / 12 : Number(sub.plan.priceMonthly);
      return sum + monthly;
    }, 0);
  }

  async arr(): Promise<number> {
    return (await this.mrr()) * 12;
  }

  async growth(days = 30) {
    const since = new Date(Date.now() - days * DAY_MS);
    const payments = await prisma.payment.findMany({ where: { status: 'SUCCEEDED', createdAt: { gte: since } }, select: { amount: true, createdAt: true } });

    const byDay = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      byDay.set(new Date(since.getTime() + i * DAY_MS).toISOString().slice(0, 10), 0);
    }
    for (const payment of payments) {
      const day = payment.createdAt.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + Number(payment.amount));
    }
    return Array.from(byDay.entries()).map(([date, amount]) => ({ date, amount }));
  }

  async topPlans(limit = 5) {
    const grouped = await prisma.subscription.groupBy({
      by: ['planId'],
      where: { status: { in: ['ACTIVE', 'TRIALING'] } },
      _count: { planId: true },
      orderBy: { _count: { planId: 'desc' } },
      take: limit,
    });
    const plans = await prisma.subscriptionPlan.findMany({ where: { id: { in: grouped.map((g) => g.planId) } } });
    const nameById = new Map(plans.map((p) => [p.id, p.name]));
    return grouped.map((g) => ({ planId: g.planId, planName: nameById.get(g.planId) ?? 'Unknown', subscriptions: g._count.planId }));
  }

  async topCountries(limit = 10) {
    const grouped = await prisma.billingAddress.groupBy({ by: ['country'], _count: { country: true }, orderBy: { _count: { country: 'desc' } }, take: limit });
    return grouped.map((g) => ({ country: g.country, tenantCount: g._count.country }));
  }

  async revenueByCurrency() {
    const grouped = await prisma.payment.groupBy({ by: ['currency'], where: { status: 'SUCCEEDED' }, _sum: { amount: true } });
    return grouped.map((g) => ({ currency: g.currency, total: Number(g._sum.amount ?? 0) }));
  }

  async revenueByGateway() {
    const grouped = await prisma.payment.groupBy({ by: ['provider'], where: { status: 'SUCCEEDED' }, _sum: { amount: true }, _count: { provider: true } });
    return grouped.map((g) => ({ provider: g.provider, total: Number(g._sum.amount ?? 0), transactionCount: g._count.provider }));
  }

  async summary() {
    const [mrr, topPlans, topCountries, byCurrency, byGateway] = await Promise.all([
      this.mrr(),
      this.topPlans(),
      this.topCountries(),
      this.revenueByCurrency(),
      this.revenueByGateway(),
    ]);
    return { mrr, arr: mrr * 12, topPlans, topCountries, revenueByCurrency: byCurrency, revenueByGateway: byGateway };
  }
}

export const adminRevenueService = new AdminRevenueService();
