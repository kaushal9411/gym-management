import { apiClient } from '@/features/auth/services/api-client';
import type {
  AttendanceDevice,
  AttendanceDeviceWithKey,
  CreateAttendanceDeviceInput,
  ListAttendanceDevicesParams,
  UpdateAttendanceDeviceInput,
} from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class AttendanceDeviceService {
  async list(params: ListAttendanceDevicesParams = {}): Promise<AttendanceDevice[]> {
    const res = await apiClient.get<ApiEnvelope<AttendanceDevice[]>>('/attendance-devices', { params });
    return res.data.data;
  }

  async create(input: CreateAttendanceDeviceInput): Promise<AttendanceDeviceWithKey> {
    const res = await apiClient.post<ApiEnvelope<AttendanceDeviceWithKey>>('/attendance-devices', input);
    return res.data.data;
  }

  async update(deviceId: string, input: UpdateAttendanceDeviceInput): Promise<AttendanceDevice> {
    const res = await apiClient.patch<ApiEnvelope<AttendanceDevice>>(`/attendance-devices/${deviceId}`, input);
    return res.data.data;
  }

  async regenerateKey(deviceId: string): Promise<AttendanceDeviceWithKey> {
    const res = await apiClient.post<ApiEnvelope<AttendanceDeviceWithKey>>(`/attendance-devices/${deviceId}/regenerate-key`);
    return res.data.data;
  }

  async remove(deviceId: string): Promise<void> {
    await apiClient.delete(`/attendance-devices/${deviceId}`);
  }
}

export const attendanceDeviceService = new AttendanceDeviceService();
