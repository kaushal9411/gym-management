/** Types for the HR module. Mirrors `docs/HR-API-CONTRACT.md` exactly — if the API changes, change it here first. */

export type DayPart = 'FULL_DAY' | 'HALF_DAY_MORNING' | 'HALF_DAY_EVENING';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LATE' | 'ON_LEAVE' | 'WEEKLY_OFF' | 'HOLIDAY';
export type DayStatus = AttendanceStatus | 'NOT_MARKED' | 'NOT_JOINED';
export type AttendanceSource = 'SELF' | 'MANUAL' | 'SYSTEM';
export type PayComponentType = 'ALLOWANCE' | 'DEDUCTION';
export type PayrollRunStatus = 'DRAFT' | 'APPROVED' | 'PAID';
export type PayslipStatus = 'DRAFT' | 'PAID';
export type PaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';
export type Weekday = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
export type HrNotificationType = 'LEAVE_APPLIED' | 'LEAVE_APPROVED' | 'LEAVE_REJECTED' | 'LEAVE_CANCELLED' | 'PAYSLIP_PAID';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface EmployeeRef {
  userId: string;
  employeeId: string;
  name: string;
  avatarUrl: string | null;
  role: string;
}

export interface ShiftRef {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
}

export interface LeaveTypeRef {
  id: string;
  name: string;
  code: string;
  color: string | null;
  isPaid: boolean;
}

export interface UserRef {
  id: string;
  name: string;
}

export interface AttendanceDay {
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
  source: AttendanceSource | null;
  remark: string | null;
  markedBy: UserRef | null;
  leaveRequestId: string | null;
  leaveType: LeaveTypeRef | null;
  leaveDayPart: DayPart | null;
  holidayName: string | null;
  shift: { name: string; startTime: string; endTime: string } | null;
}

export interface AttendanceStats {
  present: number;
  late: number;
  halfDay: number;
  onLeave: number;
  absent: number;
  weeklyOff: number;
  holiday: number;
  notMarked: number;
  workedMinutes: number;
  lateCount: number;
  overtimeMinutes: number;
}

export interface LeaveRequest {
  id: string;
  employee: EmployeeRef;
  leaveType: LeaveTypeRef;
  startDate: string;
  endDate: string;
  dayPart: DayPart;
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedOnBehalf: boolean;
  appliedBy: UserRef;
  createdAt: string;
  decidedBy: UserRef | null;
  decidedAt: string | null;
  decisionRemark: string | null;
  cancelledAt: string | null;
  canCancel: boolean;
}

export interface LeaveConflict {
  employee: EmployeeRef;
  leaveRequestId: string;
  startDate: string;
  endDate: string;
}

export interface LeaveRequestDetail extends LeaveRequest {
  balance: LeaveBalance | null;
  conflicts: LeaveConflict[];
}

export interface LeaveBalance {
  leaveType: LeaveTypeRef;
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

export interface LeaveBalancesResponse {
  leaveYear: number;
  leaveYearLabel: string;
  periodStart: string;
  periodEnd: string;
  balances: LeaveBalance[];
}

export interface AllLeaveBalancesResponse {
  leaveYear: number;
  leaveYearLabel: string;
  periodStart: string;
  periodEnd: string;
  employees: { employee: EmployeeRef; balances: LeaveBalance[] }[];
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  description: string | null;
  branch: { id: string; name: string } | null;
}

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  yearlyQuota: number | null;
  isPaid: boolean;
  carryForward: boolean;
  carryForwardMax: number | null;
  color: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  weeklyOffDays: Weekday[];
  isDefault: boolean;
  isActive: boolean;
  employeeCount: number;
}

export interface Policy {
  leaveYearStartMonth: number;
  defaultWeeklyOff: Weekday[];
  lateGraceMinutes: number;
  halfDayThresholdHours: number;
  standardDayHours: number;
  latePenaltyEnabled: boolean;
  latePenaltyLatesPerUnit: number;
  latePenaltyDays: number;
  overtimeEnabled: boolean;
  overtimeMultiplier: number;
  backdateLeaveDays: number;
  workingDaysBasis: string;
}

export interface PayComponent {
  id?: string;
  name: string;
  type: PayComponentType;
  amount: number;
  isActive?: boolean;
}

export interface PayStructure {
  userId: string;
  salaryType: string;
  baseSalary: number | null;
  components: PayComponent[];
  monthlyGross: number;
  fixedDeductions: number;
}

export interface PayslipLine {
  id: string;
  name: string;
  type: PayComponentType;
  amount: number;
  source: 'STRUCTURE' | 'MANUAL';
}

export interface PayslipSummary {
  id: string;
  runId: string;
  month: string;
  status: PayslipStatus;
  employee: EmployeeRef;
  netPay: number;
  grossEarnings: number;
  totalDeductions: number;
  paidAt: string | null;
  paymentMode: PaymentMode | null;
}

export interface Payslip extends PayslipSummary {
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
  lines: PayslipLine[];
  notes: string[];
  paidOn: string | null;
  paidBy: UserRef | null;
  paidRemark: string | null;
  expenseId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollRun {
  id: string;
  month: string;
  status: PayrollRunStatus;
  employeeCount: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  paidCount: number;
  paidAmount: number;
  notes: string | null;
  createdBy: UserRef;
  createdAt: string;
  approvedBy: UserRef | null;
  approvedAt: string | null;
  paidAt: string | null;
}

export interface PayrollRunDetail {
  run: PayrollRun;
  payslips: Payslip[];
}

// ── Self service ──

export interface MeSummary {
  employee: EmployeeRef & { joiningDate: string; shift: ShiftRef | null; weeklyOff: Weekday[] };
  today: {
    date: string;
    attendance: AttendanceDay;
    isWeeklyOff: boolean;
    holidayName: string | null;
    canCheckIn: boolean;
    canCheckOut: boolean;
  };
  month: { month: string; stats: AttendanceStats };
  leaveBalances: LeaveBalance[];
  pendingLeaves: LeaveRequest[];
  upcomingLeaves: LeaveRequest[];
  upcomingHolidays: Holiday[];
  latestPayslip: PayslipSummary | null;
  unreadNotifications: number;
}

export interface MonthAttendance {
  month: string;
  days: AttendanceDay[];
  stats: AttendanceStats;
}

export interface LeavePreview {
  days: number;
  excluded: { date: string; reason: 'WEEKLY_OFF' | 'HOLIDAY'; name?: string }[];
  available: number | null;
  sufficient: boolean;
}

export interface LeavePreviewPayload {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  dayPart: DayPart;
  userId?: string;
}

export interface ApplyLeavePayload extends LeavePreviewPayload {
  reason: string;
}

export interface ApplyOnBehalfPayload extends ApplyLeavePayload {
  userId: string;
  autoApprove?: boolean;
  remark?: string;
}

export interface HrNotification {
  id: string;
  type: HrNotificationType;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface HrNotificationsResponse extends Paginated<HrNotification> {
  unreadCount: number;
}

// ── Manager side ──

export interface TodayBuckets {
  present: number;
  late: number;
  halfDay: number;
  onLeave: number;
  absent: number;
  weeklyOff: number;
  holiday: number;
  notMarked: number;
}

export interface LeaveCalendarItem {
  id: string;
  userId: string;
  employeeName: string;
  leaveType: LeaveTypeRef;
  startDate: string;
  endDate: string;
  dayPart: DayPart;
  days: number;
  status: 'PENDING' | 'APPROVED';
}

/** `GET /hr/leaves/calendar` — item dates are the request's own and may extend outside the window (clip client-side). */
export interface LeaveCalendarResponse {
  from: string;
  to: string;
  items: LeaveCalendarItem[];
  holidays: Holiday[];
}

export interface HrOverview {
  date: string;
  headcount: number;
  /** `absent` for today is derived after the employee's shift end (v1.2); `yetToCheckIn` === `notMarked`. */
  today: TodayBuckets & { checkedInNow: number; yetToCheckIn: number };
  pendingLeaves: number;
  payroll: {
    month: string;
    runId: string | null;
    status: 'NOT_GENERATED' | PayrollRunStatus;
    totalNet: number | null;
    unpaidPayslips: number | null;
  } | null;
  upcomingLeaves: {
    id: string;
    employee: EmployeeRef;
    leaveType: LeaveTypeRef;
    startDate: string;
    endDate: string;
    dayPart: DayPart;
    days: number;
  }[];
  trend: { date: string; present: number; late: number; halfDay: number; onLeave: number; absent: number }[];
  upcomingHolidays: Holiday[];
}

export interface EmployeeListItem {
  userId: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: string;
  accountStatus: string;
  workStatus: string;
  employmentType: string;
  joiningDate: string;
  branches: { id: string; name: string }[];
  shift: ShiftRef | null;
  weeklyOff: Weekday[];
  today: { status: DayStatus; checkInTime: string | null; checkOutTime: string | null };
  leaveBalances: { leaveTypeId: string; code: string; name: string; available: number | null }[];
  pendingLeaves: number;
}

export interface EmployeeDetail {
  employee: EmployeeListItem;
  attendance: MonthAttendance;
  leaves: LeaveRequest[];
  balances: LeaveBalance[];
  payStructure: PayStructure | null;
  payslips: PayslipSummary[];
}

export interface ListEmployeesParams {
  search?: string;
  status?: string;
  branchId?: string;
  page?: number;
  limit?: number;
}

export interface DayAttendanceResponse {
  date: string;
  summary: TodayBuckets;
  items: { employee: EmployeeRef; shift: ShiftRef | null; attendance: AttendanceDay }[];
}

export interface MonthlyGridResponse {
  month: string;
  days: string[];
  employees: { employee: EmployeeRef; cells: DayStatus[]; stats: AttendanceStats }[];
}

export interface MarkAttendancePayload {
  userId: string;
  date: string;
  status: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  remark: string;
}

export interface BulkAttendancePayload {
  date: string;
  remark: string;
  entries: { userId: string; status: AttendanceStatus; checkInTime?: string; checkOutTime?: string; remark?: string }[];
}

export interface ListLeavesParams {
  status?: LeaveStatus;
  userId?: string;
  leaveTypeId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface LeaveListResponse extends Paginated<LeaveRequest> {
  counts: { pending: number; approved: number; rejected: number; cancelled: number };
}

export interface AdjustBalancePayload {
  userId: string;
  leaveTypeId: string;
  leaveYear?: number;
  days: number;
  remark: string;
}

export interface LeaveTypePayload {
  name: string;
  code: string;
  yearlyQuota: number | null;
  isPaid: boolean;
  carryForward: boolean;
  carryForwardMax: number | null;
  color: string | null;
  sortOrder?: number;
}

export interface ShiftPayload {
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  weeklyOffDays: Weekday[];
  isDefault?: boolean;
}

export interface HolidayPayload {
  date: string;
  name: string;
  description?: string;
  branchId?: string | null;
}

export interface WorkSetupPayload {
  shiftId?: string | null;
  weeklyOff?: Weekday[] | null;
}

export interface PayStructurePayload {
  baseSalary?: number;
  components: { name: string; type: PayComponentType; amount: number; isActive?: boolean }[];
}

export interface PayslipPatchPayload {
  bonus?: number;
  advanceRecovery?: number;
  manualLines?: { name: string; type: PayComponentType; amount: number }[];
  remark?: string;
}

export interface PayPayload {
  paymentMode: PaymentMode;
  paidOn?: string;
  remark?: string;
}

export interface PayAllResult {
  paid: number;
  skipped: number;
  failed: { payslipId: string; message: string }[];
  run: PayrollRun;
}

/** `POST /hr/me/enroll` returns the same shape as `GET /hr/me/summary`. */
export type EnrollResult = MeSummary;
