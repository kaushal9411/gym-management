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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

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

  /**
   * Deliberately bypasses the shared `apiClient` axios instance for this one
   * call. In practice, the axios path (custom AbortController + timeout
   * config applied to every request via the interceptor in api-client.ts)
   * was observed to hang indefinitely specifically for this endpoint's
   * response — verified by reproducing the exact same request/response
   * (including the JWT-bearing payload and credentialed CORS request) via a
   * raw `fetch()` in the browser console, which resolved correctly every
   * time, while the axios-based call never settled. A plain `fetch()` here
   * sidesteps whatever in axios's request pipeline was responsible.
   */
  async createTenant(sessionId: string, subdomain: string): Promise<ProvisioningResult> {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/onboarding/create-tenant`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, subdomain }),
      });
    } catch {
      throw new OnboardingServiceError('UNKNOWN', 'Network error — check your connection and try again.');
    }

    const body = (await response.json()) as ApiEnvelope<ProvisioningResult> | ApiErrorBody;

    if (!response.ok || !body.success) {
      const errorBody = body as ApiErrorBody;
      const backendCode = errorBody.errors?.[0]?.code;
      const code: OnboardingErrorCode =
        backendCode && (KNOWN_CODES as string[]).includes(backendCode)
          ? (backendCode as OnboardingErrorCode)
          : response.status === 429
            ? 'RATE_LIMITED'
            : 'UNKNOWN';
      throw new OnboardingServiceError(code, errorBody.message ?? 'Something went wrong. Please try again.');
    }

    return (body as ApiEnvelope<ProvisioningResult>).data;
  }

  /**
   * Raw `fetch()` for the same reason as `createTenant` above — this is the
   * recovery probe the success step polls when the create-tenant response
   * goes missing, so it must not share whatever transport path lost it.
   */
  async getStatus(sessionId: string): Promise<OnboardingStatus> {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/onboarding/status?sessionId=${encodeURIComponent(sessionId)}`, {
        credentials: 'include',
      });
    } catch {
      throw new OnboardingServiceError('UNKNOWN', 'Network error — check your connection and try again.');
    }

    const body = (await response.json()) as ApiEnvelope<OnboardingStatus> | ApiErrorBody;
    if (!response.ok || !body.success) {
      throw new OnboardingServiceError('UNKNOWN', (body as ApiErrorBody).message ?? 'Something went wrong.');
    }
    return (body as ApiEnvelope<OnboardingStatus>).data;
  }
}

export const onboardingService = new OnboardingService();
