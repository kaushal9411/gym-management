'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { AdminServiceError } from '@/features/auth/types';
import { adminTenantBillingService } from '../services/billing.service';
import type { ChangePlanMode } from '../types';

export function toBillingError(error: unknown): AdminServiceError {
  if (error instanceof AdminServiceError) return error;
  return new AdminServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

function useInvalidateTenantBilling(tenantId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'tenants', tenantId] });
  };
}

export function useCreatePaymentLink(tenantId: string) {
  const invalidate = useInvalidateTenantBilling(tenantId);
  return useMutation({
    mutationFn: (invoiceId?: string) => adminTenantBillingService.createPaymentLink(tenantId, invoiceId),
    onSuccess: () => invalidate(),
  });
}

export function useChangePlan(tenantId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateTenantBilling(tenantId);
  return useMutation({
    mutationFn: ({ planId, mode }: { planId: string; mode: ChangePlanMode }) => adminTenantBillingService.changePlan(tenantId, planId, mode),
    onSuccess: () => {
      invalidate();
      // Subscriber counts moved between plans — refresh every plan's list/detail/subscribers view.
      void queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] });
    },
  });
}

export function useVerifyPaymentStatus(tenantId: string) {
  const invalidate = useInvalidateTenantBilling(tenantId);
  return useMutation({
    mutationFn: (paymentId: string) => adminTenantBillingService.verifyPaymentStatus(tenantId, paymentId),
    onSuccess: () => invalidate(),
  });
}

export function useResendNotification(tenantId: string) {
  return useMutation({
    mutationFn: ({ paymentId, medium }: { paymentId: string; medium: 'email' | 'sms' }) =>
      adminTenantBillingService.resendNotification(tenantId, paymentId, medium),
  });
}

export function useEmailInvoice(tenantId: string) {
  return useMutation({
    mutationFn: ({ invoiceId, email }: { invoiceId: string; email?: string }) => adminTenantBillingService.emailInvoice(tenantId, invoiceId, email),
  });
}

export function useDownloadInvoicePdf(tenantId: string) {
  return useMutation({
    mutationFn: ({ invoiceId, invoiceNumber }: { invoiceId: string; invoiceNumber: string }) =>
      adminTenantBillingService.downloadInvoicePdf(tenantId, invoiceId, invoiceNumber),
  });
}
