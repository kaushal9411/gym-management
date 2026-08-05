import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import type { ListSessionsQuery } from '../dto/classes.dto';
import { ClassSessionService } from '../services/class-session.service';

function serviceFor(req: Request): ClassSessionService {
  return new ClassSessionService(req.tenant!.id);
}

export class ClassSessionController {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).listByRange(req.auth?.sub, req.query as unknown as ListSessionsQuery));
  }

  async getById(req: Request<{ id: string }>, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getById(req.params.id));
  }

  async generate(req: Request, res: Response): Promise<void> {
    const { daysAhead } = req.body as { daysAhead?: number };
    const result = await serviceFor(req).generateUpcomingSessions(daysAhead);
    sendSuccess(res, result, `${result.created} session(s) generated.`);
  }
}

export const classSessionController = new ClassSessionController();
