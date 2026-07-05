import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';
import type { InvoiceListItem, PaginatedResult, PaymentListItem } from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class AdminPaymentService {
  async list(params: { status?: string; page: number; limit: number }): Promise<PaginatedResult<PaymentListItem>> {
    try {
      const res = await apiClient.get<ApiEnvelope<PaginatedResult<PaymentListItem>>>('/admin/payments', { params });
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async listInvoices(params: { page: number; limit: number }): Promise<PaginatedResult<InvoiceListItem>> {
    try {
      const res = await apiClient.get<ApiEnvelope<PaginatedResult<InvoiceListItem>>>('/admin/payments/invoices', { params });
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }
}

export const adminPaymentService = new AdminPaymentService();
