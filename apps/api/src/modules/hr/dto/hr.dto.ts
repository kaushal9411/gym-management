/** Response shapes — mirror docs/HR-API-CONTRACT.md §2 exactly. */
import type { AttendanceStats, DayStatus } from '../utils/attendance.util';
import type { DayPart } from '../utils/leave.util';

export interface EmployeeRefDto {
  userId: string;
  employeeId: string;
  name: string;
  avatarUrl: string | null;
  role: string;
}

export interface ShiftRefDto {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
}

export interface LeaveTypeRefDto {
  id: string;
  name: string;
  code: string;
  color: string;
  isPaid: boolean;
}

export interface LeaveTypeDto extends LeaveTypeRefDto {
  yearlyQuota: number | null;
  carryForward: boolean;
  carryForwardMax: number | null;
  isActive: boolean;
  sortOrder: number;
}

export interface ShiftDto extends ShiftRefDto {
  weeklyOffDays: string[];
  isDefault: boolean;
  isActive: boolean;
  employeeCount: number;
}

export interface HolidayDto {
  id: string;
  date: string;
  name: string;
  description: string | null;
  branch: { id: string; name: string } | null;
}

export interface PolicyDto {
  leaveYearStartMonth: number;
  defaultWeeklyOff: string[];
  lateGraceMinutes: number;
  halfDayThresholdHours: number;
  standardDayHours: number;
  latePenaltyEnabled: boolean;
  latePenaltyLatesPerUnit: number;
  latePenaltyDays: number;
  overtimeEnabled: boolean;
  overtimeMultiplier: number;
  backdateLeaveDays: number;
  workingDaysBasis: 'CALENDAR_MINUS_WEEKLY_OFFS';
}

export interface ActorRefDto {
  id: string;
  name: string;
}

export interface AttendanceDayDto {
  date: string;
  userId: string;
  status: DayStatus;
  recorded: boolean;
  id: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  workedMinutes: number | null;
  lateMinutes: number;
  overtimeMinutes: number;
  source: 'SELF' | 'MANUAL' | 'SYSTEM' | null;
  remark: string | null;
  markedBy: ActorRefDto | null;
  leaveRequestId: string | null;
  leaveType: LeaveTypeRefDto | null;
  leaveDayPart: DayPart | null;
  holidayName: string | null;
  shift: { name: string; startTime: string; endTime: string } | null;
}

/** One row of the team leave calendar (`GET /hr/leaves/calendar`). */
export interface LeaveCalendarItemDto {
  id: string;
  userId: string;
  employeeName: string;
  leaveType: LeaveTypeRefDto;
  startDate: string;
  endDate: string;
  dayPart: DayPart;
  days: number;
  status: 'PENDING' | 'APPROVED';
}

export interface LeaveCalendarDto {
  from: string;
  to: string;
  items: LeaveCalendarItemDto[];
  holidays: HolidayDto[];
}

export interface LeaveRequestDto {
  id: string;
  employee: EmployeeRefDto;
  leaveType: LeaveTypeRefDto;
  startDate: string;
  endDate: string;
  dayPart: DayPart;
  days: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  appliedOnBehalf: boolean;
  appliedBy: ActorRefDto | null;
  createdAt: string;
  decidedBy: ActorRefDto | null;
  decidedAt: string | null;
  decisionRemark: string | null;
  cancelledAt: string | null;
  canCancel: boolean;
}

export interface LeaveBalanceDto {
  leaveType: LeaveTypeRefDto;
  leaveYear: number;
  leaveYearLabel: string;
  periodStart: string;
  periodEnd: string;
  quota: number | null;
  carriedForward: number;
  adjustment: number;
  entitled: number | null;
  used: number;
  pending: number;
  available: number | null;
}

export interface PayComponentDto {
  id: string;
  name: string;
  type: 'ALLOWANCE' | 'DEDUCTION';
  amount: number;
  isActive: boolean;
}

export interface PayStructureDto {
  userId: string;
  salaryType: string;
  baseSalary: number | null;
  components: PayComponentDto[];
  monthlyGross: number;
  fixedDeductions: number;
}

export interface PayslipLineDto {
  id: string;
  name: string;
  type: 'ALLOWANCE' | 'DEDUCTION';
  amount: number;
  source: 'STRUCTURE' | 'MANUAL';
}

export interface PayslipSummaryDto {
  id: string;
  runId: string;
  month: string;
  status: 'DRAFT' | 'PAID';
  employee: EmployeeRefDto;
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  paidAt: string | null;
  paymentMode: string | null;
}

export interface PayslipDto extends PayslipSummaryDto {
  salaryType: string;
  workingDays: number;
  presentDays: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  absentDays: number;
  holidayDays: number;
  weeklyOffDays: number;
  notEmployedDays: number;
  lateCount: number;
  overtimeMinutes: number;
  unpaidDays: number;
  dailyRate: number;
  baseSalary: number;
  fixedAllowances: number;
  monthlyGross: number;
  attendanceDeduction: number;
  overtimePay: number;
  extraAllowances: number;
  bonus: number;
  fixedDeductions: number;
  extraDeductions: number;
  latePenalty: number;
  advanceRecovery: number;
  lines: PayslipLineDto[];
  notes: string[];
  paidOn: string | null;
  paidBy: ActorRefDto | null;
  paidRemark: string | null;
  expenseId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollRunDto {
  id: string;
  month: string;
  status: 'DRAFT' | 'APPROVED' | 'PAID';
  employeeCount: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  paidCount: number;
  paidAmount: number;
  notes: string | null;
  createdBy: ActorRefDto | null;
  createdAt: string;
  approvedBy: ActorRefDto | null;
  approvedAt: string | null;
  paidAt: string | null;
}

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type { AttendanceStats };
