import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import type { DevicePunchInput } from '../dto/attendance-device.dto';
import { DevicePunchService } from '../services/device-punch.service';

export class DevicePunchController {
  async punch(req: Request, res: Response): Promise<void> {
    const record = await new DevicePunchService(req.tenant!.id).recordPunch(req.attendanceDevice!, req.body as DevicePunchInput);
    sendSuccess(res, record, 'Punch recorded.', 201);
  }
}

export const devicePunchController = new DevicePunchController();
