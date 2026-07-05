export interface RevenueSummary {
  mrr: number;
  arr: number;
  topPlans: Array<{ planId: string; planName: string; subscriptions: number }>;
  topCountries: Array<{ country: string; tenantCount: number }>;
  revenueByCurrency: Array<{ currency: string; total: number }>;
  revenueByGateway: Array<{ provider: string; total: number; transactionCount: number }>;
}

export interface RevenueGrowthPoint {
  date: string;
  amount: number;
}
