'use client';

import { useMutation, useQuery } from '@tanstack/react-query';

import { onboardingService } from '../services/onboarding.service';
import { OnboardingServiceError } from '../types';
import type { BillingCycle, PaymentProvider, RegisterOnboardingPayload } from '../types';

/** Narrow unknown errors into the typed catalog for consistent UX mapping. */
export function toOnboardingError(error: unknown): OnboardingServiceError {
  if (error instanceof OnboardingServiceError) return error;
  return new OnboardingServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

export function usePlans() {
  return useQuery({
    queryKey: ['onboarding', 'plans'],
    queryFn: () => onboardingService.listPlans(),
    staleTime: 5 * 60_000,
  });
}

export function useRegisterOnboarding() {
  return useMutation({
    mutationFn: (payload: RegisterOnboardingPayload) => onboardingService.register(payload),
  });
}

export function useResendOnboardingOtp() {
  return useMutation({
    mutationFn: (sessionId: string) => onboardingService.resendOtp(sessionId),
  });
}

export function useVerifyOnboardingOtp() {
  return useMutation({
    mutationFn: ({ sessionId, code }: { sessionId: string; code: string }) =>
      onboardingService.verifyOtp(sessionId, code),
  });
}

/** Live subdomain availability — call site is responsible for debouncing input before enabling this. */
export function useCheckSubdomain(slug: string, enabled: boolean) {
  return useQuery({
    queryKey: ['onboarding', 'check-subdomain', slug],
    queryFn: () => onboardingService.checkSubdomain(slug),
    enabled: enabled && slug.length >= 3,
    retry: false,
    staleTime: 0,
  });
}

export function useSelectPlan() {
  return useMutation({
    mutationFn: ({ sessionId, planSlug, billingCycle }: { sessionId: string; planSlug: string; billingCycle: BillingCycle }) =>
      onboardingService.selectPlan(sessionId, planSlug, billingCycle),
  });
}

export function usePayForPlan() {
  return useMutation({
    mutationFn: ({ sessionId, provider, paymentToken }: { sessionId: string; provider: PaymentProvider; paymentToken: string }) =>
      onboardingService.pay(sessionId, provider, paymentToken),
  });
}

export function useCreateTenant() {
  return useMutation({
    mutationFn: ({ sessionId, subdomain }: { sessionId: string; subdomain: string }) =>
      onboardingService.createTenant(sessionId, subdomain),
  });
}
