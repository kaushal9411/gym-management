import type { DashboardOverview, DashboardStats } from '../types';

/** Graceful degradation: build a partial overview from the legacy /admin/dashboard/stats payload. Only fields the legacy DTO really provides are filled; everything else is null/empty so panels hide. */
export function overviewFromStats(s: DashboardStats): DashboardOverview {
  const now = new Date().toISOString();
  const total = s.totals.totalTenants;
  return {
    range: { from: s.growthChart[0]?.date ?? now.slice(0, 10), to: now.slice(0, 10) },
    previousRange: { from: now.slice(0, 10), to: now.slice(0, 10) },
    generatedAt: now,
    kpis: {
      tenantsTotal: { value: total },
      newTenants: { value: s.totals.todaysRegistrations },
      activeTenants: { value: s.totals.activeTenants },
      trialTenants: { value: s.totals.trialTenants },
      suspendedTenants: null,
      expiredTenants: { value: s.totals.expiredTenants },
      mrr: null,
      arr: null,
      revenueCollected: null,
      failedPayments: { value: s.revenue.failedPayments },
      churned: null,
      trialConversion: null,
    },
    signupsDaily: s.growthChart.map((g) => ({ date: g.date, count: g.count, previousCount: null })),
    revenueDaily: [],
    planMix: s.topPlans.map((p) => ({ ...p, mrr: null })),
    countries: [],
    supportTickets: { ...s.supportTickets, oldestOpenDays: null },
    trialsExpiring: [],
    atRisk: [],
    topTenants: [],
    activity: s.recentActivity.map((a) => ({
      id: a.id,
      at: a.createdAt,
      actorName: a.adminName,
      actorRole: null,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      summary: a.action.replace('admin.', '').replace(/_/g, ' '),
    })),
    health: null,
  };
}
