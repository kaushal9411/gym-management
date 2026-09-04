import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import type { CreateBodyMeasurementInput, UpdateBodyMeasurementInput } from '../dto/measurement.dto';
import { MeasurementService } from '../services/measurement.service';

function serviceFor(req: Request): MeasurementService {
  return new MeasurementService(req.tenant!.id);
}

export class MeasurementController {
  async listMembers(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).listMembersWithMeasurements());
  }

  async listForMember(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).listForMember(req.params.memberId!));
  }

  async create(req: Request, res: Response): Promise<void> {
    const entry = await serviceFor(req).create(req.params.memberId!, req.body as CreateBodyMeasurementInput, actorFrom(req));
    sendSuccess(res, entry, 'Measurement recorded.', 201);
  }

  async update(req: Request, res: Response): Promise<void> {
    const entry = await serviceFor(req).update(req.params.id!, req.body as UpdateBodyMeasurementInput, actorFrom(req));
    sendSuccess(res, entry, 'Measurement updated.');
  }

  async remove(req: Request, res: Response): Promise<void> {
    await serviceFor(req).delete(req.params.id!, actorFrom(req));
    sendSuccess(res, null, 'Measurement deleted.');
  }
}

export const measurementController = new MeasurementController();
