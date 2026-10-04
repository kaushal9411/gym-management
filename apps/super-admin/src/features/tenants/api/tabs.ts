'use client';

/**
 * Tenant-detail tabs data layer (Subscription, Billing, Users, Activity, Support).
 * Types + service calls + TanStack hooks live here; mutations (change plan, payment link, verify, resend,
 * invoice email/PDF, extend trial) are reused from features/billing and features/tenants.
 * All keys sit under ['admin','tenants',tenantId,'tabs',…] so the billing mutations' invalidation refreshes them.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';
import type { PaginatedResult } from '../types';

interface Envelope<T> {
  data: T;
}

async function get<T>(tenantId: string, path: string, params?: Record<string, unknown>): Promise<T> {
  try {
    const clean = params ? Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')) : undefined;
    const res = await apiClient.get<Envelope<T>>(`/admin/tenants/${tenantId}/${path}`, { params: clean });
    return res.data.data;
  } catch (error) {
    throw toAdminServiceError(error);
  }
}

const key = (tenantId: string, ...rest: unknown[]) => ['admin', 'tenants', tenantId, 'tabs', ...rest] as const;

/* ------------------------------ Subscription ------------------------------ */

export interface TabSubscription {
  id: string;
  status: string;
  billingCycle: 'MONTHLY' | 'YEARLY' | string;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  graceEndsAt: string | null;
  suspendedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  gatewayProvider: string | null;
  plan: {
    id: string;
    name: string;
    slug: string;
    priceMonthly: string;
    priceYearly: string;
    currency: string;
    maxBranches: number;
    maxManagers: number;
    maxTrainers: number;
    maxReceptionists: number;
    maxStaff: number;
    maxMembers: number;
    maxStorageMb: number;
  };
  coupon: { code: string } | null;
}

export interface SubscriptionHistory {
  subscriptions: Array<{
    id: string;
    plan: string;
    planSlug: string;
    status: string;
    billingCycle: string;
    trialEndsAt: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    createdAt: string;
  }>;
  history: Array<{
    id: string;
    action: string;
    fromPlan: string | null;
    toPlan: string | null;
    fromStatus: string | null;
    toStatus: string | null;
    note: string | null;
    at: string;
  }>;
}

export function useTenantSubscription(tenantId: string) {
  return useQuery({ queryKey: key(tenantId, 'subscription'), queryFn: () => get<TabSubscription | null>(tenantId, 'subscription'), enabled: !!tenantId });
}
export function useTenantSubscriptionHistory(tenantId: string) {
  return useQuery({ queryKey: key(tenantId, 'sub-history'), queryFn: () => get<SubscriptionHistory>(tenantId, 'subscription/history'), enabled: !!tenantId });
}

/* --------------------------------- Billing -------------------------------- */

export interface TabPayment {
  id: string;
  invoiceId: string | null;
  provider: string;
  status: string;
  amount: string;
  currency: string;
  gatewayReference: string | null;
  failureReason: string | null;
  paymentMode: string | null;
  paidAt: string | null;
  createdAt: string;
}
export interface TabInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  total: string;
  currency: string;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
}

/** Billing is loaded as one page of up to 100 newest rows (endpoint max); KPIs/charts/CSV/paging all work client-side over it. */
export const BILLING_FETCH_LIMIT = 100;
export function useTenantBillingPayments(tenantId: string) {
  return useQuery({
    queryKey: key(tenantId, 'payments'),
    queryFn: () => get<PaginatedResult<TabPayment>>(tenantId, 'payments', { page: 1, limit: BILLING_FETCH_LIMIT }),
    enabled: !!tenantId,
  });
}
export function useTenantBillingInvoices(tenantId: string) {
  return useQuery({
    queryKey: key(tenantId, 'invoices'),
    queryFn: () => get<PaginatedResult<TabInvoice>>(tenantId, 'invoices', { page: 1, limit: BILLING_FETCH_LIMIT }),
    enabled: !!tenantId,
  });
}

/* ---------------------------------- Users --------------------------------- */

export interface TabUser {
  id: string;
  name: string;
  email: string;
  role: string;
  roles: string[];
  status: string;
  lastLoginAt: string | null;
  mfaEnabled: boolean;
  createdAt: string;
}
export interface TabUsers extends PaginatedResult<TabUser> {
  counts: { total: number; active: number; mfaEnabled: number };
}
export function useTenantUsers(tenantId: string) {
  return useQuery({
    queryKey: key(tenantId, 'users'),
    queryFn: () => get<TabUsers>(tenantId, 'users', { page: 1, limit: 100 }),
    enabled: !!tenantId,
  });
}

/* --------------------------------- Activity -------------------------------- */

export interface TabActivityItem {
  id: string;
  at: string;
  actor: { id: string; name: string; email: string } | null;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  ipAddress: string | null;
}
export interface ActivityFilters {
  action?: string;
  actor?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}
export function useTenantActivity(tenantId: string, filters: ActivityFilters) {
  return useQuery({
    queryKey: key(tenantId, 'activity', filters),
    queryFn: () => get<PaginatedResult<TabActivityItem>>(tenantId, 'activity', { ...filters }),
    enabled: !!tenantId,
    placeholderData: keepPreviousData,
  });
}

/* --------------------------------- Support --------------------------------- */

export type TabTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export interface TabTicket {
  id: string;
  subject: string;
  status: TabTicketStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | string;
  createdByEmail: string;
  createdByName: string | null;
  assignedAdmin: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}
export interface TabTickets extends PaginatedResult<TabTicket> {
  counts: { all: number; open: number; inProgress: number; resolved: number; closed: number };
}
export function useTenantTickets(tenantId: string, params: { status?: TabTicketStatus; page: number; limit: number }) {
  return useQuery({
    queryKey: key(tenantId, 'tickets', params),
    queryFn: () => get<TabTickets>(tenantId, 'support/tickets', { ...params }),
    enabled: !!tenantId,
    placeholderData: keepPreviousData,
  });
}

/** Ticket counts for the page's Support tab badge (shares the unfiltered first-page cache entry with SupportTab). */
export function useTenantTicketCounts(tenantId: string) {
  const q = useTenantTickets(tenantId, { page: 1, limit: 20 });
  return { counts: q.data?.counts ?? null, openCount: q.data ? q.data.counts.open + q.data.counts.inProgress : null, isLoading: q.isLoading };
}
