import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { crossGymAccessService } from '../services/cross-gym-access.service';
import type { Actor } from '../validators/gym-discovery.validators';

const GENERIC_RESET = 'If an account exists, a password reset link has been sent.';
const GENERIC_CODE = 'If an account exists, a code has been sent.';

export class CrossGymAccessController {
  async forgotPassword(req: Request, res: Response): Promise<void> {
    await crossGymAccessService.forgotPassword((req.body as { identifier: string }).identifier);
    sendSuccess(res, null, GENERIC_RESET);
  }

  async requestPhoneOtp(req: Request, res: Response): Promise<void> {
    const { phone, actorType } = req.body as { phone: string; actorType: Actor };
    await crossGymAccessService.requestPhoneOtp(phone, actorType);
    sendSuccess(res, null, GENERIC_CODE);
  }

  async verifyPhoneOtp(req: Request, res: Response): Promise<void> {
    const { phone, actorType, code } = req.body as { phone: string; actorType: Actor; code: string };
    const result = await crossGymAccessService.verifyPhoneOtp(phone, actorType, code, { ipAddress: req.ip, userAgent: req.headers['user-agent'] });
    sendSuccess(res, result, 'challenge' in result ? 'Verification code required' : 'Login successful');
  }
}

export const crossGymAccessController = new CrossGymAccessController();
