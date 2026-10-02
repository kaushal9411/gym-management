import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import type { CreateAttendanceDeviceInput, ListAttendanceDevicesQuery, UpdateAttendanceDeviceInput } from '../dto/attendance-device.dto';
import { AttendanceDeviceService } from '../services/attendance-device.service';

function serviceFor(req: Request): AttendanceDeviceService {
  return new AttendanceDeviceService(req.tenant!.id);
}

export class AttendanceDeviceController {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).list(req.query as unknown as ListAttendanceDevicesQuery));
  }

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getById(req.params.deviceId!));
  }

  async create(req: Request, res: Response): Promise<void> {
    const device = await serviceFor(req).create(req.body as CreateAttendanceDeviceInput, actorFrom(req));
    sendSuccess(res, device, 'Device registered. Copy the API key now — it will not be shown again.', 201);
  }

  async update(req: Request, res: Response): Promise<void> {
    const device = await serviceFor(req).update(req.params.deviceId!, req.body as UpdateAttendanceDeviceInput, actorFrom(req));
    sendSuccess(res, device, 'Device updated.');
  }

  async regenerateKey(req: Request, res: Response): Promise<void> {
    const device = await serviceFor(req).regenerateKey(req.params.deviceId!, actorFrom(req));
    sendSuccess(res, device, 'Key regenerated. Copy it now — it will not be shown again.');
  }

  async softDelete(req: Request, res: Response): Promise<void> {
    await serviceFor(req).softDelete(req.params.deviceId!, actorFrom(req));
    sendSuccess(res, null, 'Device removed.');
  }
}

export const attendanceDeviceController = new AttendanceDeviceController();
