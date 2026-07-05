'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AdminServiceError } from '@/features/auth/types';
import { adminCouponService } from '../services/coupon.service';
import type { UpsertCouponInput } from '../types';

export function toCouponError(error: unknown): AdminServiceError {
  if (error instanceof AdminServiceError) return error;
  return new AdminServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

export function useCoupons() {
  return useQuery({ queryKey: ['admin', 'coupons'], queryFn: () => adminCouponService.list() });
}

export function useCreateCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertCouponInput) => adminCouponService.create(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] }),
  });
}

export function useDeleteCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminCouponService.remove(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] }),
  });
}
