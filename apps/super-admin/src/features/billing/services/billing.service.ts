import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';
import type { ChangePlanMode, ChangePlanResult, PaymentLinkResult, VerifyPaymentResult } from '../types';

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

class AdminTenantBillingService {
  async createPaymentLink(tenantId: string, invoiceId?: string): Promise<PaymentLinkResult> {
    try {
      const res = await apiClient.post<ApiEnvelope<PaymentLinkResult>>(`/admin/tenants/${tenantId}/payment-link`, { invoiceId });
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async verifyPaymentStatus(tenantId: string, paymentId: string): Promise<VerifyPaymentResult> {
    try {
      const res = await apiClient.post<ApiEnvelope<VerifyPaymentResult>>(`/admin/tenants/${tenantId}/payments/${paymentId}/verify`);
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async changePlan(tenantId: string, planId: string, mode: ChangePlanMode): Promise<ChangePlanResult> {
    try {
      const res = await apiClient.post<ApiEnvelope<ChangePlanResult>>(`/admin/tenants/${tenantId}/subscription/change-plan`, { planId, mode });
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async resendNotification(tenantId: string, paymentId: string, medium: 'email' | 'sms'): Promise<void> {
    try {
      await apiClient.post(`/admin/tenants/${tenantId}/payments/${paymentId}/resend-notification`, { medium });
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async emailInvoice(tenantId: string, invoiceId: string, email?: string): Promise<void> {
    try {
      await apiClient.post(`/admin/tenants/${tenantId}/invoices/${invoiceId}/email`, { email });
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async downloadInvoicePdf(tenantId: string, invoiceId: string, invoiceNumber: string): Promise<void> {
    try {
      const res = await apiClient.get(`/admin/tenants/${tenantId}/invoices/${invoiceId}/download`, { responseType: 'blob' });
      downloadBlob(res.data as Blob, `${invoiceNumber}.pdf`);
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }
}

export const adminTenantBillingService = new AdminTenantBillingService();
