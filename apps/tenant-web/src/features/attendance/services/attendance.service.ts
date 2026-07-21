import { apiClient } from '@/features/auth/services/api-client';
import type {
  AttendanceRecord,
  AttendanceSummary,
  CheckInPayload,
  CheckOutPayload,
  ListAttendanceParams,
  PaginatedAttendance,
  QrValidationResult,
  UpdateAttendancePayload,
} from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class AttendanceService {
  async checkIn(payload: CheckInPayload): Promise<AttendanceRecord> {
    const res = await apiClient.post<ApiEnvelope<AttendanceRecord>>('/attendance/check-in', payload);
    return res.data.data;
  }

  async checkOut(payload: CheckOutPayload): Promise<AttendanceRecord> {
    const res = await apiClient.post<ApiEnvelope<AttendanceRecord>>('/attendance/check-out', payload);
    return res.data.data;
  }

  async manualCheckIn(payload: CheckInPayload): Promise<AttendanceRecord> {
    const res = await apiClient.post<ApiEnvelope<AttendanceRecord>>('/attendance/manual-check-in', payload);
    return res.data.data;
  }

  async manualCheckOut(payload: CheckOutPayload): Promise<AttendanceRecord> {
    const res = await apiClient.post<ApiEnvelope<AttendanceRecord>>('/attendance/manual-check-out', payload);
    return res.data.data;
  }

  async validateQrCode(qrCodeToken: string): Promise<QrValidationResult> {
    const res = await apiClient.post<ApiEnvelope<QrValidationResult>>('/attendance/validate-qr', { qrCodeToken });
    return res.data.data;
  }

  async list(params: ListAttendanceParams): Promise<PaginatedAttendance> {
    const res = await apiClient.get<ApiEnvelope<PaginatedAttendance>>('/attendance', { params });
    return res.data.data;
  }

  async getToday(branchId?: string): Promise<AttendanceRecord[]> {
    const res = await apiClient.get<ApiEnvelope<AttendanceRecord[]>>('/attendance/today', { params: { branchId } });
    return res.data.data;
  }

  async getById(id: string): Promise<AttendanceRecord> {
    const res = await apiClient.get<ApiEnvelope<AttendanceRecord>>(`/attendance/${id}`);
    return res.data.data;
  }

  async getMemberAttendance(memberId: string, page: number, limit: number): Promise<PaginatedAttendance> {
    const res = await apiClient.get<ApiEnvelope<PaginatedAttendance>>(`/attendance/member/${memberId}`, { params: { page, limit } });
    return res.data.data;
  }

  async getBranchAttendance(branchId: string, params: Omit<ListAttendanceParams, 'branchId'>): Promise<PaginatedAttendance> {
    const res = await apiClient.get<ApiEnvelope<PaginatedAttendance>>(`/attendance/branch/${branchId}`, { params });
    return res.data.data;
  }

  async getSummary(params: { branchId?: string; dateFrom?: string; dateTo?: string }): Promise<AttendanceSummary> {
    const res = await apiClient.get<ApiEnvelope<AttendanceSummary>>('/attendance/summary', { params });
    return res.data.data;
  }

  async update(id: string, payload: UpdateAttendancePayload): Promise<AttendanceRecord> {
    const res = await apiClient.patch<ApiEnvelope<AttendanceRecord>>(`/attendance/${id}`, payload);
    return res.data.data;
  }

  async softDelete(id: string): Promise<void> {
    await apiClient.delete(`/attendance/${id}`);
  }

  /** Returns a blob URL — caller revokes after triggering the download. */
  async exportCsvUrl(params: Partial<ListAttendanceParams>): Promise<string> {
    const res = await apiClient.get('/attendance/export', { params, responseType: 'blob' });
    return URL.createObjectURL(res.data as Blob);
  }

  /** Returns a blob URL — caller revokes after triggering the download. */
  async exportExcelUrl(params: Partial<ListAttendanceParams>): Promise<string> {
    const res = await apiClient.get('/attendance/export/excel', { params, responseType: 'blob' });
    return URL.createObjectURL(res.data as Blob);
  }
}

export const attendanceService = new AttendanceService();
