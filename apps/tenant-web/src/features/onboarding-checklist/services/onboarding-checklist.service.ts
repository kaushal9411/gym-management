import { apiClient } from '@/features/auth/services/api-client';
import type { OnboardingChecklistStatus } from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class OnboardingChecklistService {
  async getStatus(): Promise<OnboardingChecklistStatus> {
    const res = await apiClient.get<ApiEnvelope<OnboardingChecklistStatus>>('/onboarding-checklist');
    return res.data.data;
  }

  async dismiss(): Promise<void> {
    await apiClient.post('/onboarding-checklist/dismiss');
  }
}

export const onboardingChecklistService = new OnboardingChecklistService();
