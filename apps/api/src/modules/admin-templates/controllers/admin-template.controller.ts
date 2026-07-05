import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { adminTemplateService } from '../services/admin-template.service';

export class AdminTemplateController {
  async listEmail(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminTemplateService.listEmailTemplates());
  }

  async upsertEmail(req: Request, res: Response): Promise<void> {
    const template = await adminTemplateService.upsertEmailTemplate(
      req.params.key!,
      req.body as { subject: string; bodyHtml: string; variables: string[]; isActive: boolean },
      req.admin!.sub,
      req.admin!.role,
    );
    sendSuccess(res, template, 'Email template saved.');
  }

  async removeEmail(req: Request, res: Response): Promise<void> {
    await adminTemplateService.removeEmailTemplate(req.params.key!, req.admin!.sub, req.admin!.role);
    sendSuccess(res, null, 'Email template deleted.');
  }

  async listSms(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminTemplateService.listSmsTemplates());
  }

  async upsertSms(req: Request, res: Response): Promise<void> {
    const template = await adminTemplateService.upsertSmsTemplate(
      req.params.key!,
      req.body as { body: string; variables: string[]; isActive: boolean },
      req.admin!.sub,
      req.admin!.role,
    );
    sendSuccess(res, template, 'SMS template saved.');
  }

  async removeSms(req: Request, res: Response): Promise<void> {
    await adminTemplateService.removeSmsTemplate(req.params.key!, req.admin!.sub, req.admin!.role);
    sendSuccess(res, null, 'SMS template deleted.');
  }
}

export const adminTemplateController = new AdminTemplateController();
