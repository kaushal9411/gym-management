export interface DashboardStats {
  totals: {
    totalTenants: number;
    activeTenants: number;
    trialTenants: number;
    expiredTenants: number;
    todaysRegistrations: number;
  };
  revenue: {
    monthly: number;
    yearly: number;
    pendingPayments: number;
    failedPayments: number;
  };
  growthChart: Array<{ date: string; count: number }>;
  recentActivity: Array<{
    id: string;
    action: string;
    adminName: string;
    entityType: string | null;
    entityId: string | null;
    createdAt: string;
  }>;
  supportTickets: { open: number; inProgress: number; resolved: number; closed: number };
  topPlans: Array<{ planId: string; planName: string; activeSubscriptions: number }>;
}

export type OverviewRange = '7d' | '30d' | '90d' | '12m';

export interface KpiValue {
  value: number;
  previous?: number | null;
}
/** Money KPIs arrive as decimal strings. */
export interface MoneyKpi {
  value: string;
  previous?: string | null;
}

export interface DashboardOverview {
  range: { from: string; to: string };
  previousRange: { from: string; to: string };
  generatedAt: string;
  kpis: {
    tenantsTotal: KpiValue | null;
    newTenants: KpiValue | null;
    activeTenants: KpiValue | null;
    trialTenants: KpiValue | null;
    suspendedTenants: KpiValue | null;
    expiredTenants: KpiValue | null;
    mrr: MoneyKpi | null;
    arr: MoneyKpi | null;
    revenueCollected: MoneyKpi | null;
    failedPayments: KpiValue | null;
    churned: KpiValue | null;
    trialConversion: KpiValue | null;
    /** Additive: average revenue per active account. */
    arpa?: MoneyKpi | null;
  };
  signupsDaily: Array<{ date: string; count: number; previousCount: number | null }>;
  revenueDaily: Array<{ date: string; amount: string; previousAmount: string }>;
  /** Additive fields (older API builds omit them). */
  churnedDaily?: Array<{ date: string; count: number; previousCount?: number | null }> | null;
  trialFunnel?: { started: number; activated: number; converted: number; expired: number } | null;
  failedPaymentsList?: Array<{ tenantId: string; slug: string; name: string; plan?: string | null; amount?: string | number | null; reason?: string | null; attempt?: number | null; at?: string | null }> | null;
  mrrDaily?: Array<{ date: string; mrr: string | number }> | null;
  mrrDailyPrevious?: Array<{ date: string; mrr: string | number }> | null;
  planMix: Array<{ planId: string; planName: string; activeSubscriptions: number; mrr: string | null }>;
  countries: Array<{ country: string; tenantCount: number }>;
  supportTickets: { open: number; inProgress: number; resolved: number; closed: number; oldestOpenDays: number | null } | null;
  trialsExpiring: Array<{ tenantId: string; slug: string; name: string; ownerEmail: string | null; trialEndsAt: string; daysLeft: number; members?: number | null; plan?: string | null }>;
  atRisk: Array<{ tenantId: string; slug: string; name: string; reason: AtRiskReason; detail: string }>;
  topTenants: Array<{ tenantId: string; slug: string; name: string; plan: string | null; members: number | null; branches?: number | null; mrr?: string | number | null }>;
  activity: Array<{
    id: string;
    at: string;
    actorName: string | null;
    actorRole: string | null;
    action: string;
    entityType: string | null;
    entityId: string | null;
    summary: string;
  }>;
  health: {
    database: { status: string; latencyMs: number | null };
    redis: { status: string; latencyMs: number | null };
    queue: { health: string; runningJobs: number; failedJobs: number; queueSize: number } | null;
    uptimeSeconds: number | null;
  } | null;
}

export type AtRiskReason = 'PAYMENT_FAILED' | 'PAST_DUE' | 'GRACE' | 'NEAR_LIMIT' | 'SUSPENDED_RECENTLY';
