import axios, { type AxiosError } from 'axios';

import { apiClient } from '@/features/auth/services/api-client';
import { OnboardingServiceError, type OnboardingErrorCode } from '../types';
import type {
  BillingCycle,
  OnboardingStatus,
  PaymentProvider,
  ProvisioningResult,
  RegisterOnboardingPayload,
  SubdomainCheckResult,
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

const KNOWN_CODES: OnboardingErrorCode[] = [
  'VALIDATION_ERROR', 'CONFLICT', 'EMAIL_NOT_VERIFIED', 'OTP_INVALID',
  'OTP_EXPIRED', 'SLUG_TAKEN', 'RATE_LIMITED',
];

function toOnboardingServiceError(error: unknown): OnboardingServiceError {
  if (error instanceof OnboardingServiceError) return error;
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorBody>;
    if (!axiosError.response) {
      return new OnboardingServiceError('UNKNOWN', 'Network error — check your connection and try again.');
    }
    const backendCode = axiosError.response.data?.errors?.[0]?.code;
    const code: OnboardingErrorCode =
      backendCode && (KNOWN_CODES as string[]).includes(backendCode)
        ? (backendCode as OnboardingErrorCode)
        : axiosError.response.status === 429
          ? 'RATE_LIMITED'
          : 'UNKNOWN';
    const message = axiosError.response.data?.message ?? 'Something went wrong. Please try again.';
    return new OnboardingServiceError(code, message);
  }
  return new OnboardingServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

/**
 * Talks to the real onboarding backend (Prompt 7) — reuses the same axios
 * instance as authentication (interceptors/tenant header/dedup) but its own
 * error type, since the onboarding error catalog (CONFLICT, SLUG_TAKEN,
 * OTP_*, …) only partially overlaps with the authenticated-session one.
 */
class OnboardingService {
  async listPlans(): Promise<SubscriptionPlan[]> {
    try {
      const res = await apiClient.get<ApiEnvelope<SubscriptionPlan[]>>('/onboarding/plans');
      return res.data.data;
    } catch (error) {
      throw toOnboardingServiceError(error);
    }
  }

  async register(payload: RegisterOnboardingPayload): Promise<{ sessionId: string; maskedEmail: string }> {
    try {
      const res = await apiClient.post<ApiEnvelope<{ sessionId: string; maskedEmail: string }>>(
        '/onboarding/register',
        payload,
      );
      return res.data.data;
    } catch (error) {
      throw toOnboardingServiceError(error);
    }
  }

  async resendOtp(sessionId: string): Promise<void> {
    try {
      await apiClient.post('/onboarding/send-otp', { sessionId });
    } catch (error) {
      throw toOnboardingServiceError(error);
    }
  }

  async verifyOtp(sessionId: string, code: string): Promise<void> {
    try {
      await apiClient.post('/onboarding/verify-otp', { sessionId, code });
    } catch (error) {
      throw toOnboardingServiceError(error);
    }
  }

  async checkSubdomain(slug: string): Promise<SubdomainCheckResult> {
    try {
      const res = await apiClient.get<ApiEnvelope<SubdomainCheckResult>>('/onboarding/check-subdomain', {
        params: { slug },
      });
      return res.data.data;
    } catch (error) {
      throw toOnboardingServiceError(error);
    }
  }

  async selectPlan(sessionId: string, planSlug: string, billingCycle: BillingCycle): Promise<void> {
    try {
      await apiClient.post('/onboarding/select-plan', { sessionId, planSlug, billingCycle });
    } catch (error) {
      throw toOnboardingServiceError(error);
    }
  }

  async pay(sessionId: string, provider: PaymentProvider, paymentToken: string): Promise<{ paymentReference: string }> {
    try {
      const res = await apiClient.post<ApiEnvelope<{ paymentReference: string }>>('/onboarding/payment', {
        sessionId,
        provider,
        paymentToken,
      });
      return res.data.data;
    } catch (error) {
      throw toOnboardingServiceError(error);
    }
  }

  async createTenant(sessionId: string, subdomain: string): Promise<ProvisioningResult> {
    try {
      const res = await apiClient.post<ApiEnvelope<ProvisioningResult>>('/onboarding/create-tenant', {
        sessionId,
        subdomain,
      });
      return res.data.data;
    } catch (error) {
      throw toOnboardingServiceError(error);
    }
  }

  async getStatus(sessionId: string): Promise<OnboardingStatus> {
    try {
      const res = await apiClient.get<ApiEnvelope<OnboardingStatus>>('/onboarding/status', {
        params: { sessionId },
      });
      return res.data.data;
    } catch (error) {
      throw toOnboardingServiceError(error);
    }
  }
}

export const onboardingService = new OnboardingService();
