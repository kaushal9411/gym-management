'use client';

/**
 * Types, service functions and TanStack hooks for the redesigned super-admin Payments pages
 * (GET /admin/payments, /overview, /export, /invoices, /invoices/:id, /:id). Shapes follow docs/BACKEND-GUIDE.md.
 * Row-level actions (verify / resend / invoice email / PDF) reuse `adminTenantBillingService` — they are tenant-scoped
 * on the API, so the tenant id comes from the row. Refunds / retry / mark-paid do not exist on the API and are not faked.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';
import { adminTenantBillingService } from '@/features/billing/services/billing.service';

export type PaymentsRange = '30d' | '90d' | '12m';
export type PaymentStatusKey = 'SUCCEEDED' | 'PENDING' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
export type PaymentSort = 'createdAt' | 'amount' | 'paidAt';
export type InvoiceSort = 'createdAt' | 'total' | 'dueDate';

export interface TenantRef { id: string; name: string; slug: string }
interface Page<T> { items: T[]; page: number; limit: number; total: number; totalPages: number }

// ── Payments list ──
export interface PaymentFilters {
  status?: string; provider?: string; tenant?: string; from?: string; to?: string; minAmount?: string; maxAmount?: string;
  currency?: string; mode?: string; sort?: PaymentSort; sortDir?: 'asc' | 'desc'; page?: number; limit?: number;
}
export interface PaymentRow {
  id: string; provider: string; status: PaymentStatusKey; amount: string; currency: string;
  gatewayReference: string | null; failureReason: string | null; paymentMode: string | null;
  paidAt: string | null; createdAt: string; invoiceId: string | null;
  tenant: TenantRef; planName: string | null; invoiceNumber: string | null;
}
export interface PaymentCounts { all: number; succeeded: number; pending: number; failed: number; refunded: number; partiallyRefunded: number }
export interface PaymentSummary { count: number; succeededAmount: string; failedAmount: string; pendingAmount: string; currency: string | null; mixedCurrency: boolean }
export interface PaymentList extends Page<PaymentRow> { counts: PaymentCounts; summary: PaymentSummary }

// ── Invoices list ──
export interface InvoiceFilters {
  status?: string; tenant?: string; from?: string; to?: string; overdue?: boolean; minAmount?: string; maxAmount?: string;
  currency?: string; sort?: InvoiceSort; sortDir?: 'asc' | 'desc'; page?: number; limit?: number;
}
export interface InvoiceRow {
  id: string; invoiceNumber: string; status: string; total: string; currency: string; createdAt: string;
  dueDate: string | null; paidAt: string | null; tenant: TenantRef; couponCode: string | null;
}
export interface InvoiceCounts { all: number; draft: number; open: number; paid: number; void: number; uncollectible: number; overdue: number }
export interface InvoiceSummary { count: number; total: string; outstanding: string; currency: string | null; mixedCurrency: boolean }
export interface InvoiceList extends Page<InvoiceRow> { counts: InvoiceCounts; summary: InvoiceSummary }

// ── Overview ──
export interface Delta { value: number; previous: number }
export interface PaymentsOverview {
  range: { from: string; to: string } | string;
  currency?: string;
  currencies?: string[];
  currencyNote?: string;
  kpis: {
    collected: Delta; succeededCount: Delta; failedCount: Delta; successRate: Delta;
    pending: { count: number; amount: number };
    avgTicket: { value: number } | null;
  };
  daily: Array<{ date: string; succeeded: number; failed: number; previousSucceeded: number; succeededAmount: number }>;
  byProvider: Array<{ provider: string; count: number; amount: number; successRate: number }>;
  byMode: Array<{ mode: string; count: number; amount: number }>;
  statusMix: Array<{ status: string; count: number; amount: number }>;
  failureReasons: Array<{ reason: string; count: number; amount: number }>;
  pendingStuck: Array<{ paymentId: string; tenant: TenantRef | { name: string }; amount: number | string; currency: string; createdAt: string; ageHours: number }>;
  recentFailures: Array<{ paymentId: string; tenant: TenantRef | { name: string }; amount: number | string; currency: string; reason: string | null; at: string }>;
}

// ── Details ──
export interface TimelineEvent { at: string; event: string; detail: string }
export interface WebhookTx { id: string; provider: string; eventType: string; signatureValid: boolean; processedAt: string | null; createdAt: string; rawPayload: unknown }
export interface PaymentDetail {
  id: string; tenantId: string; provider: string; status: PaymentStatusKey; amount: string; currency: string;
  gatewayReference: string | null; failureReason: string | null; paymentMode: string | null; paidAt: string | null;
  createdAt: string; updatedAt: string; invoiceId: string | null; metadata: unknown;
  tenant: TenantRef; invoice: { id: string; invoiceNumber: string; status?: string } | null; planName: string | null;
  timeline: TimelineEvent[]; transactions: WebhookTx[];
}
export interface InvoiceItemRow { id: string; description: string; quantity: number; unitPrice: string; amount: string }
export interface InvoiceDetail {
  invoice: {
    id: string; tenantId: string; invoiceNumber: string; status: string; subtotal: string; taxAmount: string; discountAmount: string;
    total: string; currency: string; dueDate: string | null; paidAt: string | null; createdAt: string; couponId: string | null;
    items: InvoiceItemRow[]; tenant: TenantRef; coupon: { code: string } | null;
  };
  payments: Array<{ id: string; provider: string; status: PaymentStatusKey; amount: string; currency: string; paidAt: string | null; gatewayReference: string | null }>;
  subscription: { id: string; plan: string; status: string } | null;
}

interface Env<T> { data: T }
const strip = <T extends object>(o: T): Record<string, unknown> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && v !== false));

export const paymentsApi = {
  async list(p: PaymentFilters): Promise<PaymentList> {
    try { return (await apiClient.get<Env<PaymentList>>('/admin/payments', { params: strip(p) })).data.data; } catch (e) { throw toAdminServiceError(e); }
  },
  async invoices(p: InvoiceFilters): Promise<InvoiceList> {
    try { return (await apiClient.get<Env<InvoiceList>>('/admin/payments/invoices', { params: strip(p) })).data.data; } catch (e) { throw toAdminServiceError(e); }
  },
  async overview(range: PaymentsRange): Promise<PaymentsOverview> {
    try { return (await apiClient.get<Env<PaymentsOverview>>('/admin/payments/overview', { params: { range } })).data.data; } catch (e) { throw toAdminServiceError(e); }
  },
  async exportCsv(p: PaymentFilters): Promise<Blob> {
    try {
      const { page: _p, limit: _l, ...rest } = p;
      return (await apiClient.get<Blob>('/admin/payments/export', { params: strip(rest), responseType: 'blob' })).data;
    } catch (e) { throw toAdminServiceError(e); }
  },
  async payment(id: string): Promise<PaymentDetail> {
    try { return (await apiClient.get<Env<PaymentDetail>>(`/admin/payments/${id}`)).data.data; } catch (e) { throw toAdminServiceError(e); }
  },
  async invoice(id: string): Promise<InvoiceDetail> {
    try { return (await apiClient.get<Env<InvoiceDetail>>(`/admin/payments/invoices/${id}`)).data.data; } catch (e) { throw toAdminServiceError(e); }
  },
};

export const paymentKeys = {
  root: ['admin', 'payments-v2'] as const,
  list: (p: PaymentFilters) => ['admin', 'payments-v2', 'list', p] as const,
  invoices: (p: InvoiceFilters) => ['admin', 'payments-v2', 'invoices', p] as const,
  overview: (r: PaymentsRange) => ['admin', 'payments-v2', 'overview', r] as const,
  payment: (id: string) => ['admin', 'payments-v2', 'payment', id] as const,
  invoice: (id: string) => ['admin', 'payments-v2', 'invoice', id] as const,
};

export const usePaymentList = (p: PaymentFilters) => useQuery({ queryKey: paymentKeys.list(p), queryFn: () => paymentsApi.list(p), placeholderData: keepPreviousData, retry: false });
export const useInvoiceList = (p: InvoiceFilters, enabled = true) => useQuery({ queryKey: paymentKeys.invoices(p), queryFn: () => paymentsApi.invoices(p), placeholderData: keepPreviousData, retry: false, enabled });
export const usePaymentsOverview = (r: PaymentsRange) => useQuery({ queryKey: paymentKeys.overview(r), queryFn: () => paymentsApi.overview(r), placeholderData: keepPreviousData, retry: false });
export const usePaymentDetail = (id: string) => useQuery({ queryKey: paymentKeys.payment(id), queryFn: () => paymentsApi.payment(id), retry: false });
export const useInvoiceDetail = (id: string) => useQuery({ queryKey: paymentKeys.invoice(id), queryFn: () => paymentsApi.invoice(id), retry: false });

/** Verify a PENDING payment's gateway status (tenant-scoped endpoint, tenant id supplied per call). Click-driven only. */
export function useVerifyAnyPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tenantId, paymentId }: { tenantId: string; paymentId: string }) => adminTenantBillingService.verifyPaymentStatus(tenantId, paymentId),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: paymentKeys.root }); void qc.invalidateQueries({ queryKey: ['admin', 'tenants'] }); },
  });
}
export function useResendAny() {
  return useMutation({
    mutationFn: ({ tenantId, paymentId }: { tenantId: string; paymentId: string }) => adminTenantBillingService.resendNotification(tenantId, paymentId, 'email'),
  });
}
export function useEmailInvoiceAny() {
  return useMutation({
    mutationFn: ({ tenantId, invoiceId }: { tenantId: string; invoiceId: string }) => adminTenantBillingService.emailInvoice(tenantId, invoiceId),
  });
}
export function useInvoicePdfAny() {
  return useMutation({
    mutationFn: ({ tenantId, invoiceId, invoiceNumber }: { tenantId: string; invoiceId: string; invoiceNumber: string }) => adminTenantBillingService.downloadInvoicePdf(tenantId, invoiceId, invoiceNumber),
  });
}
