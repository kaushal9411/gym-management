import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';
import type { RazorpayGateway, SaveRazorpayInput, TestRazorpayInput, TestRazorpayResult } from '../types/razorpay';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

const PATH = '/admin/payment-gateways/razorpay';

class AdminRazorpayService {
  async get(): Promise<RazorpayGateway> {
    try {
      return (await apiClient.get<ApiEnvelope<RazorpayGateway>>(PATH)).data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async save(input: SaveRazorpayInput): Promise<RazorpayGateway> {
    try {
      return (await apiClient.put<ApiEnvelope<RazorpayGateway>>(PATH, input)).data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async test(input: TestRazorpayInput): Promise<TestRazorpayResult> {
    try {
      return (await apiClient.post<ApiEnvelope<TestRazorpayResult>>(`${PATH}/test`, input)).data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async remove(): Promise<RazorpayGateway> {
    try {
      return (await apiClient.delete<ApiEnvelope<RazorpayGateway>>(PATH)).data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }
}

export const adminRazorpayService = new AdminRazorpayService();
