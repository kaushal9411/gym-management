'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { billingService } from '../services/billing.service';
import { BillingServiceError } from '../types';
import type { BillingAddress, CheckoutPayload } from '../types';

export function toBillingError(error: unknown): BillingServiceError {
  if (error instanceof BillingServiceError) return error;
  return new BillingServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

export function usePlans() {
  return useQuery({ queryKey: ['billing', 'plans'], queryFn: () => billingService.listPlans(), staleTime: 5 * 60_000 });
}

export function useCurrentSubscription() {
  return useQuery({ queryKey: ['billing', 'subscription'], queryFn: () => billingService.getCurrentSubscription(), retry: false });
}

export function useSubscriptionHistory() {
  return useQuery({ queryKey: ['billing', 'subscription', 'history'], queryFn: () => billingService.getHistory() });
}

export function useCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, payload }: { kind: 'create' | 'upgrade' | 'downgrade'; payload: CheckoutPayload }) =>
      billingService.checkout(kind, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ immediate, reason }: { immediate: boolean; reason?: string }) => billingService.cancel(immediate, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });
}

export function useValidateCoupon() {
  return useMutation({
    mutationFn: ({ code, amount }: { code: string; amount: number }) => billingService.validateCoupon(code, amount),
  });
}

export function useBillingAddress() {
  return useQuery({ queryKey: ['billing', 'address'], queryFn: () => billingService.getBillingAddress() });
}

export function useSaveBillingAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (address: BillingAddress) => billingService.saveBillingAddress(address),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['billing', 'address'] });
    },
  });
}

export function usePaymentHistory() {
  return useQuery({ queryKey: ['billing', 'payments'], queryFn: () => billingService.getPaymentHistory() });
}

export function useInvoices() {
  return useQuery({ queryKey: ['billing', 'invoices'], queryFn: () => billingService.listInvoices() });
}
