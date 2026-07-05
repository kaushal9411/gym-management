import { prisma } from '../../../infrastructure/database/prisma';

const DAY_MS = 86_400_000;

export class AdminDashboardService {
  async getStats() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);

    const [
      totalTenants,
      activeTenants,
      trialTenants,
      expiredTenants,
      todaysRegistrations,
      monthlyRevenue,
      yearlyRevenue,
      pendingPayments,
      failedPayments,
      recentAdminActivity,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      topPlans,
      signupsLast30Days,
    ] = await Promise.all([
      prisma.tenant.count({ where: { deletedAt: null } }),
      prisma.tenant.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      prisma.tenant.count({ where: { deletedAt: null, status: 'TRIAL' } }),
      prisma.tenant.count({ where: { deletedAt: null, status: { in: ['SUSPENDED', 'CANCELLED'] } } }),
      prisma.tenant.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.payment.aggregate({ where: { status: 'SUCCEEDED', createdAt: { gte: startOfMonth } }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { status: 'SUCCEEDED', createdAt: { gte: startOfYear } }, _sum: { amount: true } }),
      prisma.payment.count({ where: { status: 'PENDING' } }),
      prisma.payment.count({ where: { status: 'FAILED' } }),
      prisma.adminAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: { adminUser: { select: { name: true } } } }),
      prisma.supportTicket.count({ where: { status: 'OPEN' } }),
      prisma.supportTicket.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.supportTicket.count({ where: { status: 'RESOLVED' } }),
      prisma.supportTicket.count({ where: { status: 'CLOSED' } }),
      prisma.subscription.groupBy({ by: ['planId'], where: { status: { in: ['ACTIVE', 'TRIALING'] } }, _count: { planId: true }, orderBy: { _count: { planId: 'desc' } }, take: 5 }),
      prisma.tenant.findMany({ where: { createdAt: { gte: thirtyDaysAgo } }, select: { createdAt: true } }),
    ]);

    const planIds = topPlans.map((p) => p.planId);
    const plans = planIds.length ? await prisma.subscriptionPlan.findMany({ where: { id: { in: planIds } } }) : [];
    const planNameById = new Map(plans.map((p) => [p.id, p.name]));

    const growthByDay = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const day = new Date(thirtyDaysAgo.getTime() + i * DAY_MS).toISOString().slice(0, 10);
      growthByDay.set(day, 0);
    }
    for (const tenant of signupsLast30Days) {
      const day = tenant.createdAt.toISOString().slice(0, 10);
      growthByDay.set(day, (growthByDay.get(day) ?? 0) + 1);
    }

    return {
      totals: { totalTenants, activeTenants, trialTenants, expiredTenants, todaysRegistrations },
      revenue: {
        monthly: Number(monthlyRevenue._sum.amount ?? 0),
        yearly: Number(yearlyRevenue._sum.amount ?? 0),
        pendingPayments,
        failedPayments,
      },
      growthChart: Array.from(growthByDay.entries()).map(([date, count]) => ({ date, count })),
      recentActivity: recentAdminActivity.map((a) => ({
        id: a.id,
        action: a.action,
        adminName: a.adminUser?.name ?? 'System',
        entityType: a.entityType,
        entityId: a.entityId,
        createdAt: a.createdAt,
      })),
      supportTickets: { open: openTickets, inProgress: inProgressTickets, resolved: resolvedTickets, closed: closedTickets },
      topPlans: topPlans.map((p) => ({ planId: p.planId, planName: planNameById.get(p.planId) ?? 'Unknown', activeSubscriptions: p._count.planId })),
    };
  }
}

export const adminDashboardService = new AdminDashboardService();
