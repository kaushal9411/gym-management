import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { MemberGdprService } from '../../members/services/member-gdpr.service';
import { MemberPortalService } from '../services/member-portal.service';

function serviceFor(req: Request): MemberPortalService {
  return new MemberPortalService(req.tenant!.id);
}

function memberId(req: Request): string {
  return req.memberAuth!.sub;
}

export class MemberPortalController {
  async me(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getProfile(memberId(req)));
  }

  async attendance(req: Request, res: Response): Promise<void> {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    sendSuccess(res, await serviceFor(req).getAttendance(memberId(req), { page, limit }));
  }

  async workout(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getWorkout(memberId(req)));
  }

  async markWorkoutProgress(req: Request<{ id: string }>, res: Response): Promise<void> {
    const result = await serviceFor(req).markWorkoutProgress(memberId(req), req.params.id, req.body);
    sendSuccess(res, result, 'Progress updated.');
  }

  async diet(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getDiet(memberId(req)));
  }

  async logDiet(req: Request<{ id: string }>, res: Response): Promise<void> {
    const result = await serviceFor(req).logDiet(memberId(req), req.params.id, req.body);
    sendSuccess(res, result, 'Diet log updated.');
  }

  async invoices(req: Request, res: Response): Promise<void> {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    sendSuccess(res, await serviceFor(req).getInvoices(memberId(req), { page, limit }));
  }

  async downloadInvoice(req: Request<{ id: string }>, res: Response): Promise<void> {
    const { filename, content } = await serviceFor(req).downloadInvoicePdf(memberId(req), req.params.id);
    res.status(200).setHeader('Content-Type', 'application/pdf').setHeader('Content-Disposition', `attachment; filename="${filename}"`).send(content);
  }

  async classes(req: Request, res: Response): Promise<void> {
    const { dateFrom, dateTo } = req.query as { dateFrom: string; dateTo: string };
    sendSuccess(res, await serviceFor(req).getUpcomingClasses(memberId(req), dateFrom, dateTo));
  }

  async bookClass(req: Request<{ id: string }>, res: Response): Promise<void> {
    const result = await serviceFor(req).bookClass(memberId(req), req.params.id);
    sendSuccess(res, result, 'Booked.', 201);
  }

  async cancelBooking(req: Request<{ id: string }>, res: Response): Promise<void> {
    await serviceFor(req).cancelBooking(memberId(req), req.params.id);
    sendSuccess(res, null, 'Booking cancelled.');
  }

  async myBookings(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getMyBookings(memberId(req)));
  }

  /** Self-service GDPR data-portability export — same underlying bundle the staff-side `GET /members/:id/gdpr-export` returns, just scoped to the caller's own id. */
  async gdprExport(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new MemberGdprService(req.tenant!.id).exportData(memberId(req)));
  }
}

export const memberPortalController = new MemberPortalController();
