import { apiClient } from '@/features/auth/services/api-client';
import type {
  AudienceMember,
  AudienceMemberParams,
  AudiencePreview,
  AutomationInput,
  AutomationKey,
  AutomationRule,
  AutomationsResult,
  Campaign,
  CampaignDetail,
  CampaignInput,
  CampaignListParams,
  CampaignListResult,
  CampaignPatch,
  CampaignRecipient,
  Channel,
  CommunicationsOverview,
  Paginated,
  PreviewRequest,
  RecipientListParams,
  TestSendInput,
  TestSendResult,
} from '../types';

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

const BASE = '/communications';

/** Wraps every `/communications/*` endpoint (staff plane, `apiClient`). Errors arrive as `AuthServiceError` (with `.details`) from the shared interceptor. */
class CommunicationsService {
  async overview(): Promise<CommunicationsOverview> {
    const res = await apiClient.get<Envelope<CommunicationsOverview>>(`${BASE}/overview`);
    return res.data.data;
  }

  async previewAudience(input: PreviewRequest): Promise<AudiencePreview> {
    const res = await apiClient.post<Envelope<AudiencePreview>>(`${BASE}/audience/preview`, input, { silent: true });
    return res.data.data;
  }

  async listAudienceMembers(params: AudienceMemberParams): Promise<Paginated<AudienceMember>> {
    const res = await apiClient.get<Envelope<Paginated<AudienceMember>>>(`${BASE}/audience/members`, { params, silent: true });
    return res.data.data;
  }

  /** `idempotencyKey` makes a repeated press return the first campaign instead of sending twice. */
  async createCampaign(input: CampaignInput, idempotencyKey: string): Promise<Campaign> {
    const res = await apiClient.post<Envelope<Campaign>>(`${BASE}/campaigns`, input, { headers: { 'Idempotency-Key': idempotencyKey }, silent: true });
    return res.data.data;
  }

  async listCampaigns(params: CampaignListParams): Promise<CampaignListResult> {
    const res = await apiClient.get<Envelope<CampaignListResult>>(`${BASE}/campaigns`, { params });
    return res.data.data;
  }

  async getCampaign(id: string): Promise<CampaignDetail> {
    const res = await apiClient.get<Envelope<CampaignDetail>>(`${BASE}/campaigns/${id}`, { silent: true });
    return res.data.data;
  }

  async listRecipients(id: string, params: RecipientListParams): Promise<Paginated<CampaignRecipient>> {
    const res = await apiClient.get<Envelope<Paginated<CampaignRecipient>>>(`${BASE}/campaigns/${id}/recipients`, { params, silent: true });
    return res.data.data;
  }

  async updateCampaign(id: string, patch: CampaignPatch): Promise<Campaign> {
    const res = await apiClient.patch<Envelope<Campaign>>(`${BASE}/campaigns/${id}`, patch);
    return res.data.data;
  }

  async sendDraft(id: string, confirmLargeSend: boolean): Promise<Campaign> {
    const res = await apiClient.post<Envelope<Campaign>>(`${BASE}/campaigns/${id}/send`, { confirmLargeSend });
    return res.data.data;
  }

  async cancelCampaign(id: string): Promise<Campaign> {
    const res = await apiClient.post<Envelope<Campaign>>(`${BASE}/campaigns/${id}/cancel`, {});
    return res.data.data;
  }

  async retryFailed(id: string): Promise<{ retried: number; campaign: Campaign }> {
    const res = await apiClient.post<Envelope<{ retried: number; campaign: Campaign }>>(`${BASE}/campaigns/${id}/retry-failed`, {});
    return res.data.data;
  }

  async testSend(input: TestSendInput): Promise<TestSendResult> {
    const res = await apiClient.post<Envelope<TestSendResult>>(`${BASE}/test-send`, input);
    return res.data.data;
  }

  async listAutomations(): Promise<AutomationsResult> {
    const res = await apiClient.get<Envelope<AutomationsResult>>(`${BASE}/automations`);
    return res.data.data;
  }

  async updateAutomation(key: AutomationKey, input: AutomationInput): Promise<AutomationRule> {
    const res = await apiClient.put<Envelope<AutomationRule>>(`${BASE}/automations/${key}`, input);
    return res.data.data;
  }

  async testAutomation(key: AutomationKey, channels?: Channel[]): Promise<TestSendResult> {
    const res = await apiClient.post<Envelope<TestSendResult>>(`${BASE}/automations/${key}/test`, channels ? { channels } : {});
    return res.data.data;
  }
}

export const communicationsService = new CommunicationsService();
