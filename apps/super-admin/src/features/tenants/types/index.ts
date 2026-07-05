export type TenantStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED';

export interface TenantListItem {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  trialEndsAt: string | null;
  createdAt: string;
  owner: { name: string; email: string } | null;
  plan: string | null;
  subscriptionStatus: string | null;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TenantDetail {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  trialEndsAt: string | null;
  subscriptionExpiresAt: string | null;
  suspendedAt: string | null;
  maintenanceMode: boolean;
  createdAt: string;
  settings: { timezone: string; currency: string } | null;
  branding: { primaryColor: string; logoUrl?: string } | null;
  limits: Record<string, number> | null;
  usage: Array<{ metric: string; value: number }>;
  domains: Array<{ domain: string; isPrimary: boolean }>;
  subscriptions: Array<{ id: string; status: string; billingCycle: string; currentPeriodEnd: string | null; plan: { name: string } }>;
  users: Array<{ id: string; name: string; email: string; status: string }>;
}
