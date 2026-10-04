'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthServiceError } from '@/features/auth/types';
import { financeService } from '../services/finance.service';
import type {
  CreateExpensePayload,
  CreateIncomePayload,
  CreatePaymentLinkPayload,
  CreatePaymentPayload,
  GenerateInvoicePayload,
  ListExpensesParams,
  ListIncomeParams,
  ListInvoicesParams,
  AnalyticsParams,
  ListPaymentsParams,
  NotifyMedium,
  RefundPaymentPayload,
  UpdateExpensePayload,
  UpdateIncomePayload,
  UpdatePaymentPayload,
} from '../types';

export function toFinanceError(error: unknown): AuthServiceError {
  if (error instanceof AuthServiceError) return error;
  return new AuthServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

function useInvalidate(prefix: string) {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: [prefix] });
}

// ── Dashboard ────────────────────────────────────────────────────────────

export function useFinanceDashboard(branchId?: string) {
  return useQuery({ queryKey: ['finance', 'dashboard', branchId ?? null], queryFn: () => financeService.getDashboard(branchId) });
}

// ── Payments ─────────────────────────────────────────────────────────────

export function usePaymentList(params: ListPaymentsParams, options?: { enabled?: boolean; keepPrevious?: boolean }) {
  return useQuery({
    queryKey: ['payments', 'list', params],
    queryFn: () => financeService.listPayments(params),
    enabled: options?.enabled,
    placeholderData: options?.keepPrevious ? keepPreviousData : undefined,
  });
}

/** Payments page analytics (KPIs, charts, attention counts) — shares the `['payments', …]` prefix so every payment mutation refreshes it. */
export function usePaymentAnalytics(params: AnalyticsParams) {
  return useQuery({
    queryKey: ['payments', 'analytics', params],
    queryFn: () => financeService.getPaymentAnalytics(params),
    placeholderData: keepPreviousData,
    retry: 1,
  });
}

export function usePayment(id: string | null) {
  return useQuery({ queryKey: ['payments', 'detail', id], queryFn: () => financeService.getPaymentById(id!), enabled: id !== null });
}

export function useCreatePayment() {
  const invalidatePayments = useInvalidate('payments');
  const invalidateInvoices = useInvalidate('invoices');
  const invalidateFinance = useInvalidate('finance');
  return useMutation({
    mutationFn: (payload: CreatePaymentPayload) => financeService.createPayment(payload),
    onSuccess: () => {
      invalidatePayments();
      invalidateInvoices();
      invalidateFinance();
    },
  });
}

export function useCreatePaymentLink() {
  const invalidatePayments = useInvalidate('payments');
  return useMutation({
    mutationFn: (payload: CreatePaymentLinkPayload) => financeService.createPaymentLink(payload),
    onSuccess: invalidatePayments,
  });
}

/** Resends Razorpay's own Payment Link notification (email or SMS) without cancelling/recreating the link. */
export function useResendPaymentLinkNotification() {
  return useMutation({
    mutationFn: ({ id, medium }: { id: string; medium: NotifyMedium }) => financeService.resendPaymentLinkNotification(id, medium),
  });
}

export function useUpdatePayment() {
  const invalidate = useInvalidate('payments');
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePaymentPayload }) => financeService.updatePayment(id, payload),
    onSuccess: invalidate,
  });
}

export function useCancelPayment() {
  const invalidate = useInvalidate('payments');
  return useMutation({ mutationFn: (id: string) => financeService.cancelPayment(id), onSuccess: invalidate });
}

/** For a PENDING online payment, this polls Razorpay's Payment Link and may flip it to SUCCESS/FAILED — invalidate accordingly. */
export function useVerifyPaymentStatus() {
  const invalidatePayments = useInvalidate('payments');
  const invalidateInvoices = useInvalidate('invoices');
  const invalidateFinance = useInvalidate('finance');
  return useMutation({
    mutationFn: (id: string) => financeService.verifyPaymentStatus(id),
    onSuccess: () => {
      invalidatePayments();
      invalidateInvoices();
      invalidateFinance();
    },
  });
}

export function useRefundPayment() {
  const invalidatePayments = useInvalidate('payments');
  const invalidateFinance = useInvalidate('finance');
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RefundPaymentPayload }) => financeService.refundPayment(id, payload),
    onSuccess: () => {
      invalidatePayments();
      invalidateFinance();
    },
  });
}

// ── Invoices ─────────────────────────────────────────────────────────────

export function useInvoiceList(params: ListInvoicesParams, options?: { enabled?: boolean; keepPrevious?: boolean }) {
  return useQuery({
    queryKey: ['invoices', 'list', params],
    queryFn: () => financeService.listInvoices(params),
    enabled: options?.enabled,
    placeholderData: options?.keepPrevious ? keepPreviousData : undefined,
  });
}

/** `GET /invoices/analytics` (finance:invoice-view). Refreshed by the existing `['invoices']` invalidations. */
export function useInvoiceAnalytics(params: AnalyticsParams, enabled = true) {
  return useQuery({ queryKey: ['invoices', 'analytics', params], queryFn: () => financeService.getInvoiceAnalytics(params), enabled, placeholderData: keepPreviousData, retry: false });
}

export function useInvoice(id: string | null) {
  return useQuery({ queryKey: ['invoices', 'detail', id], queryFn: () => financeService.getInvoiceById(id!), enabled: id !== null });
}

export function useGenerateInvoice() {
  const invalidate = useInvalidate('invoices');
  return useMutation({ mutationFn: (payload: GenerateInvoicePayload) => financeService.generateInvoice(payload), onSuccess: invalidate });
}

export function useEmailInvoice() {
  return useMutation({ mutationFn: ({ id, email }: { id: string; email?: string }) => financeService.emailInvoice(id, email) });
}

// ── Income ───────────────────────────────────────────────────────────────

export function useIncomeList(params: ListIncomeParams, options?: { keepPrevious?: boolean }) {
  return useQuery({
    queryKey: ['income', 'list', params],
    queryFn: () => financeService.listIncome(params),
    placeholderData: options?.keepPrevious ? keepPreviousData : undefined,
  });
}

/** Income page analytics — `['income', …]` prefix so create/delete mutations refresh it. `enabled` lets callers skip it without `finance:view`. */
export function useIncomeAnalytics(params: AnalyticsParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['income', 'analytics', params],
    queryFn: () => financeService.getIncomeAnalytics(params),
    enabled: options?.enabled,
    placeholderData: keepPreviousData,
    retry: 1,
  });
}

export function useCreateIncome() {
  const invalidate = useInvalidate('income');
  return useMutation({ mutationFn: (payload: CreateIncomePayload) => financeService.createIncome(payload), onSuccess: invalidate });
}

export function useUpdateIncome() {
  const invalidate = useInvalidate('income');
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateIncomePayload }) => financeService.updateIncome(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteIncome() {
  const invalidate = useInvalidate('income');
  return useMutation({ mutationFn: (id: string) => financeService.deleteIncome(id), onSuccess: invalidate });
}

// ── Expenses ─────────────────────────────────────────────────────────────

export function useExpenseList(params: ListExpensesParams, options?: { keepPrevious?: boolean }) {
  return useQuery({
    queryKey: ['expenses', 'list', params],
    queryFn: () => financeService.listExpenses(params),
    placeholderData: options?.keepPrevious ? keepPreviousData : undefined,
  });
}

export function useExpenseAnalytics(params: AnalyticsParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['expenses', 'analytics', params],
    queryFn: () => financeService.getExpenseAnalytics(params),
    enabled: options?.enabled,
    placeholderData: keepPreviousData,
    retry: 1,
  });
}

export function useExpense(id: string | null) {
  return useQuery({ queryKey: ['expenses', 'detail', id], queryFn: () => financeService.getExpenseById(id!), enabled: id !== null });
}

export function useCreateExpense() {
  const invalidate = useInvalidate('expenses');
  return useMutation({ mutationFn: (payload: CreateExpensePayload) => financeService.createExpense(payload), onSuccess: invalidate });
}

export function useUpdateExpense() {
  const invalidate = useInvalidate('expenses');
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateExpensePayload }) => financeService.updateExpense(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteExpense() {
  const invalidate = useInvalidate('expenses');
  return useMutation({ mutationFn: (id: string) => financeService.deleteExpense(id), onSuccess: invalidate });
}
