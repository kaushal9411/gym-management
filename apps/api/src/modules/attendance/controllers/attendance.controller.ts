import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import type {
  CheckInInput,
  CheckOutInput,
  ListAttendanceQuery,
  UpdateAttendanceInput,
  ValidateQrCodeInput,
} from '../dto/attendance.dto';
import { AttendanceService } from '../services/attendance.service';

function serviceFor(req: Request): AttendanceService {
  return new AttendanceService(req.tenant!.id);
}

export class AttendanceController {
  async checkIn(req: Request, res: Response): Promise<void> {
    const record = await serviceFor(req).checkIn(req.body as CheckInInput, actorFrom(req));
    sendSuccess(res, record, 'Checked in.', 201);
  }

  async checkOut(req: Request, res: Response): Promise<void> {
    const record = await serviceFor(req).checkOut(req.body as CheckOutInput, actorFrom(req));
    sendSuccess(res, record, 'Checked out.');
  }

  async manualCheckIn(req: Request, res: Response): Promise<void> {
    const record = await serviceFor(req).manualCheckIn(req.body as CheckInInput, actorFrom(req));
    sendSuccess(res, record, 'Checked in.', 201);
  }

  async manualCheckOut(req: Request, res: Response): Promise<void> {
    const record = await serviceFor(req).manualCheckOut(req.body as CheckOutInput, actorFrom(req));
    sendSuccess(res, record, 'Checked out.');
  }

  async validateQrCode(req: Request, res: Response): Promise<void> {
    const result = await serviceFor(req).validateQrCode(req.body as ValidateQrCodeInput);
    sendSuccess(res, result);
  }

  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).list(req.query as unknown as ListAttendanceQuery));
  }

  async getToday(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getToday(req.query.branchId as string | undefined));
  }

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getById(req.params.id!));
  }

  async getMemberAttendance(req: Request, res: Response): Promise<void> {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    sendSuccess(res, await serviceFor(req).getMemberAttendance(req.params.memberId!, { page, limit }));
  }

  async getBranchAttendance(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getBranchAttendance(req.params.branchId!, req.query as unknown as ListAttendanceQuery));
  }

  async getSummary(req: Request, res: Response): Promise<void> {
    const { branchId, dateFrom, dateTo } = req.query as { branchId?: string; dateFrom?: string; dateTo?: string };
    sendSuccess(res, await serviceFor(req).getSummary({ branchId, dateFrom, dateTo }));
  }

  async update(req: Request, res: Response): Promise<void> {
    const record = await serviceFor(req).update(req.params.id!, req.body as UpdateAttendanceInput, actorFrom(req));
    sendSuccess(res, record, 'Attendance record updated.');
  }

  async softDelete(req: Request, res: Response): Promise<void> {
    await serviceFor(req).softDelete(req.params.id!, actorFrom(req));
    sendSuccess(res, null, 'Attendance record deleted.');
  }

  async exportCsv(req: Request, res: Response): Promise<void> {
    const csv = await serviceFor(req).exportCsv(req.query as unknown as Partial<ListAttendanceQuery>);
    res
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="attendance-export-${new Date().toISOString().slice(0, 10)}.csv"`)
      .send(csv);
  }

  async exportExcel(req: Request, res: Response): Promise<void> {
    const buffer = await serviceFor(req).exportExcel(req.query as unknown as Partial<ListAttendanceQuery>);
    res
      .status(200)
      .setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .setHeader('Content-Disposition', `attachment; filename="attendance-export-${new Date().toISOString().slice(0, 10)}.xlsx"`)
      .send(Buffer.from(buffer));
  }
}

export const attendanceController = new AttendanceController();
