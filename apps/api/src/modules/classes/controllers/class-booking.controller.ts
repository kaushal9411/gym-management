import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { ClassBookingService } from '../services/class-booking.service';

function serviceFor(req: Request): ClassBookingService {
  return new ClassBookingService(req.tenant!.id);
}

function staffBooker(req: Request) {
  return { role: 'STAFF' as const, userId: req.auth!.sub, ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

export class ClassBookingController {
  async create(req: Request, res: Response): Promise<void> {
    const { sessionId, memberId } = req.body as { sessionId: string; memberId: string };
    const result = await serviceFor(req).book(sessionId, memberId, staffBooker(req));
    sendSuccess(res, result, 'Member booked into the session.', 201);
  }

  async cancel(req: Request<{ id: string }>, res: Response): Promise<void> {
    await serviceFor(req).cancel(req.params.id, undefined, staffBooker(req));
    sendSuccess(res, null, 'Booking cancelled.');
  }
}

export const classBookingController = new ClassBookingController();
