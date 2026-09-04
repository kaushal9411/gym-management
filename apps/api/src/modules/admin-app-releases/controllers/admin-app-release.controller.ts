import type { Request, Response } from 'express';

import { ValidationError } from '../../../core/errors/app-error';
import { sendSuccess } from '../../../core/http/response';
import type { CreateAppReleaseInput } from '../dto/app-release.dto';
import { adminAppReleaseService } from '../services/admin-app-release.service';

export class AdminAppReleaseController {
  async list(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminAppReleaseService.list());
  }

  async create(req: Request, res: Response): Promise<void> {
    if (!req.file) throw new ValidationError('An .apk file is required.');
    const release = await adminAppReleaseService.create(
      req.file,
      req.body as CreateAppReleaseInput,
      req.admin!.sub,
      req.admin!.role,
    );
    sendSuccess(res, release, 'Release uploaded.', 201);
  }

  async activate(req: Request, res: Response): Promise<void> {
    const release = await adminAppReleaseService.activate(req.params.id!, req.admin!.sub, req.admin!.role);
    sendSuccess(res, release, 'Release activated.');
  }

  async remove(req: Request, res: Response): Promise<void> {
    await adminAppReleaseService.delete(req.params.id!, req.admin!.sub, req.admin!.role);
    sendSuccess(res, null, 'Release deleted.');
  }
}

export const adminAppReleaseController = new AdminAppReleaseController();
