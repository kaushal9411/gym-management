import { apiClient } from '@/features/auth/services/api-client';
import type {
  AdjustBalancePayload,
  AllLeaveBalancesResponse,
  ApplyLeavePayload,
  ApplyOnBehalfPayload,
  AttendanceDay,
  BulkAttendancePayload,
  DayAttendanceResponse,
  EmployeeDetail,
  EmployeeListItem,
  Holiday,
  HolidayPayload,
  HrNotificationsResponse,
  EnrollResult,
  HrOverview,
  LeaveCalendarResponse,
  LeaveBalance,
  LeaveBalancesResponse,
  LeaveListResponse,
  LeavePreview,
  LeavePreviewPayload,
  LeaveRequest,
  LeaveRequestDetail,
  LeaveType,
  LeaveTypePayload,
  ListEmployeesParams,
  ListLeavesParams,
  MarkAttendancePayload,
  MeSummary,
  MonthAttendance,
  MonthlyGridResponse,
  Paginated,
  PayAllResult,
  PayPayload,
  PayrollRun,
  PayrollRunDetail,
  PayStructure,
  PayStructurePayload,
  Payslip,
  PayslipPatchPayload,
  PayslipSummary,
  Policy,
  Shift,
  ShiftPayload,
  WorkSetupPayload,
} from '../types';

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

const unwrap = <T>(res: { data: Envelope<T> }): T => res.data.data;

/** Opens a PDF response in a new tab (blob URL) — the same approach the invoices PDF uses. */
async function openPdf(url: string): Promise<void> {
  const res = await apiClient.get(url, { responseType: 'blob' });
  const blobUrl = URL.createObjectURL(new Blob([res.data as Blob], { type: 'application/pdf' }));
  window.open(blobUrl, '_blank');
}

class HrService {
  // ── Self service ──
  me = {
    summary: async () => unwrap(await apiClient.get<Envelope<MeSummary>>('/hr/me/summary')),
    /** Opt-in: puts a user without an employee profile (e.g. the owner) on the roster. 409 `ALREADY_EMPLOYEE` when they already are. */
    enroll: async () => unwrap(await apiClient.post<Envelope<EnrollResult>>('/hr/me/enroll', {})),
    checkIn: async (note?: string) => unwrap(await apiClient.post<Envelope<AttendanceDay>>('/hr/me/attendance/check-in', note ? { note } : {})),
    checkOut: async () => unwrap(await apiClient.post<Envelope<AttendanceDay>>('/hr/me/attendance/check-out', {})),
    attendance: async (month: string) => unwrap(await apiClient.get<Envelope<MonthAttendance>>('/hr/me/attendance', { params: { month } })),
    leaveTypes: async () => unwrap(await apiClient.get<Envelope<LeaveType[]>>('/hr/me/leave-types')),
    balances: async (leaveYear?: number) => unwrap(await apiClient.get<Envelope<LeaveBalancesResponse>>('/hr/me/leave-balances', { params: { leaveYear } })),
    holidays: async (year?: number) => unwrap(await apiClient.get<Envelope<Holiday[]>>('/hr/me/holidays', { params: { year } })),
    previewLeave: async (p: LeavePreviewPayload) => unwrap(await apiClient.post<Envelope<LeavePreview>>('/hr/me/leaves/preview', p, { silent: true })),
    leaves: async (params: { status?: string; page?: number; limit?: number }) => unwrap(await apiClient.get<Envelope<Paginated<LeaveRequest>>>('/hr/me/leaves', { params })),
    applyLeave: async (p: ApplyLeavePayload) => unwrap(await apiClient.post<Envelope<LeaveRequest>>('/hr/me/leaves', p)),
    cancelLeave: async (id: string, remark?: string) => unwrap(await apiClient.post<Envelope<LeaveRequest>>(`/hr/me/leaves/${id}/cancel`, remark ? { remark } : {})),
    payslips: async (params: { page?: number; limit?: number }) => unwrap(await apiClient.get<Envelope<Paginated<PayslipSummary>>>('/hr/me/payslips', { params })),
    payslip: async (id: string) => unwrap(await apiClient.get<Envelope<Payslip>>(`/hr/me/payslips/${id}`)),
    payslipPdf: (id: string) => openPdf(`/hr/me/payslips/${id}/pdf`),
    notifications: async (params: { unreadOnly?: boolean; page?: number; limit?: number }) => unwrap(await apiClient.get<Envelope<HrNotificationsResponse>>('/hr/me/notifications', { params })),
    readAll: async () => {
      await apiClient.post('/hr/me/notifications/read-all', {});
    },
    read: async (id: string) => {
      await apiClient.post(`/hr/me/notifications/${id}/read`, {});
    },
  };

  // ── Overview & employees ──
  overview = async () => unwrap(await apiClient.get<Envelope<HrOverview>>('/hr/overview'));
  employees = async (params: ListEmployeesParams) => unwrap(await apiClient.get<Envelope<Paginated<EmployeeListItem>>>('/hr/employees', { params }));
  employee = async (userId: string, month?: string) => unwrap(await apiClient.get<Envelope<EmployeeDetail>>(`/hr/employees/${userId}`, { params: { month } }));
  employeeAttendance = async (userId: string, month: string) => unwrap(await apiClient.get<Envelope<MonthAttendance>>(`/hr/employees/${userId}/attendance`, { params: { month } }));
  setWorkSetup = async (userId: string, p: WorkSetupPayload) => unwrap(await apiClient.put<Envelope<{ shift: Shift | null; weeklyOff: string[] }>>(`/hr/employees/${userId}/work-setup`, p));
  payStructure = async (userId: string) => unwrap(await apiClient.get<Envelope<PayStructure>>(`/hr/employees/${userId}/pay-structure`));
  savePayStructure = async (userId: string, p: PayStructurePayload) => unwrap(await apiClient.put<Envelope<PayStructure>>(`/hr/employees/${userId}/pay-structure`, p));

  // ── Attendance ──
  dayAttendance = async (date: string, params: { branchId?: string; search?: string }) => unwrap(await apiClient.get<Envelope<DayAttendanceResponse>>('/hr/attendance', { params: { date, ...params } }));
  monthlyGrid = async (month: string, branchId?: string) => unwrap(await apiClient.get<Envelope<MonthlyGridResponse>>('/hr/attendance/monthly', { params: { month, branchId } }));
  markAttendance = async (p: MarkAttendancePayload) => unwrap(await apiClient.put<Envelope<AttendanceDay>>('/hr/attendance', p));
  bulkAttendance = async (p: BulkAttendancePayload) => unwrap(await apiClient.post<Envelope<{ date: string; updated: number; items: AttendanceDay[] }>>('/hr/attendance/bulk', p));
  clearAttendance = async (userId: string, date: string, remark: string) =>
    unwrap(await apiClient.delete<Envelope<{ date: string; userId: string; status: string }>>('/hr/attendance', { params: { userId, date, remark } }));

  // ── Leaves ──
  leaves = async (params: ListLeavesParams) => unwrap(await apiClient.get<Envelope<LeaveListResponse>>('/hr/leaves', { params }));
  leaveCalendar = async (from: string, to: string) => unwrap(await apiClient.get<Envelope<LeaveCalendarResponse>>('/hr/leaves/calendar', { params: { from, to } }));
  leave = async (id: string) => unwrap(await apiClient.get<Envelope<LeaveRequestDetail>>(`/hr/leaves/${id}`));
  previewLeave = async (p: LeavePreviewPayload) => unwrap(await apiClient.post<Envelope<LeavePreview>>('/hr/leaves/preview', p, { silent: true }));
  applyOnBehalf = async (p: ApplyOnBehalfPayload) => unwrap(await apiClient.post<Envelope<LeaveRequest>>('/hr/leaves', p));
  approveLeave = async (id: string, remark?: string) => unwrap(await apiClient.post<Envelope<LeaveRequest>>(`/hr/leaves/${id}/approve`, remark ? { remark } : {}));
  rejectLeave = async (id: string, remark: string) => unwrap(await apiClient.post<Envelope<LeaveRequest>>(`/hr/leaves/${id}/reject`, { remark }));
  cancelLeave = async (id: string, remark: string) => unwrap(await apiClient.post<Envelope<LeaveRequest>>(`/hr/leaves/${id}/cancel`, { remark }));
  leaveBalances = async (params: { userId?: string; leaveYear?: number }) => unwrap(await apiClient.get<Envelope<LeaveBalancesResponse | AllLeaveBalancesResponse>>('/hr/leave-balances', { params }));
  adjustBalance = async (p: AdjustBalancePayload) => unwrap(await apiClient.post<Envelope<LeaveBalance>>('/hr/leave-balances/adjust', p));

  // ── Setup ──
  leaveTypes = async (includeInactive = false) => unwrap(await apiClient.get<Envelope<LeaveType[]>>('/hr/leave-types', { params: { includeInactive } }));
  createLeaveType = async (p: LeaveTypePayload) => unwrap(await apiClient.post<Envelope<LeaveType>>('/hr/leave-types', p));
  updateLeaveType = async (id: string, p: Partial<LeaveTypePayload> & { isActive?: boolean }) => unwrap(await apiClient.patch<Envelope<LeaveType>>(`/hr/leave-types/${id}`, p));
  deleteLeaveType = async (id: string) => {
    await apiClient.delete(`/hr/leave-types/${id}`);
  };
  holidays = async (params: { year?: number; from?: string; to?: string; branchId?: string }) => unwrap(await apiClient.get<Envelope<Holiday[]>>('/hr/holidays', { params }));
  createHoliday = async (p: HolidayPayload) => unwrap(await apiClient.post<Envelope<Holiday>>('/hr/holidays', p));
  updateHoliday = async (id: string, p: Partial<HolidayPayload>) => unwrap(await apiClient.patch<Envelope<Holiday>>(`/hr/holidays/${id}`, p));
  deleteHoliday = async (id: string) => {
    await apiClient.delete(`/hr/holidays/${id}`);
  };
  shifts = async () => unwrap(await apiClient.get<Envelope<Shift[]>>('/hr/shifts'));
  createShift = async (p: ShiftPayload) => unwrap(await apiClient.post<Envelope<Shift>>('/hr/shifts', p));
  updateShift = async (id: string, p: Partial<ShiftPayload> & { isActive?: boolean }) => unwrap(await apiClient.patch<Envelope<Shift>>(`/hr/shifts/${id}`, p));
  deleteShift = async (id: string) => {
    await apiClient.delete(`/hr/shifts/${id}`);
  };
  policy = async () => unwrap(await apiClient.get<Envelope<Policy>>('/hr/policy'));
  savePolicy = async (p: Partial<Omit<Policy, 'workingDaysBasis'>>) => unwrap(await apiClient.put<Envelope<Policy>>('/hr/policy', p));

  // ── Payroll ──
  runs = async (params: { page?: number; limit?: number }) => unwrap(await apiClient.get<Envelope<Paginated<PayrollRun>>>('/hr/payroll/runs', { params }));
  run = async (id: string) => unwrap(await apiClient.get<Envelope<PayrollRunDetail>>(`/hr/payroll/runs/${id}`));
  generateRun = async (month: string, notes?: string) => unwrap(await apiClient.post<Envelope<PayrollRunDetail>>('/hr/payroll/runs', { month, notes }));
  recalcRun = async (id: string) => unwrap(await apiClient.post<Envelope<PayrollRunDetail>>(`/hr/payroll/runs/${id}/recalculate`, {}));
  deleteRun = async (id: string) => {
    await apiClient.delete(`/hr/payroll/runs/${id}`);
  };
  approveRun = async (id: string) => unwrap(await apiClient.post<Envelope<PayrollRun>>(`/hr/payroll/runs/${id}/approve`, {}));
  patchPayslip = async (id: string, p: PayslipPatchPayload) => unwrap(await apiClient.patch<Envelope<Payslip>>(`/hr/payroll/payslips/${id}`, p));
  payslip = async (id: string) => unwrap(await apiClient.get<Envelope<Payslip>>(`/hr/payroll/payslips/${id}`));
  payslipPdf = (id: string) => openPdf(`/hr/payroll/payslips/${id}/pdf`);
  pay = async (id: string, p: PayPayload) => unwrap(await apiClient.post<Envelope<Payslip>>(`/hr/payroll/payslips/${id}/pay`, p));
  payAll = async (runId: string, p: PayPayload) => unwrap(await apiClient.post<Envelope<PayAllResult>>(`/hr/payroll/runs/${runId}/pay-all`, p));
}

export const hrService = new HrService();
