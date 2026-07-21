import { apiClient } from '@/features/auth/services/api-client';
import type {
  AssignMembershipPayload,
  BulkMemberActionResult,
  CancelMembershipPayload,
  CreateMemberPayload,
  CreateMembershipPlanPayload,
  DowngradeMembershipPayload,
  ExtendMembershipPayload,
  ListMembersParams,
  ListMembershipPlansParams,
  MemberBulkImportResult,
  MemberBulkImportRow,
  MemberDetail,
  MemberDocument,
  MemberDocumentType,
  MemberListItem,
  MembershipPlan,
  Paginated,
  RenewMembershipPayload,
  UpdateMemberPayload,
  UpdateMembershipPlanPayload,
  UpgradeMembershipPayload,
} from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class MemberService {
  async list(params: ListMembersParams): Promise<Paginated<MemberListItem>> {
    const res = await apiClient.get<ApiEnvelope<Paginated<MemberListItem>>>('/members', { params });
    return res.data.data;
  }

  async getById(id: string): Promise<MemberDetail> {
    const res = await apiClient.get<ApiEnvelope<MemberDetail>>(`/members/${id}`);
    return res.data.data;
  }

  async create(payload: CreateMemberPayload): Promise<MemberDetail> {
    const res = await apiClient.post<ApiEnvelope<MemberDetail>>('/members', payload);
    return res.data.data;
  }

  async update(id: string, payload: UpdateMemberPayload): Promise<MemberDetail> {
    const res = await apiClient.patch<ApiEnvelope<MemberDetail>>(`/members/${id}`, payload);
    return res.data.data;
  }

  async activate(id: string): Promise<void> {
    await apiClient.post(`/members/${id}/activate`);
  }

  async deactivate(id: string): Promise<void> {
    await apiClient.post(`/members/${id}/deactivate`);
  }

  async freeze(id: string, reason?: string): Promise<void> {
    await apiClient.post(`/members/${id}/freeze`, { reason });
  }

  async unfreeze(id: string): Promise<void> {
    await apiClient.post(`/members/${id}/unfreeze`);
  }

  async softDelete(id: string): Promise<void> {
    await apiClient.delete(`/members/${id}`);
  }

  async restore(id: string): Promise<void> {
    await apiClient.post(`/members/${id}/restore`);
  }

  async assignMembership(id: string, payload: AssignMembershipPayload): Promise<MemberDetail> {
    const res = await apiClient.put<ApiEnvelope<MemberDetail>>(`/members/${id}/membership`, payload);
    return res.data.data;
  }

  async renewMembership(id: string, payload: RenewMembershipPayload): Promise<MemberDetail> {
    const res = await apiClient.post<ApiEnvelope<MemberDetail>>(`/members/${id}/membership/renew`, payload);
    return res.data.data;
  }

  async upgradeMembership(id: string, payload: UpgradeMembershipPayload): Promise<MemberDetail> {
    const res = await apiClient.post<ApiEnvelope<MemberDetail>>(`/members/${id}/membership/upgrade`, payload);
    return res.data.data;
  }

  async downgradeMembership(id: string, payload: DowngradeMembershipPayload): Promise<MemberDetail> {
    const res = await apiClient.post<ApiEnvelope<MemberDetail>>(`/members/${id}/membership/downgrade`, payload);
    return res.data.data;
  }

  async extendMembership(id: string, payload: ExtendMembershipPayload): Promise<MemberDetail> {
    const res = await apiClient.post<ApiEnvelope<MemberDetail>>(`/members/${id}/membership/extend`, payload);
    return res.data.data;
  }

  async cancelMembership(id: string, payload: CancelMembershipPayload): Promise<MemberDetail> {
    const res = await apiClient.post<ApiEnvelope<MemberDetail>>(`/members/${id}/membership/cancel`, payload);
    return res.data.data;
  }

  async resumeMembership(id: string): Promise<void> {
    await apiClient.post(`/members/${id}/resume`);
  }

  async transferBranch(id: string, branchId: string): Promise<MemberDetail> {
    const res = await apiClient.put<ApiEnvelope<MemberDetail>>(`/members/${id}/branch`, { branchId });
    return res.data.data;
  }

  async assignTrainer(id: string, trainerId: string | null): Promise<MemberDetail> {
    const res = await apiClient.put<ApiEnvelope<MemberDetail>>(`/members/${id}/trainer`, { trainerId });
    return res.data.data;
  }

  async regenerateQrCode(id: string): Promise<{ qrCodeToken: string; qrCodeImageUrl: string }> {
    const res = await apiClient.post<ApiEnvelope<{ qrCodeToken: string; qrCodeImageUrl: string }>>(`/members/${id}/qr-code`);
    return res.data.data;
  }

  async listDocuments(id: string): Promise<MemberDocument[]> {
    const res = await apiClient.get<ApiEnvelope<MemberDocument[]>>(`/members/${id}/documents`);
    return res.data.data;
  }

  async uploadDocument(id: string, type: MemberDocumentType, fileName: string, fileDataUrl: string): Promise<MemberDocument> {
    const res = await apiClient.post<ApiEnvelope<MemberDocument>>(`/members/${id}/documents`, { type, fileName, fileDataUrl });
    return res.data.data;
  }

  async deleteDocument(id: string, documentId: string): Promise<void> {
    await apiClient.delete(`/members/${id}/documents/${documentId}`);
  }

  /** Returns a blob URL — caller revokes after triggering the download. */
  async exportCsvUrl(): Promise<string> {
    const res = await apiClient.get('/members/export', { responseType: 'blob' });
    return URL.createObjectURL(res.data as Blob);
  }

  async bulkImport(rows: MemberBulkImportRow[]): Promise<MemberBulkImportResult> {
    const res = await apiClient.post<ApiEnvelope<MemberBulkImportResult>>('/members/import', { rows });
    return res.data.data;
  }

  async bulkActivate(memberIds: string[]): Promise<BulkMemberActionResult> {
    const res = await apiClient.post<ApiEnvelope<BulkMemberActionResult>>('/members/bulk/activate', { memberIds });
    return res.data.data;
  }

  async bulkDeactivate(memberIds: string[]): Promise<BulkMemberActionResult> {
    const res = await apiClient.post<ApiEnvelope<BulkMemberActionResult>>('/members/bulk/deactivate', { memberIds });
    return res.data.data;
  }

  async bulkDelete(memberIds: string[]): Promise<BulkMemberActionResult> {
    const res = await apiClient.post<ApiEnvelope<BulkMemberActionResult>>('/members/bulk/delete', { memberIds });
    return res.data.data;
  }

  // ── Membership Plans (Prompt 15) ────────────────────────────────────────
  async listPlans(params: ListMembershipPlansParams): Promise<Paginated<MembershipPlan>> {
    const res = await apiClient.get<ApiEnvelope<Paginated<MembershipPlan>>>('/membership-plans', { params });
    return res.data.data;
  }

  /** Active-only, unfiltered — backs Assign/Renew/Upgrade/Downgrade plan dropdowns. */
  async listAssignablePlans(): Promise<MembershipPlan[]> {
    const res = await apiClient.get<ApiEnvelope<MembershipPlan[]>>('/membership-plans/assignable');
    return res.data.data;
  }

  async getPlanById(planId: string): Promise<MembershipPlan> {
    const res = await apiClient.get<ApiEnvelope<MembershipPlan>>(`/membership-plans/${planId}`);
    return res.data.data;
  }

  async createPlan(payload: CreateMembershipPlanPayload): Promise<MembershipPlan> {
    const res = await apiClient.post<ApiEnvelope<MembershipPlan>>('/membership-plans', payload);
    return res.data.data;
  }

  async updatePlan(planId: string, payload: UpdateMembershipPlanPayload): Promise<MembershipPlan> {
    const res = await apiClient.patch<ApiEnvelope<MembershipPlan>>(`/membership-plans/${planId}`, payload);
    return res.data.data;
  }

  async activatePlan(planId: string): Promise<void> {
    await apiClient.post(`/membership-plans/${planId}/activate`);
  }

  async deactivatePlan(planId: string): Promise<void> {
    await apiClient.post(`/membership-plans/${planId}/deactivate`);
  }

  async deletePlan(planId: string): Promise<void> {
    await apiClient.delete(`/membership-plans/${planId}`);
  }

  async restorePlan(planId: string): Promise<MembershipPlan> {
    const res = await apiClient.post<ApiEnvelope<MembershipPlan>>(`/membership-plans/${planId}/restore`);
    return res.data.data;
  }

  async duplicatePlan(planId: string): Promise<MembershipPlan> {
    const res = await apiClient.post<ApiEnvelope<MembershipPlan>>(`/membership-plans/${planId}/duplicate`);
    return res.data.data;
  }
}

export const memberService = new MemberService();
