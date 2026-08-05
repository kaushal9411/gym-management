import { apiClient } from '@/features/auth/services/api-client';
import type {
  ClassBooking,
  ClassSession,
  ClassSessionDetail,
  CreateGroupClassPayload,
  GroupClass,
  ListGroupClassesParams,
  ListSessionsParams,
  Paginated,
  ScheduleSlot,
  UpdateGroupClassPayload,
} from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class ClassService {
  // ── Group classes ──────────────────────────────────────────────────────

  async listClasses(params: ListGroupClassesParams): Promise<Paginated<GroupClass>> {
    const res = await apiClient.get<ApiEnvelope<Paginated<GroupClass>>>('/classes', { params });
    return res.data.data;
  }

  async listActiveClasses(): Promise<GroupClass[]> {
    const res = await apiClient.get<ApiEnvelope<GroupClass[]>>('/classes/assignable');
    return res.data.data;
  }

  async getClassById(id: string): Promise<GroupClass> {
    const res = await apiClient.get<ApiEnvelope<GroupClass>>(`/classes/${id}`);
    return res.data.data;
  }

  async createClass(payload: CreateGroupClassPayload): Promise<GroupClass> {
    const res = await apiClient.post<ApiEnvelope<GroupClass>>('/classes', payload);
    return res.data.data;
  }

  async updateClass(id: string, payload: UpdateGroupClassPayload): Promise<GroupClass> {
    const res = await apiClient.patch<ApiEnvelope<GroupClass>>(`/classes/${id}`, payload);
    return res.data.data;
  }

  async setSchedule(id: string, slots: ScheduleSlot[]): Promise<GroupClass> {
    const res = await apiClient.patch<ApiEnvelope<GroupClass>>(`/classes/${id}/schedule`, { slots });
    return res.data.data;
  }

  async deleteClass(id: string): Promise<void> {
    await apiClient.delete(`/classes/${id}`);
  }

  async restoreClass(id: string): Promise<void> {
    await apiClient.post(`/classes/${id}/restore`);
  }

  // ── Sessions ────────────────────────────────────────────────────────────

  async listSessions(params: ListSessionsParams): Promise<ClassSession[]> {
    const res = await apiClient.get<ApiEnvelope<ClassSession[]>>('/class-sessions', { params });
    return res.data.data;
  }

  async getSessionById(id: string): Promise<ClassSessionDetail> {
    const res = await apiClient.get<ApiEnvelope<ClassSessionDetail>>(`/class-sessions/${id}`);
    return res.data.data;
  }

  async generateSessions(daysAhead?: number): Promise<{ created: number }> {
    const res = await apiClient.post<ApiEnvelope<{ created: number }>>('/class-sessions/generate', { daysAhead });
    return res.data.data;
  }

  // ── Bookings ────────────────────────────────────────────────────────────

  async bookMember(sessionId: string, memberId: string): Promise<ClassBooking> {
    const res = await apiClient.post<ApiEnvelope<ClassBooking>>('/bookings', { sessionId, memberId });
    return res.data.data;
  }

  async cancelBooking(bookingId: string): Promise<void> {
    await apiClient.post(`/bookings/${bookingId}/cancel`);
  }
}

export const classService = new ClassService();
