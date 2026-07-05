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
