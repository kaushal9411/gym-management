import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { toDateCol } from '../utils/hr-dates.util';

/** Default leave types seeded for every tenant (also in the migration SQL for existing tenants). */
export const DEFAULT_LEAVE_TYPES = [
  { name: 'Casual Leave', code: 'CASUAL', yearlyQuota: 12, isPaid: true, carryForward: false, carryForwardMax: null, color: '#6366f1', sortOrder: 1 },
  { name: 'Sick Leave', code: 'SICK', yearlyQuota: 8, isPaid: true, carryForward: false, carryForwardMax: null, color: '#ef4444', sortOrder: 2 },
  { name: 'Paid Leave', code: 'PAID', yearlyQuota: 15, isPaid: true, carryForward: true, carryForwardMax: 15, color: '#10b981', sortOrder: 3 },
  { name: 'Unpaid Leave', code: 'UNPAID', yearlyQuota: null, isPaid: false, carryForward: false, carryForwardMax: null, color: '#64748b', sortOrder: 4 },
] as const;

export type PolicyRow = Prisma.HrPolicyGetPayload<Record<string, never>>;
export type LeaveTypeRow = Prisma.HrLeaveTypeGetPayload<Record<string, never>>;
export type ShiftRow = Prisma.HrShiftGetPayload<Record<string, never>>;
export type HolidayRow = Prisma.HrHolidayGetPayload<{ include: { branch: { select: { id: true; name: true } } } }>;

export class HrConfigRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  // ── policy ──────────────────────────────────────────────────────────────
  findPolicy(tenantId: string): Promise<PolicyRow | null> {
    return this.db.hrPolicy.findUnique({ where: { tenantId } });
  }

  createPolicy(tenantId: string): Promise<PolicyRow> {
    return this.db.hrPolicy.create({ data: { tenantId } });
  }

  updatePolicy(tenantId: string, data: Prisma.HrPolicyUncheckedUpdateInput): Promise<PolicyRow> {
    return this.db.hrPolicy.update({ where: { tenantId }, data });
  }

  // ── leave types ─────────────────────────────────────────────────────────
  listLeaveTypes(tenantId: string, includeInactive: boolean): Promise<LeaveTypeRow[]> {
    return this.db.hrLeaveType.findMany({ where: { tenantId, ...(includeInactive ? {} : { isActive: true }) }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  findLeaveType(tenantId: string, id: string): Promise<LeaveTypeRow | null> {
    return this.db.hrLeaveType.findFirst({ where: { tenantId, id } });
  }

  findLeaveTypeByCode(tenantId: string, code: string): Promise<LeaveTypeRow | null> {
    return this.db.hrLeaveType.findFirst({ where: { tenantId, code } });
  }

  createLeaveType(data: Prisma.HrLeaveTypeUncheckedCreateInput): Promise<LeaveTypeRow> {
    return this.db.hrLeaveType.create({ data });
  }

  updateLeaveType(id: string, data: Prisma.HrLeaveTypeUncheckedUpdateInput): Promise<LeaveTypeRow> {
    return this.db.hrLeaveType.update({ where: { id }, data });
  }

  async leaveTypeInUse(tenantId: string, id: string): Promise<boolean> {
    const [requests, balances] = await Promise.all([
      this.db.hrLeaveRequest.count({ where: { tenantId, leaveTypeId: id } }),
      this.db.hrLeaveBalance.count({ where: { tenantId, leaveTypeId: id } }),
    ]);
    return requests + balances > 0;
  }

  async deleteLeaveType(id: string): Promise<void> {
    await this.db.hrLeaveType.delete({ where: { id } });
  }

  // ── shifts ──────────────────────────────────────────────────────────────
  listShifts(tenantId: string): Promise<ShiftRow[]> {
    return this.db.hrShift.findMany({ where: { tenantId }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] });
  }

  findShift(tenantId: string, id: string): Promise<ShiftRow | null> {
    return this.db.hrShift.findFirst({ where: { tenantId, id } });
  }

  findShiftByName(tenantId: string, name: string): Promise<ShiftRow | null> {
    return this.db.hrShift.findFirst({ where: { tenantId, name: { equals: name, mode: 'insensitive' } } });
  }

  findDefaultShift(tenantId: string): Promise<ShiftRow | null> {
    return this.db.hrShift.findFirst({ where: { tenantId, isDefault: true, isActive: true } });
  }

  createShift(data: Prisma.HrShiftUncheckedCreateInput): Promise<ShiftRow> {
    return this.db.hrShift.create({ data });
  }

  updateShift(id: string, data: Prisma.HrShiftUncheckedUpdateInput): Promise<ShiftRow> {
    return this.db.hrShift.update({ where: { id }, data });
  }

  async clearDefaultShift(tenantId: string, exceptId?: string): Promise<void> {
    await this.db.hrShift.updateMany({ where: { tenantId, isDefault: true, ...(exceptId ? { id: { not: exceptId } } : {}) }, data: { isDefault: false } });
  }

  async deleteShift(id: string): Promise<void> {
    await this.db.hrShift.delete({ where: { id } });
  }

  countStaffOnShift(tenantId: string, shiftId: string): Promise<number> {
    return this.db.staffProfile.count({ where: { tenantId, shiftId } });
  }

  // ── holidays ────────────────────────────────────────────────────────────
  listHolidays(tenantId: string, from: string, to: string, branchId?: string): Promise<HolidayRow[]> {
    return this.db.hrHoliday.findMany({
      where: { tenantId, date: { gte: toDateCol(from), lte: toDateCol(to) }, ...(branchId ? { OR: [{ branchId: null }, { branchId }] } : {}) },
      include: { branch: { select: { id: true, name: true } } },
      orderBy: [{ date: 'asc' }, { name: 'asc' }],
    });
  }

  findHoliday(tenantId: string, id: string): Promise<HolidayRow | null> {
    return this.db.hrHoliday.findFirst({ where: { tenantId, id }, include: { branch: { select: { id: true, name: true } } } });
  }

  findHolidayAt(tenantId: string, date: string, branchId: string | null, exceptId?: string) {
    return this.db.hrHoliday.findFirst({ where: { tenantId, date: toDateCol(date), branchId, ...(exceptId ? { id: { not: exceptId } } : {}) } });
  }

  async createHoliday(data: Prisma.HrHolidayUncheckedCreateInput): Promise<HolidayRow> {
    const created = await this.db.hrHoliday.create({ data });
    return (await this.findHoliday(data.tenantId, created.id))!;
  }

  async updateHoliday(tenantId: string, id: string, data: Prisma.HrHolidayUncheckedUpdateInput): Promise<HolidayRow> {
    await this.db.hrHoliday.update({ where: { id }, data });
    return (await this.findHoliday(tenantId, id))!;
  }

  async deleteHoliday(id: string): Promise<void> {
    await this.db.hrHoliday.delete({ where: { id } });
  }

  // ── defaults ────────────────────────────────────────────────────────────
  async ensureDefaultLeaveTypes(tenantId: string): Promise<void> {
    const existing = await this.db.hrLeaveType.count({ where: { tenantId } });
    if (existing > 0) return;
    await this.db.hrLeaveType.createMany({ data: DEFAULT_LEAVE_TYPES.map((t) => ({ tenantId, ...t })), skipDuplicates: true });
  }

  async ensureDefaultShift(tenantId: string): Promise<void> {
    const existing = await this.db.hrShift.count({ where: { tenantId } });
    if (existing > 0) return;
    await this.db.hrShift.create({ data: { tenantId, name: 'General', startTime: '06:00', endTime: '21:00', graceMinutes: 10, weeklyOffDays: 'SUNDAY', isDefault: true } });
  }
}
