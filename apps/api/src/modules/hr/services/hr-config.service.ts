import type { Prisma } from '@prisma/client';

import { ConflictError, NotFoundError, ValidationError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { businessDate } from '../../../core/utils/business-time';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { assertBranchAccess } from '../../authentication/middlewares/branch-access.middleware';
import type { IamActor } from '../../authentication/utils/actor.util';
import type { HolidayDto, LeaveTypeDto, PolicyDto, ShiftDto } from '../dto/hr.dto';
import { HrConfigRepository, type HolidayRow, type LeaveTypeRow, type PolicyRow, type ShiftRow } from '../repositories/hr-config.repository';
import { HrEmployeeRepository } from '../repositories/hr-employee.repository';
import { fromDateCol, parseHm, parseWeekdayList, serializeWeekdayList, toDateCol } from '../utils/hr-dates.util';

import { HrAudit } from './hr-audit.service';

export const toPolicyDto = (p: PolicyRow): PolicyDto => ({
  leaveYearStartMonth: p.leaveYearStartMonth,
  defaultWeeklyOff: parseWeekdayList(p.defaultWeeklyOff),
  lateGraceMinutes: p.lateGraceMinutes,
  halfDayThresholdHours: Number(p.halfDayThresholdHours),
  standardDayHours: Number(p.standardDayHours),
  latePenaltyEnabled: p.latePenaltyEnabled,
  latePenaltyLatesPerUnit: p.latePenaltyLatesPerUnit,
  latePenaltyDays: Number(p.latePenaltyDays),
  overtimeEnabled: p.overtimeEnabled,
  overtimeMultiplier: Number(p.overtimeMultiplier),
  backdateLeaveDays: p.backdateLeaveDays,
  workingDaysBasis: 'CALENDAR_MINUS_WEEKLY_OFFS',
});

export const toLeaveTypeDto = (t: LeaveTypeRow): LeaveTypeDto => ({
  id: t.id,
  name: t.name,
  code: t.code,
  color: t.color,
  isPaid: t.isPaid,
  yearlyQuota: t.yearlyQuota === null ? null : Number(t.yearlyQuota),
  carryForward: t.carryForward,
  carryForwardMax: t.carryForwardMax === null ? null : Number(t.carryForwardMax),
  isActive: t.isActive,
  sortOrder: t.sortOrder,
});

export const toShiftDto = (s: ShiftRow, employeeCount = 0): ShiftDto => ({
  id: s.id,
  name: s.name,
  startTime: s.startTime,
  endTime: s.endTime,
  graceMinutes: s.graceMinutes,
  weeklyOffDays: parseWeekdayList(s.weeklyOffDays),
  isDefault: s.isDefault,
  isActive: s.isActive,
  employeeCount,
});

export const toHolidayDto = (h: HolidayRow): HolidayDto => ({
  id: h.id,
  date: fromDateCol(h.date),
  name: h.name,
  description: h.description,
  branch: h.branch ? { id: h.branch.id, name: h.branch.name } : null,
});

/**
 * Policy / leave types / shifts / holidays. `ensureDefaults` is idempotent and
 * is the single place the per-tenant HR defaults are created — called from
 * tenant provisioning and lazily (first HR read) for tenants created some
 * other way.
 */
export class HrConfigService {
  readonly repo: HrConfigRepository;
  private readonly employees: HrEmployeeRepository;
  private readonly audit: HrAudit;
  private policyCache: PolicyRow | null = null;

  constructor(private readonly tenantId: string) {
    const db = getTenantScopedClient(tenantId);
    this.repo = new HrConfigRepository(db);
    this.employees = new HrEmployeeRepository(db);
    this.audit = new HrAudit(tenantId, db);
  }

  /** Create the policy row + default leave types + default shift when the tenant has none. */
  async ensureDefaults(): Promise<PolicyRow> {
    if (this.policyCache) return this.policyCache;
    let policy = await this.repo.findPolicy(this.tenantId);
    if (!policy) {
      try {
        policy = await this.repo.createPolicy(this.tenantId);
      } catch {
        policy = await this.repo.findPolicy(this.tenantId); // concurrent first request created it
      }
      await this.repo.ensureDefaultLeaveTypes(this.tenantId);
      await this.repo.ensureDefaultShift(this.tenantId);
    }
    this.policyCache = policy!;
    return policy!;
  }

  async getPolicy(): Promise<PolicyDto> {
    return toPolicyDto(await this.ensureDefaults());
  }

  async getPolicyRow(): Promise<PolicyRow> {
    return this.ensureDefaults();
  }

  async updatePolicy(input: Partial<Omit<PolicyDto, 'workingDaysBasis'>>, actor: IamActor): Promise<PolicyDto> {
    const before = await this.ensureDefaults();
    if (input.leaveYearStartMonth !== undefined && input.leaveYearStartMonth !== before.leaveYearStartMonth) {
      const anyRequest = await getTenantScopedClient(this.tenantId).hrLeaveRequest.count({ where: { tenantId: this.tenantId } });
      if (anyRequest > 0) throw new ConflictError(ErrorCode.INVALID_STATE, 'The leave year start month cannot be changed once leave requests exist.');
    }
    const data: Prisma.HrPolicyUncheckedUpdateInput = {};
    const { defaultWeeklyOff, ...rest } = input;
    Object.assign(data, rest);
    if (defaultWeeklyOff) data.defaultWeeklyOff = serializeWeekdayList(defaultWeeklyOff);
    const updated = await this.repo.updatePolicy(this.tenantId, data);
    this.policyCache = updated;
    await this.audit.record(actor, 'hr.policy_updated', 'hr_policy', updated.id, { before: toPolicyDto(before), after: toPolicyDto(updated) });
    return toPolicyDto(updated);
  }

  // ── leave types ─────────────────────────────────────────────────────────
  async listLeaveTypes(includeInactive: boolean): Promise<LeaveTypeDto[]> {
    await this.ensureDefaults();
    return (await this.repo.listLeaveTypes(this.tenantId, includeInactive)).map(toLeaveTypeDto);
  }

  async createLeaveType(input: Omit<LeaveTypeDto, 'id' | 'isActive'>, actor: IamActor): Promise<LeaveTypeDto> {
    await this.ensureDefaults();
    if (await this.repo.findLeaveTypeByCode(this.tenantId, input.code)) throw new ConflictError(ErrorCode.CONFLICT, `A leave type with code ${input.code} already exists.`);
    this.assertCarryForward(input.carryForward, input.carryForwardMax);
    const created = await this.repo.createLeaveType({ tenantId: this.tenantId, ...input });
    await this.audit.record(actor, 'hr.leave_type_created', 'hr_leave_type', created.id, { after: toLeaveTypeDto(created) });
    return toLeaveTypeDto(created);
  }

  async updateLeaveType(id: string, input: Partial<Omit<LeaveTypeDto, 'id'>>, actor: IamActor): Promise<LeaveTypeDto> {
    const before = await this.mustFindLeaveType(id);
    if (input.code && input.code !== before.code && (await this.repo.findLeaveTypeByCode(this.tenantId, input.code))) {
      throw new ConflictError(ErrorCode.CONFLICT, `A leave type with code ${input.code} already exists.`);
    }
    this.assertCarryForward(input.carryForward ?? before.carryForward, input.carryForwardMax === undefined ? (before.carryForwardMax === null ? null : Number(before.carryForwardMax)) : input.carryForwardMax);
    const updated = await this.repo.updateLeaveType(id, input);
    await this.audit.record(actor, 'hr.leave_type_updated', 'hr_leave_type', id, { before: toLeaveTypeDto(before), after: toLeaveTypeDto(updated) });
    return toLeaveTypeDto(updated);
  }

  async deleteLeaveType(id: string, actor: IamActor): Promise<void> {
    const before = await this.mustFindLeaveType(id);
    if (await this.repo.leaveTypeInUse(this.tenantId, id)) {
      throw new ConflictError(ErrorCode.INVALID_STATE, 'This leave type is already used by leave requests or balances. Deactivate it instead of deleting.');
    }
    await this.repo.deleteLeaveType(id);
    await this.audit.record(actor, 'hr.leave_type_deleted', 'hr_leave_type', id, { before: toLeaveTypeDto(before) });
  }

  async mustFindLeaveType(id: string): Promise<LeaveTypeRow> {
    const t = await this.repo.findLeaveType(this.tenantId, id);
    if (!t) throw new NotFoundError('Leave type not found.');
    return t;
  }

  private assertCarryForward(carryForward: boolean, max: number | null): void {
    if (!carryForward && max !== null) throw new ValidationError('Validation failed', { fields: [{ field: 'carryForwardMax', message: 'carryForwardMax requires carryForward to be true.' }] });
  }

  // ── shifts ──────────────────────────────────────────────────────────────
  async listShifts(): Promise<ShiftDto[]> {
    await this.ensureDefaults();
    const [shifts, counts] = await Promise.all([this.repo.listShifts(this.tenantId), this.employees.countByShift(this.tenantId)]);
    return shifts.map((s) => toShiftDto(s, counts.get(s.id) ?? 0));
  }

  async createShift(input: { name: string; startTime: string; endTime: string; graceMinutes: number; weeklyOffDays: string[]; isDefault: boolean }, actor: IamActor): Promise<ShiftDto> {
    await this.ensureDefaults();
    this.assertShiftTimes(input.startTime, input.endTime);
    if (await this.repo.findShiftByName(this.tenantId, input.name)) throw new ConflictError(ErrorCode.CONFLICT, `A shift named "${input.name}" already exists.`);
    if (input.isDefault) await this.repo.clearDefaultShift(this.tenantId);
    const created = await this.repo.createShift({ tenantId: this.tenantId, ...input, weeklyOffDays: serializeWeekdayList(input.weeklyOffDays) });
    await this.audit.record(actor, 'hr.shift_created', 'hr_shift', created.id, { after: toShiftDto(created) });
    return toShiftDto(created);
  }

  async updateShift(id: string, input: Partial<{ name: string; startTime: string; endTime: string; graceMinutes: number; weeklyOffDays: string[]; isDefault: boolean; isActive: boolean }>, actor: IamActor): Promise<ShiftDto> {
    const before = await this.mustFindShift(id);
    this.assertShiftTimes(input.startTime ?? before.startTime, input.endTime ?? before.endTime);
    if (input.name && input.name.toLowerCase() !== before.name.toLowerCase() && (await this.repo.findShiftByName(this.tenantId, input.name))) {
      throw new ConflictError(ErrorCode.CONFLICT, `A shift named "${input.name}" already exists.`);
    }
    if (input.isDefault === false && before.isDefault) throw new ConflictError(ErrorCode.INVALID_STATE, 'Make another shift the default instead of un-defaulting this one.');
    if (input.isActive === false && before.isDefault) throw new ConflictError(ErrorCode.INVALID_STATE, 'The default shift cannot be deactivated.');
    if (input.isDefault) await this.repo.clearDefaultShift(this.tenantId, id);
    const { weeklyOffDays, ...rest } = input;
    const updated = await this.repo.updateShift(id, { ...rest, ...(weeklyOffDays ? { weeklyOffDays: serializeWeekdayList(weeklyOffDays) } : {}) });
    if (input.name && input.name !== before.name) {
      // keep the legacy StaffProfile.shift text in sync with the shift name
      await getTenantScopedClient(this.tenantId).staffProfile.updateMany({ where: { tenantId: this.tenantId, shiftId: id }, data: { shift: updated.name } });
    }
    await this.audit.record(actor, 'hr.shift_updated', 'hr_shift', id, { before: toShiftDto(before), after: toShiftDto(updated) });
    return toShiftDto(updated);
  }

  async deleteShift(id: string, actor: IamActor): Promise<void> {
    const before = await this.mustFindShift(id);
    if (before.isDefault) throw new ConflictError(ErrorCode.INVALID_STATE, 'The default shift cannot be deleted.');
    if ((await this.repo.countStaffOnShift(this.tenantId, id)) > 0) throw new ConflictError(ErrorCode.INVALID_STATE, 'Employees are assigned to this shift. Reassign them first.');
    await this.repo.deleteShift(id);
    await this.audit.record(actor, 'hr.shift_deleted', 'hr_shift', id, { before: toShiftDto(before) });
  }

  async mustFindShift(id: string): Promise<ShiftRow> {
    const s = await this.repo.findShift(this.tenantId, id);
    if (!s) throw new NotFoundError('Shift not found.');
    return s;
  }

  private assertShiftTimes(start: string, end: string): void {
    if (parseHm(end) <= parseHm(start)) {
      throw new ValidationError('Validation failed', { fields: [{ field: 'endTime', message: 'End time must be after the start time (overnight shifts are not supported).' }] });
    }
  }

  // ── holidays ────────────────────────────────────────────────────────────
  async listHolidays(q: { year?: number; from?: string; to?: string; branchId?: string }): Promise<HolidayDto[]> {
    const year = q.year ?? Number(businessDate().slice(0, 4));
    const from = q.from ?? `${year}-01-01`;
    const to = q.to ?? `${year}-12-31`;
    return (await this.repo.listHolidays(this.tenantId, from, to, q.branchId)).map(toHolidayDto);
  }

  async createHoliday(input: { date: string; name: string; description?: string; branchId?: string | null }, actor: IamActor): Promise<HolidayDto> {
    const branchId = input.branchId ?? null;
    if (branchId) await assertBranchAccess(this.tenantId, actor.userId, branchId);
    if (await this.repo.findHolidayAt(this.tenantId, input.date, branchId)) throw new ConflictError(ErrorCode.CONFLICT, 'A holiday already exists on this date.');
    const created = await this.repo.createHoliday({ tenantId: this.tenantId, date: toDateCol(input.date), name: input.name, description: input.description, branchId });
    await this.audit.record(actor, 'hr.holiday_created', 'hr_holiday', created.id, { after: toHolidayDto(created) });
    return toHolidayDto(created);
  }

  async updateHoliday(id: string, input: { date?: string; name?: string; description?: string; branchId?: string | null }, actor: IamActor): Promise<HolidayDto> {
    const before = await this.repo.findHoliday(this.tenantId, id);
    if (!before) throw new NotFoundError('Holiday not found.');
    const branchId = input.branchId === undefined ? before.branchId : input.branchId;
    if (input.branchId) await assertBranchAccess(this.tenantId, actor.userId, input.branchId);
    const date = input.date ?? fromDateCol(before.date);
    if (await this.repo.findHolidayAt(this.tenantId, date, branchId, id)) throw new ConflictError(ErrorCode.CONFLICT, 'A holiday already exists on this date.');
    const updated = await this.repo.updateHoliday(this.tenantId, id, {
      ...(input.date ? { date: toDateCol(input.date) } : {}),
      ...(input.name ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
    });
    await this.audit.record(actor, 'hr.holiday_updated', 'hr_holiday', id, { before: toHolidayDto(before), after: toHolidayDto(updated) });
    return toHolidayDto(updated);
  }

  async deleteHoliday(id: string, actor: IamActor): Promise<void> {
    const before = await this.repo.findHoliday(this.tenantId, id);
    if (!before) throw new NotFoundError('Holiday not found.');
    await this.repo.deleteHoliday(id);
    await this.audit.record(actor, 'hr.holiday_deleted', 'hr_holiday', id, { before: toHolidayDto(before) });
  }
}
