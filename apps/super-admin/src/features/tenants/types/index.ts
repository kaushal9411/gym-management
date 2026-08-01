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
  branding: { primaryColor: string; logoUrl?: string | null } | null;
  profile: {
    legalBusinessName: string | null;
    registrationNumber: string | null;
    gstVatNumber: string | null;
    businessType: string | null;
    description: string | null;
    email: string | null;
    phone: string | null;
    alternatePhone: string | null;
    website: string | null;
    addressLine: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    postalCode: string | null;
  } | null;
  limits: Record<string, number> | null;
  usage: Array<{ metric: string; value: number }>;
  domains: Array<{ domain: string; isPrimary: boolean }>;
  branches: Array<{
    id: string;
    name: string;
    branchCode: string;
    email: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    capacity: number | null;
    maxMembers: number | null;
    maxStaff: number | null;
    isDefault: boolean;
    isActive: boolean;
    timezone: string;
  }>;
  subscriptions: Array<{
    id: string;
    status: string;
    billingCycle: string;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    graceEndsAt: string | null;
    suspendedAt: string | null;
    cancelledAt: string | null;
    cancelReason: string | null;
    gatewayProvider: string | null;
    plan: { name: string };
    coupon: { code: string } | null;
  }>;
  users: Array<{ id: string; name: string; email: string; status: string }>;
}
