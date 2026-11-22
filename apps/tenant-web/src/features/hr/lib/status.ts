import { usePermissions } from '@/features/auth/hooks/use-permissions';
import type { AttendanceStatus, DayPart, DayStatus, LeaveStatus, PayrollRunStatus, PayslipStatus, PaymentMode, Weekday } from '../types';
import type { HrTone } from './hr-palette';

export const DAY_STATUS_TONE: Record<DayStatus, HrTone> = {
  PRESENT: 'present',
  LATE: 'late',
  HALF_DAY: 'half',
  ABSENT: 'absent',
  ON_LEAVE: 'leave',
  WEEKLY_OFF: 'off',
  HOLIDAY: 'holiday',
  NOT_MARKED: 'none',
  NOT_JOINED: 'none',
};

export const DAY_STATUS_LABEL: Record<DayStatus, string> = {
  PRESENT: 'Present',
  LATE: 'Late',
  HALF_DAY: 'Half day',
  ABSENT: 'Absent',
  ON_LEAVE: 'On leave',
  WEEKLY_OFF: 'Weekly off',
  HOLIDAY: 'Holiday',
  NOT_MARKED: 'Not marked',
  NOT_JOINED: 'Not joined',
};

/** Statuses HR can set by hand (`PUT /hr/attendance`). */
export const MARKABLE_STATUSES: AttendanceStatus[] = ['PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'ON_LEAVE', 'WEEKLY_OFF', 'HOLIDAY'];
/** Only these accept check-in/out times. */
export const TIMED_STATUSES: AttendanceStatus[] = ['PRESENT', 'LATE', 'HALF_DAY'];

export const LEAVE_STATUS_TONE: Record<LeaveStatus, HrTone> = { PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected', CANCELLED: 'cancelled' };
export const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = { PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected', CANCELLED: 'Cancelled' };

export const DAY_PART_LABEL: Record<DayPart, string> = {
  FULL_DAY: 'Full day',
  HALF_DAY_MORNING: 'Half day - morning',
  HALF_DAY_EVENING: 'Half day - evening',
};
export const DAY_PART_SHORT: Record<DayPart, string> = { FULL_DAY: 'Full day', HALF_DAY_MORNING: 'Morning half', HALF_DAY_EVENING: 'Evening half' };
export const DAY_PARTS: DayPart[] = ['FULL_DAY', 'HALF_DAY_MORNING', 'HALF_DAY_EVENING'];

export const RUN_STATUS_TONE: Record<PayrollRunStatus, HrTone> = { DRAFT: 'draft', APPROVED: 'approved', PAID: 'paid' };
export const RUN_STATUS_LABEL: Record<PayrollRunStatus, string> = { DRAFT: 'Draft', APPROVED: 'Approved - ready to pay', PAID: 'Paid' };
export const PAYSLIP_STATUS_TONE: Record<PayslipStatus, HrTone> = { DRAFT: 'draft', PAID: 'paid' };

export const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: 'UPI', label: 'UPI' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'OTHER', label: 'Other' },
];
export const paymentModeLabel = (m: PaymentMode | null | undefined): string => PAYMENT_MODES.find((p) => p.value === m)?.label ?? '--';

export const WEEKDAYS: { value: Weekday; label: string; short: string }[] = [
  { value: 'MONDAY', label: 'Monday', short: 'Mon' },
  { value: 'TUESDAY', label: 'Tuesday', short: 'Tue' },
  { value: 'WEDNESDAY', label: 'Wednesday', short: 'Wed' },
  { value: 'THURSDAY', label: 'Thursday', short: 'Thu' },
  { value: 'FRIDAY', label: 'Friday', short: 'Fri' },
  { value: 'SATURDAY', label: 'Saturday', short: 'Sat' },
  { value: 'SUNDAY', label: 'Sunday', short: 'Sun' },
];
export const weekdayShort = (d: Weekday): string => WEEKDAYS.find((w) => w.value === d)?.short ?? d;

export const ROLE_LABEL: Record<string, string> = { OWNER: 'Owner', MANAGER: 'Manager', TRAINER: 'Trainer', RECEPTIONIST: 'Receptionist' };
export const roleLabel = (r: string): string => ROLE_LABEL[r] ?? r.charAt(0) + r.slice(1).toLowerCase();

/** Every HR permission check in one place (UI gating only; the API enforces the same keys). */
export function useHrAccess() {
  const { hasPermission } = usePermissions();
  const a = {
    view: hasPermission('hr:view'),
    attendanceManage: hasPermission('hr:attendance_manage'),
    leaveManage: hasPermission('hr:leave_manage'),
    payrollManage: hasPermission('hr:payroll_manage'),
    settingsManage: hasPermission('hr:settings_manage'),
    selfAttendance: hasPermission('hr:self_attendance'),
    selfLeave: hasPermission('hr:self_leave'),
    selfPayslip: hasPermission('hr:self_payslip'),
  };
  return {
    ...a,
    anySelf: a.selfAttendance || a.selfLeave || a.selfPayslip,
    anyManager: a.view || a.attendanceManage || a.leaveManage || a.payrollManage || a.settingsManage,
  };
}
