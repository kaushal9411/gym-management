import { z } from 'zod';

import { WEEKDAYS } from '../utils/hr-dates.util';

const uuid = z.string().uuid();
const date = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Invalid date');
const month = z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM');
const hm = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm (24 hour)');
const weekday = z.enum(WEEKDAYS);
const money = z.coerce.number().finite().min(0).max(100_000_000);
const bool = z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean());

const dayPart = z.enum(['FULL_DAY', 'HALF_DAY_MORNING', 'HALF_DAY_EVENING']);
const leaveStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']);
const attendanceStatus = z.enum(['PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_LEAVE', 'WEEKLY_OFF', 'HOLIDAY']);
const paymentMode = z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']);

const page = z.coerce.number().int().min(1).default(1);
const limit = (max: number, def = 20) => z.coerce.number().int().min(1).max(max).default(def);

export const idParamSchema = z.object({ id: uuid });
export const userIdParamSchema = z.object({ userId: uuid });

// ── self-service ──────────────────────────────────────────────────────────
export const checkInBodySchema = z.object({ note: z.string().trim().max(200).optional() }).default({});
export const enrollBodySchema = z.object({ shiftId: uuid.optional() }).default({});
export const monthQuerySchema = z.object({ month: month.optional() });
export const yearQuerySchema = z.object({ year: z.coerce.number().int().min(2000).max(2100).optional() });
export const leaveYearQuerySchema = z.object({ leaveYear: z.coerce.number().int().min(2000).max(2100).optional() });

const leaveFields = {
  leaveTypeId: uuid,
  startDate: date,
  endDate: date.optional(),
  dayPart: dayPart.default('FULL_DAY'),
};
export const leavePreviewBodySchema = z.object(leaveFields);
export const applyLeaveBodySchema = z.object({ ...leaveFields, reason: z.string().trim().min(3).max(500) });
export const cancelLeaveBodySchema = z.object({ remark: z.string().trim().max(300).optional() }).default({});
export const listMyLeavesQuerySchema = z.object({ status: leaveStatus.optional(), page, limit: limit(100) });
export const listNotificationsQuerySchema = z.object({ unreadOnly: bool.optional(), page, limit: limit(100) });
export const listMyPayslipsQuerySchema = z.object({ page, limit: limit(100, 12) });

// ── overview / employees ─────────────────────────────────────────────────
export const listEmployeesQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'PENDING_VERIFICATION', 'LOCKED']).optional(),
  branchId: uuid.optional(),
  page,
  limit: limit(200, 50),
});
export const employeeDetailQuerySchema = z.object({ month: month.optional() });
export const workSetupBodySchema = z
  .object({ shiftId: uuid.nullable().optional(), weeklyOff: z.array(weekday).max(6).nullable().optional() })
  .refine((v) => v.shiftId !== undefined || v.weeklyOff !== undefined, 'Provide shiftId and/or weeklyOff');
export const payStructureBodySchema = z.object({
  baseSalary: money.optional(),
  components: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        type: z.enum(['ALLOWANCE', 'DEDUCTION']),
        amount: money,
        isActive: z.boolean().default(true),
      }),
    )
    .max(20),
});

// ── attendance management ────────────────────────────────────────────────
export const attendanceDayQuerySchema = z.object({ date: date.optional(), branchId: uuid.optional(), search: z.string().trim().max(100).optional() });
export const attendanceMonthlyQuerySchema = z.object({ month: month.optional(), branchId: uuid.optional() });
const remark = z.string().trim().min(3).max(300);
const entryFields = {
  status: attendanceStatus,
  checkInTime: hm.optional(),
  checkOutTime: hm.optional(),
};
export const markAttendanceBodySchema = z.object({ userId: uuid, date, ...entryFields, remark });
export const bulkAttendanceBodySchema = z.object({
  date,
  remark,
  entries: z.array(z.object({ userId: uuid, ...entryFields, remark: remark.optional() })).min(1).max(200),
});
export const clearAttendanceQuerySchema = z.object({ userId: uuid, date, remark });

// ── leave management ─────────────────────────────────────────────────────
export const listLeavesQuerySchema = z.object({
  status: leaveStatus.optional(),
  userId: uuid.optional(),
  leaveTypeId: uuid.optional(),
  from: date.optional(),
  to: date.optional(),
  page,
  limit: limit(100),
});
/** Team leave calendar window: both bounds required, from <= to, at most 62 days (inclusive). */
export const MAX_CALENDAR_DAYS = 62;
export const leaveCalendarQuerySchema = z
  .object({ from: date, to: date })
  .superRefine((v, ctx) => {
    const span = (Date.parse(`${v.to}T00:00:00Z`) - Date.parse(`${v.from}T00:00:00Z`)) / 86_400_000 + 1;
    if (span < 1) ctx.addIssue({ code: 'custom', path: ['to'], message: 'to must not be before from' });
    else if (span > MAX_CALENDAR_DAYS) ctx.addIssue({ code: 'custom', path: ['to'], message: `The range can cover at most ${MAX_CALENDAR_DAYS} days` });
  });
export const hrLeavePreviewBodySchema = z.object({ userId: uuid, ...leaveFields });
export const hrApplyLeaveBodySchema = z.object({
  userId: uuid,
  ...leaveFields,
  reason: z.string().trim().min(3).max(500),
  autoApprove: z.boolean().default(false),
  remark: z.string().trim().max(500).optional(),
});
export const approveLeaveBodySchema = z.object({ remark: z.string().trim().max(500).optional() }).default({});
export const rejectLeaveBodySchema = z.object({ remark: z.string().trim().min(3, 'A remark is required when rejecting.').max(500) });
export const hrCancelLeaveBodySchema = z.object({ remark: z.string().trim().min(3, 'A remark is required when cancelling.').max(300) });
export const leaveBalancesQuerySchema = z.object({ userId: uuid.optional(), leaveYear: z.coerce.number().int().min(2000).max(2100).optional() });
export const adjustBalanceBodySchema = z.object({
  userId: uuid,
  leaveTypeId: uuid,
  leaveYear: z.coerce.number().int().min(2000).max(2100).optional(),
  days: z.number().finite().min(-365).max(365).refine((v) => v !== 0, 'days must not be 0'),
  remark,
});

const leaveTypeFields = {
  name: z.string().trim().min(2).max(80),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,12}$/, 'Code must be 2-12 letters, digits or underscores'),
  yearlyQuota: z.number().min(0).max(366).nullable(),
  isPaid: z.boolean(),
  carryForward: z.boolean(),
  carryForwardMax: z.number().min(0).max(366).nullable(),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Use a #RRGGBB colour'),
  sortOrder: z.number().int().min(0).max(1000),
};
export const createLeaveTypeBodySchema = z.object({
  ...leaveTypeFields,
  yearlyQuota: leaveTypeFields.yearlyQuota.default(null),
  isPaid: leaveTypeFields.isPaid.default(true),
  carryForward: leaveTypeFields.carryForward.default(false),
  carryForwardMax: leaveTypeFields.carryForwardMax.default(null),
  color: leaveTypeFields.color.default('#6366f1'),
  sortOrder: leaveTypeFields.sortOrder.default(0),
});
export const updateLeaveTypeBodySchema = z.object({ ...leaveTypeFields, isActive: z.boolean() }).partial();
export const listLeaveTypesQuerySchema = z.object({ includeInactive: bool.default(false) });

export const listHolidaysQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  from: date.optional(),
  to: date.optional(),
  branchId: uuid.optional(),
});
export const createHolidayBodySchema = z.object({
  date,
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  branchId: uuid.nullable().optional(),
});
export const updateHolidayBodySchema = createHolidayBodySchema.partial();

// ── shifts & policy ──────────────────────────────────────────────────────
const shiftFields = {
  name: z.string().trim().min(2).max(80),
  startTime: hm,
  endTime: hm,
  graceMinutes: z.number().int().min(0).max(180),
  weeklyOffDays: z.array(weekday).max(6),
  isDefault: z.boolean(),
};
export const createShiftBodySchema = z.object({
  ...shiftFields,
  graceMinutes: shiftFields.graceMinutes.default(10),
  weeklyOffDays: shiftFields.weeklyOffDays.default(['SUNDAY']),
  isDefault: shiftFields.isDefault.default(false),
});
export const updateShiftBodySchema = z.object({ ...shiftFields, isActive: z.boolean() }).partial();

export const updatePolicyBodySchema = z
  .object({
    leaveYearStartMonth: z.number().int().min(1).max(12),
    defaultWeeklyOff: z.array(weekday).max(6),
    lateGraceMinutes: z.number().int().min(0).max(180),
    halfDayThresholdHours: z.number().min(0.5).max(12),
    standardDayHours: z.number().min(1).max(16),
    latePenaltyEnabled: z.boolean(),
    latePenaltyLatesPerUnit: z.number().int().min(1).max(31),
    latePenaltyDays: z.number().min(0.5).max(5),
    overtimeEnabled: z.boolean(),
    overtimeMultiplier: z.number().min(1).max(5),
    backdateLeaveDays: z.number().int().min(0).max(365),
  })
  .partial();

// ── payroll ──────────────────────────────────────────────────────────────
export const listRunsQuerySchema = z.object({ page, limit: limit(100, 12) });
export const createRunBodySchema = z.object({ month, notes: z.string().trim().max(500).optional() });
export const patchPayslipBodySchema = z.object({
  bonus: money.optional(),
  advanceRecovery: money.optional(),
  manualLines: z
    .array(z.object({ name: z.string().trim().min(1).max(80), type: z.enum(['ALLOWANCE', 'DEDUCTION']), amount: z.number().positive().max(100_000_000) }))
    .max(20)
    .optional(),
  remark: z.string().trim().max(300).optional(),
});
export const payBodySchema = z.object({
  paymentMode,
  paidOn: date.optional(),
  remark: z.string().trim().max(300).optional(),
});
