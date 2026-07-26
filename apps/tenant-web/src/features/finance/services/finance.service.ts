import { apiClient } from '@/features/auth/services/api-client';
import type {
  CreateExpensePayload,
  CreateIncomePayload,
  CreatePaymentPayload,
  Expense,
  FinanceDashboard,
  GenerateInvoicePayload,
  Income,
  ListExpensesParams,
  ListIncomeParams,
  ListInvoicesParams,
  ListPaymentsParams,
  MemberInvoiceDetail,
  MemberInvoiceListItem,
  MemberPaymentDetail,
  MemberPaymentListItem,
  Paginated,
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

  async listPayments(params: ListPaymentsParams): Promise<Paginated<MemberPaymentListItem>> {
    const res = await apiClient.get<ApiEnvelope<Paginated<MemberPaymentListItem>>>('/payments', { params });
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

  async listInvoices(params: ListInvoicesParams): Promise<Paginated<MemberInvoiceListItem>> {
    const res = await apiClient.get<ApiEnvelope<Paginated<MemberInvoiceListItem>>>('/invoices', { params });
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

  async listIncome(params: ListIncomeParams): Promise<Paginated<Income>> {
    const res = await apiClient.get<ApiEnvelope<Paginated<Income>>>('/income', { params });
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

  async listExpenses(params: ListExpensesParams): Promise<Paginated<Expense>> {
    const res = await apiClient.get<ApiEnvelope<Paginated<Expense>>>('/expenses', { params });
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
