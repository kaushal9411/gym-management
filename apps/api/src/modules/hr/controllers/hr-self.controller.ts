import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import { HrAttendanceService } from '../services/hr-attendance.service';
import { HrLeaveService, type LeaveInput } from '../services/hr-leave.service';
import { HrNotificationService } from '../services/hr-notification.service';
import { HrPayrollService } from '../services/hr-payroll.service';
import { HrSelfService } from '../services/hr-self.service';
import { currentMonth } from '../utils/hr-dates.util';
import { renderPayslipPdf } from '../utils/payslip-pdf.renderer';

const tenantId = (req: Request): string => req.tenant!.id;
/** `/hr/me/*` is ALWAYS the caller — never a client-supplied user id. */
const me = (req: Request): string => req.auth!.sub;

export class HrSelfController {
  async summary(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrSelfService(tenantId(req)).summary(me(req)));
  }

  async checkIn(req: Request, res: Response): Promise<void> {
    const { note } = req.body as { note?: string };
    sendSuccess(res, await new HrAttendanceService(tenantId(req)).checkIn(me(req), note, actorFrom(req)), 'Checked in.', 201);
  }

  async checkOut(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrAttendanceService(tenantId(req)).checkOut(me(req), actorFrom(req)), 'Checked out.');
  }

  async attendance(req: Request, res: Response): Promise<void> {
    const { month } = req.query as { month?: string };
    sendSuccess(res, await new HrAttendanceService(tenantId(req)).selfMonth(me(req), month ?? currentMonth()));
  }

  async leaveTypes(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrSelfService(tenantId(req)).leaveTypes(me(req)));
  }

  async leaveBalances(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrSelfService(tenantId(req)).leaveBalances(me(req), (req.query as { leaveYear?: number }).leaveYear));
  }

  async holidays(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrSelfService(tenantId(req)).holidays(me(req), (req.query as { year?: number }).year));
  }

  async previewLeave(req: Request, res: Response): Promise<void> {
    const service = new HrLeaveService(tenantId(req));
    const emp = await service.access.requireSelf(me(req));
    sendSuccess(res, await service.preview(emp, req.body as LeaveInput, false));
  }

  async listLeaves(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrLeaveService(tenantId(req)).listMine(me(req), req.query as never));
  }

  async getLeave(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrLeaveService(tenantId(req)).getMine(me(req), req.params.id!));
  }

  async applyLeave(req: Request, res: Response): Promise<void> {
    const service = new HrLeaveService(tenantId(req));
    const emp = await service.access.requireSelf(me(req));
    sendSuccess(res, await service.apply(emp, req.body as LeaveInput & { reason: string }, actorFrom(req), { onBehalf: false }), 'Leave request submitted.', 201);
  }

  async cancelLeave(req: Request, res: Response): Promise<void> {
    const { remark } = req.body as { remark?: string };
    const service = new HrLeaveService(tenantId(req));
    await service.access.requireSelf(me(req));
    sendSuccess(res, await service.cancel(req.params.id!, remark, actorFrom(req), 'self'), 'Leave request cancelled.');
  }

  async listPayslips(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrPayrollService(tenantId(req)).listMine(me(req), req.query as never));
  }

  async getPayslip(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrPayrollService(tenantId(req)).getMine(me(req), req.params.id!));
  }

  async payslipPdf(req: Request, res: Response): Promise<void> {
    const payslip = await new HrPayrollService(tenantId(req)).getMine(me(req), req.params.id!);
    const buffer = await renderPayslipPdf(payslip, req.tenant!.name);
    res.status(200).setHeader('Content-Type', 'application/pdf').setHeader('Content-Disposition', `inline; filename="payslip-${payslip.month}.pdf"`).send(buffer);
  }

  async notifications(req: Request, res: Response): Promise<void> {
    const service = new HrNotificationService(tenantId(req));
    await new HrAttendanceService(tenantId(req)).access.requireSelf(me(req));
    sendSuccess(res, await service.list(me(req), req.query as never));
  }

  async markNotificationRead(req: Request, res: Response): Promise<void> {
    await new HrNotificationService(tenantId(req)).markRead(me(req), req.params.id!);
    sendSuccess(res, null, 'Marked as read.');
  }

  async markAllNotificationsRead(req: Request, res: Response): Promise<void> {
    await new HrNotificationService(tenantId(req)).markAllRead(me(req));
    sendSuccess(res, null, 'All marked as read.');
  }
}

export const hrSelfController = new HrSelfController();
