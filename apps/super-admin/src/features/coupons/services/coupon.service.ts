import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';
import type { Coupon, UpsertCouponInput } from '../types';

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
      throw toAdminServiceError(error);
    }
  }

  async create(input: UpsertCouponInput): Promise<Coupon> {
    try {
      const res = await apiClient.post<ApiEnvelope<Coupon>>('/admin/coupons', input);
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async update(id: string, input: Partial<UpsertCouponInput>): Promise<Coupon> {
    try {
      const res = await apiClient.put<ApiEnvelope<Coupon>>(`/admin/coupons/${id}`, input);
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await apiClient.delete(`/admin/coupons/${id}`);
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }
}

export const adminCouponService = new AdminCouponService();
