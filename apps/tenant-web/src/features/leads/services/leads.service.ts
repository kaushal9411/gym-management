import { apiClient } from '@/features/auth/services/api-client';
import { AuthServiceError } from '@/features/auth/types';
import type {
  AddActivityPayload,
  AnalyticsParams,
  ChangeStatusPayload,
  ConvertLeadPayload,
  ConvertLeadResult,
  CreateLeadPayload,
  FollowUpsResponse,
  LeadAnalytics,
  LeadAssignee,
  LeadDuplicate,
  LeadDetail,
  LeadListResponse,
  ListLeadsParams,
  UpdateLeadPayload,
} from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

/** Arrays are sent comma-separated (accepted by the API) so the query string stays short. */
function serialize(params: ListLeadsParams): Record<string, string | number | undefined> {
  const { status, source, ...rest } = params;
  return { ...rest, status: status?.length ? status.join(',') : undefined, source: source?.length ? source.join(',') : undefined };
}

/** AuthServiceError that also carries the 409 `data.duplicates` list (the shared client drops the raw response, so 409 is resolved and inspected here). */
export class LeadError extends AuthServiceError {
  constructor(message: string, public readonly duplicates: LeadDuplicate[] = [], code: AuthServiceError['code'] = 'UNKNOWN', public readonly notFound = false) {
    super(code, message);
    this.name = 'LeadError';
  }
}

const ALLOW_409 = { validateStatus: (st: number) => (st >= 200 && st < 300) || st === 409 };

function unwrap<T>(res: { status: number; data: ApiEnvelope<T> & { data: T | { duplicates?: LeadDuplicate[] } } }): T {
  if (res.status === 409) {
    const d = res.data.data as { duplicates?: LeadDuplicate[] } | null;
    throw new LeadError(res.data.message, Array.isArray(d?.duplicates) ? d.duplicates : []);
  }
  return res.data.data as T;
}

class LeadsService {
  async list(params: ListLeadsParams): Promise<LeadListResponse> {
    const res = await apiClient.get<ApiEnvelope<LeadListResponse>>('/leads', { params: serialize(params) });
    return res.data.data;
  }

  async get(id: string): Promise<LeadDetail> {
    const res = await apiClient.get<ApiEnvelope<LeadDetail>>(`/leads/${id}`, { validateStatus: (st) => (st >= 200 && st < 300) || st === 404 || st === 422 });
    if (res.status === 404 || res.status === 422) throw new LeadError(res.data.message, [], 'UNKNOWN', true);
    return res.data.data;
  }

  async create(payload: CreateLeadPayload): Promise<LeadDetail> {
    return unwrap(await apiClient.post<ApiEnvelope<LeadDetail>>('/leads', payload, ALLOW_409));
  }

  async update(id: string, payload: UpdateLeadPayload): Promise<LeadDetail> {
    return unwrap(await apiClient.patch<ApiEnvelope<LeadDetail>>(`/leads/${id}`, payload, ALLOW_409));
  }

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/leads/${id}`);
  }

  async changeStatus(id: string, payload: ChangeStatusPayload): Promise<LeadDetail> {
    const res = await apiClient.patch<ApiEnvelope<LeadDetail>>(`/leads/${id}/status`, payload);
    return res.data.data;
  }

  async assign(id: string, assignedToUserId: string | null): Promise<LeadDetail> {
    const res = await apiClient.patch<ApiEnvelope<LeadDetail>>(`/leads/${id}/assign`, { assignedToUserId });
    return res.data.data;
  }

  async addActivity(id: string, payload: AddActivityPayload): Promise<LeadDetail> {
    const res = await apiClient.post<ApiEnvelope<LeadDetail>>(`/leads/${id}/activities`, payload);
    return res.data.data;
  }

  async convert(id: string, payload: ConvertLeadPayload): Promise<ConvertLeadResult> {
    const res = await apiClient.post<ApiEnvelope<ConvertLeadResult>>(`/leads/${id}/convert`, payload);
    return res.data.data;
  }

  async followUps(params: { scope?: 'mine' | 'all'; bucket?: 'due' | 'overdue' | 'today' | 'upcoming'; branchId?: string; limit?: number }): Promise<FollowUpsResponse> {
    const res = await apiClient.get<ApiEnvelope<FollowUpsResponse>>('/leads/follow-ups', { params });
    return res.data.data;
  }

  async assignees(): Promise<LeadAssignee[]> {
    const res = await apiClient.get<ApiEnvelope<LeadAssignee[]>>('/leads/assignees');
    return res.data.data;
  }

  async analytics(params: AnalyticsParams): Promise<LeadAnalytics> {
    const res = await apiClient.get<ApiEnvelope<LeadAnalytics>>('/leads/analytics', { params });
    return res.data.data;
  }

  async exportCsv(params: ListLeadsParams): Promise<void> {
    const { page: _p, limit: _l, sortBy: _s, sortDir: _d, ...filters } = params;
    void _p; void _l; void _s; void _d;
    const res = await apiClient.get('/leads/export', { params: serialize(filters), responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export const leadsService = new LeadsService();
