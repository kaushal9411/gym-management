'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminRazorpayService } from '../services/razorpay.service';
import type { SaveRazorpayInput, TestRazorpayInput } from '../types/razorpay';

const KEY = ['admin', 'payment-gateways', 'razorpay'] as const;

export function useRazorpayGateway() {
  return useQuery({ queryKey: KEY, queryFn: () => adminRazorpayService.get(), retry: false });
}

export function useSaveRazorpay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveRazorpayInput) => adminRazorpayService.save(input),
    onSuccess: (data) => queryClient.setQueryData(KEY, data),
  });
}

export function useTestRazorpay() {
  return useMutation({ mutationFn: (input: TestRazorpayInput) => adminRazorpayService.test(input) });
}

export function useRemoveRazorpay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => adminRazorpayService.remove(),
    onSuccess: (data) => queryClient.setQueryData(KEY, data),
  });
}
