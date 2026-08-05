import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import { buildAuthModule } from '../../authentication/utils/auth-module.factory';
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

  // ── Two-factor authentication (self-service) ──────────────────────────

  async beginTwoFactorSetup(req: Request, res: Response): Promise<void> {
    const authService = buildAuthModule(req.tenant!.id);
    sendSuccess(res, await authService.beginTwoFactorSetup(req.auth!.sub));
  }

  async confirmTwoFactorSetup(req: Request<unknown, unknown, { code: string }>, res: Response): Promise<void> {
    const authService = buildAuthModule(req.tenant!.id);
    const result = await authService.confirmTwoFactorSetup(req.auth!.sub, req.body.code);
    sendSuccess(res, result, 'Two-factor authentication enabled. Save your backup codes somewhere safe — they will not be shown again.');
  }

  async disableTwoFactor(req: Request<unknown, unknown, { password: string }>, res: Response): Promise<void> {
    const authService = buildAuthModule(req.tenant!.id);
    await authService.disableTwoFactor(req.auth!.sub, req.body.password);
    sendSuccess(res, null, 'Two-factor authentication disabled.');
  }

  async regenerateBackupCodes(req: Request<unknown, unknown, { code: string }>, res: Response): Promise<void> {
    const authService = buildAuthModule(req.tenant!.id);
    const result = await authService.regenerateBackupCodes(req.auth!.sub, req.body.code);
    sendSuccess(res, result, 'New backup codes generated — your old codes no longer work.');
  }
}

export const profileController = new ProfileController();
