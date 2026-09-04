import { apiClient } from '@/features/auth/services/api-client';
import type { BodyMeasurement, CreateBodyMeasurementPayload, MeasuredMember, UpdateBodyMeasurementPayload } from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class MeasurementService {
  /** Only members with at least one entry — not the full member roster. */
  async listMembers(): Promise<MeasuredMember[]> {
    const res = await apiClient.get<ApiEnvelope<MeasuredMember[]>>('/measurements/members');
    return res.data.data;
  }

  async listForMember(memberId: string): Promise<BodyMeasurement[]> {
    const res = await apiClient.get<ApiEnvelope<BodyMeasurement[]>>(`/measurements/members/${memberId}`);
    return res.data.data;
  }

  async create(memberId: string, payload: CreateBodyMeasurementPayload): Promise<BodyMeasurement> {
    const res = await apiClient.post<ApiEnvelope<BodyMeasurement>>(`/measurements/members/${memberId}`, payload);
    return res.data.data;
  }

  async update(id: string, payload: UpdateBodyMeasurementPayload): Promise<BodyMeasurement> {
    const res = await apiClient.patch<ApiEnvelope<BodyMeasurement>>(`/measurements/${id}`, payload);
    return res.data.data;
  }

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/measurements/${id}`);
  }
}

export const measurementService = new MeasurementService();
