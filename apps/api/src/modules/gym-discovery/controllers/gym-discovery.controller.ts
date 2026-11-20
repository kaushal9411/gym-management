import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { gymDiscoveryService } from '../services/gym-discovery.service';
import type { DiscoverGymsInput } from '../validators/gym-discovery.validators';

export class GymDiscoveryController {
  async discover(req: Request, res: Response): Promise<void> {
    const gyms = await gymDiscoveryService.discover(req.body as DiscoverGymsInput);
    sendSuccess(res, { gyms });
  }
}

export const gymDiscoveryController = new GymDiscoveryController();
