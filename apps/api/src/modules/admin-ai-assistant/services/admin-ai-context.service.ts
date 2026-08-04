import { prisma } from '../../../infrastructure/database/prisma';

interface ContextSection {
  /** The exact admin permission key required for this section to be included — same "never expose unauthorized data" discipline as the tenant assistant's context service. */
  permission: string;
  build: () => Promise<string>;
}

const SECTIONS: ContextSection[] = [
  {
    permission: 'tenants:read',
    build: async () => {
      const grouped = await prisma.tenant.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } });
      const total = grouped.reduce((sum, row) => sum + row._count._all, 0);
      const byStatus = grouped.map((row) => `${row.status.toLowerCase()}: ${row._count._all}`).join(', ');
      return `Tenants: ${total} total (${byStatus || 'none yet'}).`;
    },
  },
  {
    permission: 'payments:read',
    build: async () => {
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      const [thisMonth, allTime, failedRecent] = await Promise.all([
        prisma.payment.aggregate({ where: { status: 'SUCCEEDED', createdAt: { gte: monthStart } }, _sum: { amount: true } }),
        prisma.payment.aggregate({ where: { status: 'SUCCEEDED' }, _sum: { amount: true } }),
        prisma.payment.count({ where: { status: 'FAILED', createdAt: { gte: monthStart } } }),
      ]);
      return `Payments: ${thisMonth._sum.amount?.toString() ?? '0'} collected this month, ${allTime._sum.amount?.toString() ?? '0'} all-time, ${failedRecent} failed payment(s) this month.`;
    },
  },
  {
    permission: 'revenue:read',
    build: async () => {
      const activeByPlan = await prisma.subscription.groupBy({ by: ['planId'], where: { status: 'ACTIVE' }, _count: { _all: true } });
      const planIds = activeByPlan.map((row) => row.planId);
      const plans = await prisma.subscriptionPlan.findMany({ where: { id: { in: planIds } }, select: { id: true, name: true, priceMonthly: true } });
      const planById = new Map(plans.map((p) => [p.id, p]));
      const mrr = activeByPlan.reduce((sum, row) => sum + Number(planById.get(row.planId)?.priceMonthly ?? 0) * row._count._all, 0);
      const breakdown = activeByPlan
        .map((row) => `${planById.get(row.planId)?.name ?? 'unknown'}: ${row._count._all}`)
        .join(', ');
      return `Revenue: approx. ${mrr.toFixed(2)} MRR from ${activeByPlan.reduce((s, r) => s + r._count._all, 0)} active subscriptions (${breakdown || 'none'}).`;
    },
  },
  {
    permission: 'support:manage',
    build: async () => {
      const open = await prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } });
      return `Support: ${open} open/in-progress ticket(s).`;
    },
  },
];

/** Builds the "what does the platform currently look like" block for the super-admin AI assistant — permission-gated per section, same discipline as the tenant assistant's `buildTenantContext`. */
export async function buildPlatformContext(permissions: string[]): Promise<string> {
  // Admin role permissions are expanded to literal keys at seed time (SUPER_ADMIN's '*' becomes every real key), so a plain Set membership check is all that's needed — no separate wildcard case.
  const permissionSet = new Set(permissions);
  const lines = await Promise.all(
    SECTIONS.filter((section) => permissionSet.has(section.permission)).map(async (section) => {
      try {
        return await section.build();
      } catch {
        return null;
      }
    }),
  );

  const body = lines.filter((line): line is string => line != null).join('\n');
  return `Current snapshot of the FitCloud platform (only sections the current admin has permission to view are included):\n${body || '(No context sections available for this admin\'s permissions.)'}`;
}
