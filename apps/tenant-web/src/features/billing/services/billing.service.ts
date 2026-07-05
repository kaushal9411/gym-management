import axios, { type AxiosError } from 'axios';

import { apiClient } from '@/features/auth/services/api-client';
import { BillingServiceError, type BillingErrorCode } from '../types';
import type {
  BillingAddress,
  CheckoutPayload,
  CheckoutResult,
  CouponValidationResult,
  Invoice,
  PaymentRecord,
  Subscription,
  SubscriptionHistoryEntry,
  SubscriptionPlan,
} from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

interface ApiErrorBody {
  success: false;
  message: string;
  errors: Array<{ field?: string; code?: string; message: string }> | null;
}

const KNOWN_CODES: BillingErrorCode[] = ['VALIDATION_ERROR', 'CONFLICT', 'COUPON_INVALID', 'PAYMENT_FAILED', 'NOT_FOUND', 'FORBIDDEN'];

function toBillingServiceError(error: unknown): BillingServiceError {
  if (error instanceof BillingServiceError) return error;
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorBody>;
    if (!axiosError.response) return new BillingServiceError('UNKNOWN', 'Network error — check your connection and try again.');
    const backendCode = axiosError.response.data?.errors?.[0]?.code;
    const code: BillingErrorCode = backendCode && (KNOWN_CODES as string[]).includes(backendCode) ? (backendCode as BillingErrorCode) : 'UNKNOWN';
    const message = axiosError.response.data?.message ?? 'Something went wrong. Please try again.';
    return new BillingServiceError(code, message);
  }
  return new BillingServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

class BillingService {
  async listPlans(): Promise<SubscriptionPlan[]> {
    try {
      const res = await apiClient.get<ApiEnvelope<SubscriptionPlan[]>>('/onboarding/plans');
      return res.data.data;
    } catch (error) {
      throw toBillingServiceError(error);
    }
  }

  async getCurrentSubscription(): Promise<Subscription> {
    try {
      const res = await apiClient.get<ApiEnvelope<Subscription>>('/subscription');
      return res.data.data;
    } catch (error) {
      throw toBillingServiceError(error);
    }
  }

  async getHistory(): Promise<SubscriptionHistoryEntry[]> {
    try {
      const res = await apiClient.get<ApiEnvelope<SubscriptionHistoryEntry[]>>('/subscription/history');
      return res.data.data;
    } catch (error) {
      throw toBillingServiceError(error);
    }
  }

  async checkout(kind: 'create' | 'upgrade' | 'downgrade', payload: CheckoutPayload): Promise<CheckoutResult> {
    try {
      const path = kind === 'create' ? '/subscription' : `/subscription/${kind}`;
      const res = await apiClient.post<ApiEnvelope<CheckoutResult>>(path, payload, {
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      });
      return res.data.data;
    } catch (error) {
      throw toBillingServiceError(error);
    }
  }

  async cancel(immediate: boolean, reason?: string): Promise<Subscription> {
    try {
      const res = await apiClient.post<ApiEnvelope<Subscription>>('/subscription/cancel', { immediate, reason });
      return res.data.data;
    } catch (error) {
      throw toBillingServiceError(error);
    }
  }

  async validateCoupon(code: string, amount: number): Promise<CouponValidationResult> {
    try {
      const res = await apiClient.post<ApiEnvelope<CouponValidationResult>>('/coupon/validate', { code, amount });
      return res.data.data;
    } catch (error) {
      throw toBillingServiceError(error);
    }
  }

  async getBillingAddress(): Promise<BillingAddress | null> {
    try {
      const res = await apiClient.get<ApiEnvelope<BillingAddress | null>>('/billing/address');
      return res.data.data;
    } catch (error) {
      throw toBillingServiceError(error);
    }
  }

  async saveBillingAddress(address: BillingAddress): Promise<BillingAddress> {
    try {
      const res = await apiClient.put<ApiEnvelope<BillingAddress>>('/billing/address', address);
      return res.data.data;
    } catch (error) {
      throw toBillingServiceError(error);
    }
  }

  async getPaymentHistory(): Promise<PaymentRecord[]> {
    try {
      const res = await apiClient.get<ApiEnvelope<PaymentRecord[]>>('/payment/history');
      return res.data.data;
    } catch (error) {
      throw toBillingServiceError(error);
    }
  }

  async listInvoices(): Promise<Invoice[]> {
    try {
      const res = await apiClient.get<ApiEnvelope<Invoice[]>>('/invoice');
      return res.data.data;
    } catch (error) {
      throw toBillingServiceError(error);
    }
  }

  /** Returns a blob URL — the caller is responsible for revoking it once the download starts. */
  async downloadInvoiceUrl(invoiceId: string): Promise<string> {
    try {
      const res = await apiClient.get(`/invoice/${invoiceId}/download`, { responseType: 'blob' });
      return URL.createObjectURL(res.data as Blob);
    } catch (error) {
      throw toBillingServiceError(error);
    }
  }
}

export const billingService = new BillingService();
