import axios from 'axios';

import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';
import { AdminServiceError } from '@/features/auth/types';
import type { Coupon, UpsertCouponInput } from '../types';

/** AdminServiceError + the API's per-field validation messages (422 `errors[]`), so forms can mark the right field. */
export class CouponServiceError extends AdminServiceError {
  constructor(base: AdminServiceError, public readonly fields: Record<string, string>) {
    super(base.code, base.message);
  }
}

export function toCouponServiceError(error: unknown): AdminServiceError {
  const base = toAdminServiceError(error);
  if (!axios.isAxiosError(error)) return base;
  const list = (error.response?.data as { errors?: Array<{ field?: string; message?: string }> } | undefined)?.errors;
  const fields: Record<string, string> = {};
  for (const e of list ?? []) if (e.field && e.message && !fields[e.field]) fields[e.field] = e.message;
  if (!Object.keys(fields).length) return base;
  const first = Object.values(fields)[0]!;
  return new CouponServiceError(new AdminServiceError(base.code, /validation failed/i.test(base.message) ? first : base.message), fields);
}

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class AdminCouponService {
  async list(): Promise<Coupon[]> {
    try {
      const res = await apiClient.get<ApiEnvelope<Coupon[]>>('/admin/coupons');
      return res.data.data;
    } catch (error) {
      throw toCouponServiceError(error);
    }
  }

  async create(input: UpsertCouponInput): Promise<Coupon> {
    try {
      const res = await apiClient.post<ApiEnvelope<Coupon>>('/admin/coupons', input);
      return res.data.data;
    } catch (error) {
      throw toCouponServiceError(error);
    }
  }

  async update(id: string, input: Partial<UpsertCouponInput>): Promise<Coupon> {
    try {
      const res = await apiClient.put<ApiEnvelope<Coupon>>(`/admin/coupons/${id}`, input);
      return res.data.data;
    } catch (error) {
      throw toCouponServiceError(error);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await apiClient.delete(`/admin/coupons/${id}`);
    } catch (error) {
      throw toCouponServiceError(error);
    }
  }
}

export const adminCouponService = new AdminCouponService();
