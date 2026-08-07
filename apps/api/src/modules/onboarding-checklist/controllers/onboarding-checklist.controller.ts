import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { OnboardingChecklistService } from '../services/onboarding-checklist.service';

function serviceFor(req: Request): OnboardingChecklistService {
  return new OnboardingChecklistService(req.tenant!.id);
}

export class OnboardingChecklistController {
  async getStatus(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getStatus());
  }

  async dismiss(req: Request, res: Response): Promise<void> {
    await serviceFor(req).dismiss();
    sendSuccess(res, null, 'Checklist dismissed.');
  }
}

export const onboardingChecklistController = new OnboardingChecklistController();
