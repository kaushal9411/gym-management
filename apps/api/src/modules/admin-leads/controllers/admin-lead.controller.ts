import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { adminLeadService } from '../services/admin-lead.service';
import type { ListLeadsQuery, UpdateLeadInput } from '../validators/admin-lead.validators';

export class AdminLeadController {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminLeadService.list(req.query as unknown as ListLeadsQuery));
  }

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminLeadService.getById(req.params.leadId!));
  }

  async update(req: Request, res: Response): Promise<void> {
    const lead = await adminLeadService.update(req.params.leadId!, req.body as UpdateLeadInput, req.admin!.sub, req.admin!.role);
    sendSuccess(res, lead, 'Lead updated.');
  }

  async remove(req: Request, res: Response): Promise<void> {
    await adminLeadService.remove(req.params.leadId!, req.admin!.sub, req.admin!.role);
    sendSuccess(res, null, 'Lead deleted.');
  }
}

export const adminLeadController = new AdminLeadController();
