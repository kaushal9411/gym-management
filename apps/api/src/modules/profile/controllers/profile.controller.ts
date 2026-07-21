import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import { ProfileService, type UpdateProfileInput } from '../services/profile.service';

export class ProfileController {
  async get(req: Request, res: Response): Promise<void> {
    const service = new ProfileService(req.tenant!.id);
    sendSuccess(res, await service.get(req.auth!.sub));
  }

  async update(req: Request, res: Response): Promise<void> {
    const service = new ProfileService(req.tenant!.id);
    const profile = await service.update(req.auth!.sub, req.body as UpdateProfileInput, actorFrom(req));
    sendSuccess(res, profile, 'Profile updated.');
  }
}

export const profileController = new ProfileController();
