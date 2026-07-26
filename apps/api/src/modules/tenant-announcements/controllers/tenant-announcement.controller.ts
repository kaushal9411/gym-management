import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import type { CreateTenantAnnouncementInput, ListAnnouncementsQuery, ScheduleAnnouncementInput, UpdateTenantAnnouncementInput } from '../dto/tenant-announcement.dto';
import { TenantAnnouncementService } from '../services/tenant-announcement.service';

function serviceFor(req: Request): TenantAnnouncementService {
  return new TenantAnnouncementService(req.tenant!.id);
}

export class TenantAnnouncementController {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).list(req.query as unknown as ListAnnouncementsQuery));
  }

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getById(req.params.id!));
  }

  async create(req: Request, res: Response): Promise<void> {
    const announcement = await serviceFor(req).create(req.body as CreateTenantAnnouncementInput, actorFrom(req));
    sendSuccess(res, announcement, 'Announcement created.', 201);
  }

  async update(req: Request, res: Response): Promise<void> {
    const announcement = await serviceFor(req).update(req.params.id!, req.body as UpdateTenantAnnouncementInput, actorFrom(req));
    sendSuccess(res, announcement, 'Announcement updated.');
  }

  async remove(req: Request, res: Response): Promise<void> {
    await serviceFor(req).delete(req.params.id!, actorFrom(req));
    sendSuccess(res, null, 'Announcement deleted.');
  }

  async publish(req: Request, res: Response): Promise<void> {
    const announcement = await serviceFor(req).publish(req.params.id!, actorFrom(req));
    sendSuccess(res, announcement, 'Announcement published.');
  }

  async schedule(req: Request, res: Response): Promise<void> {
    const announcement = await serviceFor(req).schedule(req.params.id!, req.body as ScheduleAnnouncementInput, actorFrom(req));
    sendSuccess(res, announcement, 'Announcement scheduled.');
  }
}

export const tenantAnnouncementController = new TenantAnnouncementController();
