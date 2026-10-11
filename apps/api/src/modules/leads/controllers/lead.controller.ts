import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import { LeadService } from '../services/lead.service';
import type {
  AddActivityInput,
  AssignLeadInput,
  ChangeStatusInput,
  ConvertLeadInput,
  CreateLeadInput,
  ExportLeadsQuery,
  FollowUpsQuery,
  LeadAnalyticsQuery,
  ListLeadsQuery,
  UpdateLeadInput,
} from '../validators/lead.validators';

const serviceFor = (req: Request): LeadService => new LeadService(req.tenant!.id);

export class LeadController {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).list(req.query as unknown as ListLeadsQuery, req.auth!.sub));
  }

  async analytics(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).analytics(req.query as unknown as LeadAnalyticsQuery, req.auth!.sub));
  }

  async followUps(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).followUps(req.query as unknown as FollowUpsQuery, req.auth!.sub));
  }

  async assignees(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).assignees());
  }

  async exportCsv(req: Request, res: Response): Promise<void> {
    const csv = await serviceFor(req).exportCsv(req.query as unknown as ExportLeadsQuery, actorFrom(req));
    res
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="leads-export-${new Date().toISOString().slice(0, 10)}.csv"`)
      .send(csv);
  }

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getById(req.params.id!, req.auth!.sub));
  }

  async create(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).create(req.body as CreateLeadInput, actorFrom(req)), 'Lead created.', 201);
  }

  async update(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).update(req.params.id!, req.body as UpdateLeadInput, actorFrom(req)), 'Lead updated.');
  }

  async softDelete(req: Request, res: Response): Promise<void> {
    await serviceFor(req).softDelete(req.params.id!, actorFrom(req));
    sendSuccess(res, null, 'Lead deleted.');
  }

  async changeStatus(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).changeStatus(req.params.id!, req.body as ChangeStatusInput, actorFrom(req)), 'Lead status updated.');
  }

  async assign(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).assign(req.params.id!, req.body as AssignLeadInput, actorFrom(req)), 'Lead assignment updated.');
  }

  async addActivity(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).addActivity(req.params.id!, req.body as AddActivityInput, actorFrom(req)), 'Activity logged.', 201);
  }

  async convert(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).convert(req.params.id!, req.body as ConvertLeadInput, actorFrom(req)), 'Lead converted to a member.');
  }
}

export const leadController = new LeadController();
