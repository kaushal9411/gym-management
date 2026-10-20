import type { AutomationRuleKey, CampaignRecipientStatus, CampaignStatus, TenantNotificationChannel } from '@prisma/client';
import type { Request, Response } from 'express';

import { ValidationError } from '../../../core/errors/app-error';
import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import { AudienceService } from '../services/audience.service';
import { AutomationService } from '../services/automation.service';
import { CampaignService } from '../services/campaign.service';
import { buildOverview } from '../services/overview.service';
import { TestSendService } from '../services/test-send.service';
import type {
  CreateCampaignInput,
  PreviewInput,
  PutAutomationInput,
  TestSendInput,
  UpdateCampaignInput,
} from '../validators/communications.validators';

const MAX_IDEMPOTENCY_KEY = 100;

/** Optional `Idempotency-Key` header: trimmed, 1..100 printable characters. */
function idempotencyKeyOf(req: Request): string | undefined {
  const raw = req.get('idempotency-key');
  if (raw === undefined) return undefined;
  const key = raw.trim();
  if (!key || key.length > MAX_IDEMPOTENCY_KEY || !/^[\x21-\x7e]+$/.test(key)) {
    throw new ValidationError('Invalid Idempotency-Key header', { fields: [{ field: 'Idempotency-Key', message: `Use 1-${MAX_IDEMPOTENCY_KEY} visible characters without spaces.` }] });
  }
  return key;
}

const campaigns = (req: Request): CampaignService => new CampaignService(req.tenant!.id);

export class CommunicationsController {
  async overview(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await buildOverview(req.tenant!.id));
  }

  async preview(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new AudienceService(req.tenant!.id).preview(req.body as PreviewInput, req.auth!.sub));
  }

  async audienceMembers(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new AudienceService(req.tenant!.id).searchMembers(req.query as unknown as { search?: string; branchId?: string; page: number; limit: number }, req.auth!.sub));
  }

  async createCampaign(req: Request, res: Response): Promise<void> {
    const { campaign, replay } = await campaigns(req).create(req.body as CreateCampaignInput, actorFrom(req), idempotencyKeyOf(req));
    const message =
      replay ? 'This request was already processed - returning the existing campaign.'
      : campaign.status === 'DRAFT' ? 'Draft saved.'
      : campaign.status === 'SCHEDULED' ? 'Campaign scheduled.'
      : 'Campaign is sending.';
    sendSuccess(res, { ...campaign, idempotentReplay: replay }, message, replay ? 200 : 201);
  }

  async listCampaigns(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await campaigns(req).list(req.query as unknown as { status?: CampaignStatus; search?: string; page: number; limit: number }));
  }

  async getCampaign(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await campaigns(req).getById(req.params.id!));
  }

  async recipients(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await campaigns(req).listRecipients(req.params.id!, req.query as unknown as { status?: CampaignRecipientStatus; channel?: TenantNotificationChannel; search?: string; page: number; limit: number }));
  }

  async updateCampaign(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await campaigns(req).update(req.params.id!, req.body as UpdateCampaignInput, actorFrom(req)), 'Campaign updated.');
  }

  async sendCampaign(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await campaigns(req).send(req.params.id!, (req.body as { confirmLargeSend: boolean }).confirmLargeSend, actorFrom(req)), 'Campaign is sending.');
  }

  async cancelCampaign(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await campaigns(req).cancel(req.params.id!, actorFrom(req)), 'Campaign cancelled.');
  }

  async retryFailed(req: Request, res: Response): Promise<void> {
    const result = await campaigns(req).retryFailed(req.params.id!, actorFrom(req));
    sendSuccess(res, result, `Retrying ${result.retried} failed message${result.retried === 1 ? '' : 's'}.`);
  }

  async testSend(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new TestSendService(req.tenant!.id).send(req.body as TestSendInput, actorFrom(req)), 'Test message processed.');
  }

  async listAutomations(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new AutomationService(req.tenant!.id).list());
  }

  async putAutomation(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new AutomationService(req.tenant!.id).put(req.params.key as AutomationRuleKey, req.body as PutAutomationInput, actorFrom(req)), 'Automation saved.');
  }

  async testAutomation(req: Request, res: Response): Promise<void> {
    const channels = (req.body as { channels?: string[] }).channels;
    sendSuccess(res, await new AutomationService(req.tenant!.id).test(req.params.key as AutomationRuleKey, channels, actorFrom(req)), 'Test message processed.');
  }
}

export const communicationsController = new CommunicationsController();
