import { apiClient } from '@/features/auth/services/api-client';
import type {
  CreateExpensePayload,
  CreateIncomePayload,
  CreatePaymentLinkPayload,
  CreatePaymentPayload,
  Expense,
  FinanceDashboard,
  GenerateInvoicePayload,
  Income,
  IncomeAnalytics,
  ExpenseAnalytics,
  LedgerListResponse,
  ListExpensesParams,
  ListIncomeParams,
  ListInvoicesParams,
  ListPaymentsParams,
  PaymentAnalytics,
  PaymentListResponse,
  AnalyticsParams,
  InvoiceAnalytics,
  InvoiceListResponse,
  MemberInvoiceDetail,
  MemberInvoiceListItem,
  MemberPaymentDetail,
  MemberPaymentListItem,
  NotifyMedium,
  Paginated,
  PaymentLinkResult,
  RefundPaymentPayload,
  UpdateExpensePayload,
  UpdateIncomePayload,
  UpdatePaymentPayload,
} from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

class FinanceService {
  // ── Dashboard ──────────────────────────────────────────────────────────

  async getDashboard(branchId?: string): Promise<FinanceDashboard> {
    const res = await apiClient.get<ApiEnvelope<FinanceDashboard>>('/finance/summary', { params: { branchId } });
    return res.data.data;
  }

  // ── Payments ───────────────────────────────────────────────────────────

  async listPayments(params: ListPaymentsParams): Promise<PaymentListResponse> {
    const res = await apiClient.get<ApiEnvelope<PaymentListResponse>>('/payments', { params });
    return res.data.data;
  }

  async getPaymentAnalytics(params: AnalyticsParams): Promise<PaymentAnalytics> {
    const res = await apiClient.get<ApiEnvelope<PaymentAnalytics>>('/payments/analytics', { params });
    return res.data.data;
  }

  async getPaymentById(id: string): Promise<MemberPaymentDetail> {
    const res = await apiClient.get<ApiEnvelope<MemberPaymentDetail>>(`/payments/${id}`);
    return res.data.data;
  }

  async createPayment(payload: CreatePaymentPayload): Promise<MemberPaymentDetail> {
    const res = await apiClient.post<ApiEnvelope<MemberPaymentDetail>>('/payments', payload);
    return res.data.data;
  }

  /** Online payment (Razorpay Payment Links) — creates a PENDING payment + a real Payment Link staff can send to the member. Staff never handle card details. */
  async createPaymentLink(payload: CreatePaymentLinkPayload): Promise<PaymentLinkResult> {
    const res = await apiClient.post<ApiEnvelope<PaymentLinkResult>>('/payments/razorpay/link', payload);
    return res.data.data;
  }

  /** Staff-triggered resend of Razorpay's own Payment Link notification (e.g. "the member says they never got the SMS"). */
  async resendPaymentLinkNotification(id: string, medium: NotifyMedium): Promise<void> {
    await apiClient.post(`/payments/${id}/razorpay/notify`, { medium });
  }

  async updatePayment(id: string, payload: UpdatePaymentPayload): Promise<MemberPaymentDetail> {
    const res = await apiClient.patch<ApiEnvelope<MemberPaymentDetail>>(`/payments/${id}`, payload);
    return res.data.data;
  }

  async cancelPayment(id: string): Promise<void> {
    await apiClient.post(`/payments/${id}/cancel`);
  }

  async verifyPaymentStatus(id: string): Promise<{ status: string; verifiedAt: string }> {
    const res = await apiClient.post<ApiEnvelope<{ status: string; verifiedAt: string }>>(`/payments/${id}/verify`);
    return res.data.data;
  }

  async refundPayment(id: string, payload: RefundPaymentPayload): Promise<MemberPaymentDetail> {
    const res = await apiClient.post<ApiEnvelope<MemberPaymentDetail>>(`/payments/${id}/refund`, payload);
    return res.data.data;
  }

  async exportPaymentsCsvUrl(params: Partial<ListPaymentsParams>): Promise<void> {
    const res = await apiClient.get('/payments/export', { params, responseType: 'blob' });
    downloadBlob(res.data as Blob, `payments-export-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  async exportPaymentsExcel(params: Partial<ListPaymentsParams>): Promise<void> {
    const res = await apiClient.get('/payments/export/excel', { params, responseType: 'blob' });
    downloadBlob(res.data as Blob, `payments-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // ── Invoices ───────────────────────────────────────────────────────────

  async listInvoices(params: ListInvoicesParams): Promise<InvoiceListResponse> {
    const res = await apiClient.get<ApiEnvelope<InvoiceListResponse>>('/invoices', { params });
    return res.data.data;
  }

  async getInvoiceAnalytics(params: AnalyticsParams): Promise<InvoiceAnalytics> {
    const res = await apiClient.get<ApiEnvelope<InvoiceAnalytics>>('/invoices/analytics', { params });
    return res.data.data;
  }

  async getInvoiceById(id: string): Promise<MemberInvoiceDetail> {
    const res = await apiClient.get<ApiEnvelope<MemberInvoiceDetail>>(`/invoices/${id}`);
    return res.data.data;
  }

  async generateInvoice(payload: GenerateInvoicePayload): Promise<MemberInvoiceDetail> {
    const res = await apiClient.post<ApiEnvelope<MemberInvoiceDetail>>('/invoices', payload);
    return res.data.data;
  }

  async downloadInvoicePdfUrl(id: string, invoiceNumber: string): Promise<void> {
    const res = await apiClient.get(`/invoices/${id}/download`, { responseType: 'blob' });
    downloadBlob(res.data as Blob, `${invoiceNumber}.pdf`);
  }

  async openInvoicePdf(id: string): Promise<void> {
    const res = await apiClient.get(`/invoices/${id}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    window.open(url, '_blank');
  }

  async emailInvoice(id: string, email?: string): Promise<void> {
    await apiClient.post(`/invoices/${id}/email`, { email });
  }

  // ── Income ─────────────────────────────────────────────────────────────

  async listIncome(params: ListIncomeParams): Promise<LedgerListResponse<Income>> {
    const res = await apiClient.get<ApiEnvelope<LedgerListResponse<Income>>>('/income', { params });
    return res.data.data;
  }

  async getIncomeAnalytics(params: AnalyticsParams): Promise<IncomeAnalytics> {
    const res = await apiClient.get<ApiEnvelope<IncomeAnalytics>>('/income/analytics', { params });
    return res.data.data;
  }

  async createIncome(payload: CreateIncomePayload): Promise<Income> {
    const res = await apiClient.post<ApiEnvelope<Income>>('/income', payload);
    return res.data.data;
  }

  async updateIncome(id: string, payload: UpdateIncomePayload): Promise<Income> {
    const res = await apiClient.patch<ApiEnvelope<Income>>(`/income/${id}`, payload);
    return res.data.data;
  }

  async deleteIncome(id: string): Promise<void> {
    await apiClient.delete(`/income/${id}`);
  }

  async exportIncomeCsv(params: Partial<ListIncomeParams>): Promise<void> {
    const res = await apiClient.get('/income/export', { params, responseType: 'blob' });
    downloadBlob(res.data as Blob, `income-export-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  async exportIncomeExcel(params: Partial<ListIncomeParams>): Promise<void> {
    const res = await apiClient.get('/income/export/excel', { params, responseType: 'blob' });
    downloadBlob(res.data as Blob, `income-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // ── Expenses ───────────────────────────────────────────────────────────

  async listExpenses(params: ListExpensesParams): Promise<LedgerListResponse<Expense>> {
    const res = await apiClient.get<ApiEnvelope<LedgerListResponse<Expense>>>('/expenses', { params });
    return res.data.data;
  }

  async getExpenseAnalytics(params: AnalyticsParams): Promise<ExpenseAnalytics> {
    const res = await apiClient.get<ApiEnvelope<ExpenseAnalytics>>('/expenses/analytics', { params });
    return res.data.data;
  }

  async getExpenseById(id: string): Promise<Expense> {
    const res = await apiClient.get<ApiEnvelope<Expense>>(`/expenses/${id}`);
    return res.data.data;
  }

  async createExpense(payload: CreateExpensePayload): Promise<Expense> {
    const res = await apiClient.post<ApiEnvelope<Expense>>('/expenses', payload);
    return res.data.data;
  }

  async updateExpense(id: string, payload: UpdateExpensePayload): Promise<Expense> {
    const res = await apiClient.patch<ApiEnvelope<Expense>>(`/expenses/${id}`, payload);
    return res.data.data;
  }

  async deleteExpense(id: string): Promise<void> {
    await apiClient.delete(`/expenses/${id}`);
  }

  async exportExpensesCsv(params: Partial<ListExpensesParams>): Promise<void> {
    const res = await apiClient.get('/expenses/export', { params, responseType: 'blob' });
    downloadBlob(res.data as Blob, `expenses-export-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  async exportExpensesExcel(params: Partial<ListExpensesParams>): Promise<void> {
    const res = await apiClient.get('/expenses/export/excel', { params, responseType: 'blob' });
    downloadBlob(res.data as Blob, `expenses-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }
}

export const financeService = new FinanceService();
