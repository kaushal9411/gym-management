'use client';

import { useQuery } from '@tanstack/react-query';

import { adminPaymentService } from '../services/payment.service';

export function usePayments(params: { status?: string; page: number; limit: number }) {
  return useQuery({ queryKey: ['admin', 'payments', params], queryFn: () => adminPaymentService.list(params) });
}

export function useInvoicesAdmin(params: { page: number; limit: number }) {
  return useQuery({ queryKey: ['admin', 'invoices', params], queryFn: () => adminPaymentService.listInvoices(params) });
}
