import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import type { CreateScheduledReportInput, UpdateScheduledReportInput } from '../dto/reports.dto';
import { ScheduledReportService } from '../services/scheduled-report.service';

function serviceFor(req: Request): ScheduledReportService {
  return new ScheduledReportService(req.tenant!.id);
}

export class ScheduledReportController {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).list());
  }

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getById(req.params.id!));
  }

  async create(req: Request, res: Response): Promise<void> {
    const schedule = await serviceFor(req).create(req.body as CreateScheduledReportInput, actorFrom(req));
    sendSuccess(res, schedule, 'Scheduled report created.', 201);
  }

  async update(req: Request, res: Response): Promise<void> {
    const schedule = await serviceFor(req).update(req.params.id!, req.body as UpdateScheduledReportInput, actorFrom(req));
    sendSuccess(res, schedule, 'Scheduled report updated.');
  }

  async remove(req: Request, res: Response): Promise<void> {
    await serviceFor(req).delete(req.params.id!, actorFrom(req));
    sendSuccess(res, null, 'Scheduled report deleted.');
  }

  async runNow(req: Request, res: Response): Promise<void> {
    await serviceFor(req).markRun(req.params.id!);
    sendSuccess(res, null, 'Scheduled report run recorded.');
  }
}

export const scheduledReportController = new ScheduledReportController();
