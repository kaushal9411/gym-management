import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import type { LeaveTypeDto } from '../dto/hr.dto';
import { HrAttendanceService, type MarkInput } from '../services/hr-attendance.service';
import { HrConfigService } from '../services/hr-config.service';
import { HrEmployeeService } from '../services/hr-employee.service';
import { HrLeaveService, type LeaveInput } from '../services/hr-leave.service';
import { leaveYearBounds, leaveYearLabel } from '../utils/hr-dates.util';

const tenantId = (req: Request): string => req.tenant!.id;
const actorId = (req: Request): string => req.auth!.sub;

/** HR / manager endpoints (permission-gated in the routes). */
export class HrAdminController {
  // overview / employees
  async overview(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrEmployeeService(tenantId(req)).overview(actorId(req)));
  }
  async listEmployees(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrEmployeeService(tenantId(req)).list(req.query as never, actorId(req)));
  }
  async employeeDetail(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrEmployeeService(tenantId(req)).detail(req.params.userId!, (req.query as { month?: string }).month, actorId(req)));
  }
  async employeeAttendance(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrAttendanceService(tenantId(req)).employeeMonth(req.params.userId!, (req.query as { month?: string }).month, actorId(req)));
  }
  async setWorkSetup(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrEmployeeService(tenantId(req)).setWorkSetup(req.params.userId!, req.body as never, actorFrom(req)), 'Work setup updated.');
  }
  async getPayStructure(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrEmployeeService(tenantId(req)).getPayStructure(req.params.userId!, actorId(req)));
  }
  async setPayStructure(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrEmployeeService(tenantId(req)).setPayStructure(req.params.userId!, req.body as never, actorFrom(req)), 'Pay structure updated.');
  }

  // attendance
  async attendanceDay(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrAttendanceService(tenantId(req)).dayList(req.query as never, actorId(req)));
  }
  async attendanceMonthly(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrAttendanceService(tenantId(req)).monthlyGrid(req.query as never, actorId(req)));
  }
  async markAttendance(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrAttendanceService(tenantId(req)).mark(req.body as MarkInput, actorFrom(req)), 'Attendance saved.');
  }
  async bulkAttendance(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrAttendanceService(tenantId(req)).bulk(req.body as never, actorFrom(req)), 'Attendance saved.');
  }
  async clearAttendance(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrAttendanceService(tenantId(req)).clear(req.query as never, actorFrom(req)), 'Attendance cleared.');
  }

  // leaves
  async listLeaves(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrLeaveService(tenantId(req)).list(req.query as never, actorId(req)));
  }
  async leaveDetail(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrLeaveService(tenantId(req)).detail(req.params.id!, actorId(req)));
  }
  async previewLeave(req: Request, res: Response): Promise<void> {
    const body = req.body as LeaveInput & { userId: string };
    const service = new HrLeaveService(tenantId(req));
    const emp = await service.access.mustFindEmployee(body.userId, actorId(req));
    sendSuccess(res, await service.preview(emp, body, true));
  }
  async applyLeave(req: Request, res: Response): Promise<void> {
    const body = req.body as LeaveInput & { userId: string; reason: string; autoApprove: boolean; remark?: string };
    const service = new HrLeaveService(tenantId(req));
    const emp = await service.access.mustFindEmployee(body.userId, actorId(req));
    sendSuccess(res, await service.apply(emp, body, actorFrom(req), { onBehalf: true, autoApprove: body.autoApprove, remark: body.remark }), 'Leave request created.', 201);
  }
  async approveLeave(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrLeaveService(tenantId(req)).approve(req.params.id!, (req.body as { remark?: string }).remark, actorFrom(req)), 'Leave approved.');
  }
  async rejectLeave(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrLeaveService(tenantId(req)).reject(req.params.id!, (req.body as { remark: string }).remark, actorFrom(req)), 'Leave rejected.');
  }
  async cancelLeave(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrLeaveService(tenantId(req)).cancel(req.params.id!, (req.body as { remark: string }).remark, actorFrom(req), 'hr'), 'Leave cancelled.');
  }
  async leaveBalances(req: Request, res: Response): Promise<void> {
    const q = req.query as { userId?: string; leaveYear?: number };
    const service = new HrLeaveService(tenantId(req));
    const policy = await service.config.getPolicyRow();
    const year = q.leaveYear ?? (await service.currentLeaveYear(policy));
    const bounds = leaveYearBounds(year, policy.leaveYearStartMonth);
    const head = { leaveYear: year, leaveYearLabel: leaveYearLabel(year, policy.leaveYearStartMonth), periodStart: bounds.start, periodEnd: bounds.end };
    if (q.userId) {
      await service.access.mustFindEmployee(q.userId, actorId(req));
      sendSuccess(res, { userId: q.userId, ...head, balances: await service.balancesFor(q.userId, year) });
      return;
    }
    const scope = await service.access.scope(actorId(req));
    const { items } = await service.access.employees.list(tenantId(req), { restrictToBranchIds: scope });
    const [balances, refs] = await Promise.all([service.balancesForUsers(items.map((e) => e.id), year), service.access.employees.refsFor(tenantId(req), items.map((e) => e.id))]);
    sendSuccess(res, { ...head, employees: items.map((e) => ({ employee: refs.get(e.id), balances: balances.get(e.id) ?? [] })) });
  }
  async adjustBalance(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrLeaveService(tenantId(req)).adjustBalance(req.body as never, actorFrom(req)), 'Balance adjusted.');
  }

  // leave types / holidays / shifts / policy
  async listLeaveTypes(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrConfigService(tenantId(req)).listLeaveTypes((req.query as { includeInactive?: boolean }).includeInactive ?? false));
  }
  async createLeaveType(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrConfigService(tenantId(req)).createLeaveType(req.body as Omit<LeaveTypeDto, 'id' | 'isActive'>, actorFrom(req)), 'Leave type created.', 201);
  }
  async updateLeaveType(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrConfigService(tenantId(req)).updateLeaveType(req.params.id!, req.body as never, actorFrom(req)), 'Leave type updated.');
  }
  async deleteLeaveType(req: Request, res: Response): Promise<void> {
    await new HrConfigService(tenantId(req)).deleteLeaveType(req.params.id!, actorFrom(req));
    sendSuccess(res, null, 'Leave type deleted.');
  }
  async listHolidays(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrConfigService(tenantId(req)).listHolidays(req.query as never));
  }
  async createHoliday(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrConfigService(tenantId(req)).createHoliday(req.body as never, actorFrom(req)), 'Holiday created.', 201);
  }
  async updateHoliday(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrConfigService(tenantId(req)).updateHoliday(req.params.id!, req.body as never, actorFrom(req)), 'Holiday updated.');
  }
  async deleteHoliday(req: Request, res: Response): Promise<void> {
    await new HrConfigService(tenantId(req)).deleteHoliday(req.params.id!, actorFrom(req));
    sendSuccess(res, null, 'Holiday deleted.');
  }
  async listShifts(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrConfigService(tenantId(req)).listShifts());
  }
  async createShift(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrConfigService(tenantId(req)).createShift(req.body as never, actorFrom(req)), 'Shift created.', 201);
  }
  async updateShift(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrConfigService(tenantId(req)).updateShift(req.params.id!, req.body as never, actorFrom(req)), 'Shift updated.');
  }
  async deleteShift(req: Request, res: Response): Promise<void> {
    await new HrConfigService(tenantId(req)).deleteShift(req.params.id!, actorFrom(req));
    sendSuccess(res, null, 'Shift deleted.');
  }
  async getPolicy(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrConfigService(tenantId(req)).getPolicy());
  }
  async updatePolicy(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await new HrConfigService(tenantId(req)).updatePolicy(req.body as never, actorFrom(req)), 'Policy updated.');
  }
}

export const hrAdminController = new HrAdminController();
