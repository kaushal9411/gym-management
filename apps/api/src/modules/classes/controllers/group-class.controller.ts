import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import type { CreateGroupClassInput, ListGroupClassesQuery, UpdateGroupClassInput } from '../dto/classes.dto';
import { GroupClassService } from '../services/group-class.service';

function serviceFor(req: Request): GroupClassService {
  return new GroupClassService(req.tenant!.id);
}

export class GroupClassController {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).list(req.query as unknown as ListGroupClassesQuery));
  }

  async listActive(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).listActive());
  }

  async getById(req: Request<{ id: string }>, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getById(req.params.id));
  }

  async create(req: Request, res: Response): Promise<void> {
    const result = await serviceFor(req).create(req.body as CreateGroupClassInput, actorFrom(req));
    sendSuccess(res, result, 'Class created.', 201);
  }

  async update(req: Request<{ id: string }>, res: Response): Promise<void> {
    const result = await serviceFor(req).update(req.params.id, req.body as UpdateGroupClassInput, actorFrom(req));
    sendSuccess(res, result, 'Class updated.');
  }

  async setSchedule(req: Request<{ id: string }>, res: Response): Promise<void> {
    const { slots } = req.body as { slots: { dayOfWeek: string; startTime: string }[] };
    const result = await serviceFor(req).setSchedule(req.params.id, slots as never, actorFrom(req));
    sendSuccess(res, result, 'Weekly schedule updated.');
  }

  async softDelete(req: Request<{ id: string }>, res: Response): Promise<void> {
    await serviceFor(req).softDelete(req.params.id, actorFrom(req));
    sendSuccess(res, null, 'Class deleted.');
  }

  async restore(req: Request<{ id: string }>, res: Response): Promise<void> {
    await serviceFor(req).restore(req.params.id, actorFrom(req));
    sendSuccess(res, null, 'Class restored.');
  }
}

export const groupClassController = new GroupClassController();
