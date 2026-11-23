'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { toAuthServiceError } from '@/features/auth/services/api-client';
import { hrService } from '../services/hr.service';
import type {
  AdjustBalancePayload,
  ApplyLeavePayload,
  ApplyOnBehalfPayload,
  BulkAttendancePayload,
  HolidayPayload,
  LeavePreviewPayload,
  LeaveTypePayload,
  ListEmployeesParams,
  ListLeavesParams,
  MarkAttendancePayload,
  PayPayload,
  PayStructurePayload,
  PayslipPatchPayload,
  Policy,
  ShiftPayload,
  WorkSetupPayload,
  AllLeaveBalancesResponse,
  LeaveBalancesResponse,
} from '../types';

/** Every HR cache key starts with `['hr', ...]` so one invalidation refreshes overview, lists and badges together. */
export const hrKeys = {
  all: ['hr'] as const,
  me: ['hr', 'me'] as const,
  meSummary: ['hr', 'me', 'summary'] as const,
  meAttendance: (month: string) => ['hr', 'me', 'attendance', month] as const,
  meLeaves: (params: object) => ['hr', 'me', 'leaves', params] as const,
  mePayslips: (params: object) => ['hr', 'me', 'payslips', params] as const,
  mePayslip: (id: string) => ['hr', 'me', 'payslip', id] as const,
  meNotifications: (params: object) => ['hr', 'me', 'notifications', params] as const,
  overview: ['hr', 'overview'] as const,
  employees: (params: object) => ['hr', 'employees', params] as const,
  employee: (userId: string, month: string) => ['hr', 'employee', userId, month] as const,
  dayAttendance: (date: string, params: object) => ['hr', 'attendance', 'day', date, params] as const,
  grid: (month: string, branchId?: string) => ['hr', 'attendance', 'grid', month, branchId ?? ''] as const,
  leaves: (params: object) => ['hr', 'leaves', params] as const,
  leaveCalendar: (from: string, to: string) => ['hr', 'leaves', 'calendar', from, to] as const,
  leave: (id: string) => ['hr', 'leave', id] as const,
  balances: (params: object) => ['hr', 'balances', params] as const,
  leaveTypes: (inactive: boolean) => ['hr', 'setup', 'leave-types', inactive] as const,
  holidays: (params: object) => ['hr', 'setup', 'holidays', params] as const,
  shifts: ['hr', 'setup', 'shifts'] as const,
  policy: ['hr', 'setup', 'policy'] as const,
  runs: (params: object) => ['hr', 'payroll', 'runs', params] as const,
  run: (id: string) => ['hr', 'payroll', 'run', id] as const,
  payStructure: (userId: string) => ['hr', 'payroll', 'structure', userId] as const,
};

export function toHrError(error: unknown) {
  return toAuthServiceError(error);
}

/** The API's stable error code (`LEAVE_OVERLAP`, `ALREADY_CHECKED_IN`, ...), when present. */
export function hrErrorCode(error: unknown): string | undefined {
  return toAuthServiceError(error).details?.apiCode;
}

/** Field → message map from a 422's `errors[]`. */
export function hrFieldErrors(error: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of toAuthServiceError(error).details?.errors ?? []) {
    if (e.field && !out[e.field]) out[e.field] = e.message;
  }
  return out;
}

type Enabled = { enabled?: boolean };

// ── Self service ───────────────────────────────────────────────────────

export function useMeSummary(opts?: Enabled) {
  return useQuery({ queryKey: hrKeys.meSummary, queryFn: hrService.me.summary, enabled: opts?.enabled ?? true, staleTime: 30_000 });
}

export function useMeBalances(opts?: Enabled) {
  return useQuery({ queryKey: ['hr', 'me', 'balances'], queryFn: () => hrService.me.balances(), enabled: opts?.enabled ?? true });
}

export function useMeAttendance(month: string, opts?: Enabled) {
  return useQuery({ queryKey: hrKeys.meAttendance(month), queryFn: () => hrService.me.attendance(month), enabled: opts?.enabled ?? true, placeholderData: keepPreviousData });
}

export function useMeLeaveTypes(opts?: Enabled) {
  return useQuery({ queryKey: ['hr', 'me', 'leave-types'], queryFn: hrService.me.leaveTypes, enabled: opts?.enabled ?? true, staleTime: 5 * 60_000 });
}

export function useMeLeaves(params: { status?: string; page?: number; limit?: number }, opts?: Enabled) {
  return useQuery({ queryKey: hrKeys.meLeaves(params), queryFn: () => hrService.me.leaves(params), enabled: opts?.enabled ?? true, placeholderData: keepPreviousData });
}

export function useMePayslips(params: { page?: number; limit?: number }, opts?: Enabled) {
  return useQuery({ queryKey: hrKeys.mePayslips(params), queryFn: () => hrService.me.payslips(params), enabled: opts?.enabled ?? true });
}

export function useMePayslip(id: string | null) {
  return useQuery({ queryKey: hrKeys.mePayslip(id ?? ''), queryFn: () => hrService.me.payslip(id!), enabled: !!id });
}

export function useMeNotifications(params: { unreadOnly?: boolean; page?: number; limit?: number }, opts?: Enabled) {
  return useQuery({ queryKey: hrKeys.meNotifications(params), queryFn: () => hrService.me.notifications(params), enabled: opts?.enabled ?? true });
}

/** Live preview (days / excluded dates / balance) while the apply form is edited; the request is a POST read so it is keyed by its body. */
export function useLeavePreview(payload: LeavePreviewPayload | null, mode: 'me' | 'manager') {
  return useQuery({
    queryKey: ['hr', 'leave-preview', mode, payload],
    queryFn: () => (mode === 'me' ? hrService.me.previewLeave(payload!) : hrService.previewLeave(payload!)),
    enabled: !!payload,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 15_000,
  });
}

function useInvalidateHr() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: hrKeys.all });
}

/** Opt-in enrolment. Fired from a click only (never a mount effect). Refreshes every HR query: the summary now succeeds and the headcount changes. */
export function useEnrollMe() {
  const invalidate = useInvalidateHr();
  return useMutation({ mutationFn: () => hrService.me.enroll(), onSuccess: invalidate });
}

export function useCheckIn() {
  const invalidate = useInvalidateHr();
  return useMutation({ mutationFn: (note?: string) => hrService.me.checkIn(note), onSuccess: invalidate });
}

export function useCheckOut() {
  const invalidate = useInvalidateHr();
  return useMutation({ mutationFn: () => hrService.me.checkOut(), onSuccess: invalidate });
}

export function useApplyLeave() {
  const invalidate = useInvalidateHr();
  return useMutation({ mutationFn: (p: ApplyLeavePayload) => hrService.me.applyLeave(p), onSuccess: invalidate });
}

export function useCancelMyLeave() {
  const invalidate = useInvalidateHr();
  return useMutation({ mutationFn: ({ id, remark }: { id: string; remark?: string }) => hrService.me.cancelLeave(id, remark), onSuccess: invalidate });
}

export function useMarkNotificationsRead() {
  const invalidate = useInvalidateHr();
  return useMutation({ mutationFn: (id?: string) => (id ? hrService.me.read(id) : hrService.me.readAll()), onSuccess: invalidate });
}

// ── Manager reads ──────────────────────────────────────────────────────

export function useHrOverview(opts?: Enabled) {
  return useQuery({ queryKey: hrKeys.overview, queryFn: hrService.overview, enabled: opts?.enabled ?? true, staleTime: 30_000 });
}

export function useEmployees(params: ListEmployeesParams, opts?: Enabled) {
  return useQuery({ queryKey: hrKeys.employees(params), queryFn: () => hrService.employees(params), enabled: opts?.enabled ?? true, placeholderData: keepPreviousData });
}

export function useEmployee(userId: string, month: string) {
  return useQuery({ queryKey: hrKeys.employee(userId, month), queryFn: () => hrService.employee(userId, month), placeholderData: keepPreviousData });
}

export function useDayAttendance(date: string, params: { branchId?: string; search?: string }, opts?: Enabled) {
  return useQuery({ queryKey: hrKeys.dayAttendance(date, params), queryFn: () => hrService.dayAttendance(date, params), enabled: opts?.enabled ?? true, placeholderData: keepPreviousData });
}

export function useMonthlyGrid(month: string, branchId?: string, opts?: Enabled) {
  return useQuery({ queryKey: hrKeys.grid(month, branchId), queryFn: () => hrService.monthlyGrid(month, branchId), enabled: opts?.enabled ?? true, placeholderData: keepPreviousData });
}

export function useLeaves(params: ListLeavesParams, opts?: Enabled) {
  return useQuery({ queryKey: hrKeys.leaves(params), queryFn: () => hrService.leaves(params), enabled: opts?.enabled ?? true, placeholderData: keepPreviousData });
}

export function useLeaveCalendar(from: string, to: string, opts?: Enabled) {
  return useQuery({ queryKey: hrKeys.leaveCalendar(from, to), queryFn: () => hrService.leaveCalendar(from, to), enabled: opts?.enabled ?? true, placeholderData: keepPreviousData, retry: false });
}

export function useLeaveDetail(id: string | null) {
  return useQuery({ queryKey: hrKeys.leave(id ?? ''), queryFn: () => hrService.leave(id!), enabled: !!id });
}

export function useLeaveBalances(params: { userId?: string; leaveYear?: number }, opts?: Enabled) {
  return useQuery({
    queryKey: hrKeys.balances(params),
    queryFn: () => hrService.leaveBalances(params) as Promise<LeaveBalancesResponse | AllLeaveBalancesResponse>,
    enabled: opts?.enabled ?? true,
  });
}

export function useLeaveTypes(includeInactive = false, opts?: Enabled) {
  return useQuery({ queryKey: hrKeys.leaveTypes(includeInactive), queryFn: () => hrService.leaveTypes(includeInactive), enabled: opts?.enabled ?? true, staleTime: 60_000 });
}

export function useHolidays(params: { year?: number; from?: string; to?: string }, opts?: Enabled) {
  return useQuery({ queryKey: hrKeys.holidays(params), queryFn: () => hrService.holidays(params), enabled: opts?.enabled ?? true, staleTime: 60_000 });
}

export function useShifts(opts?: Enabled) {
  return useQuery({ queryKey: hrKeys.shifts, queryFn: hrService.shifts, enabled: opts?.enabled ?? true, staleTime: 60_000 });
}

export function usePolicy(opts?: Enabled) {
  return useQuery({ queryKey: hrKeys.policy, queryFn: hrService.policy, enabled: opts?.enabled ?? true, staleTime: 60_000 });
}

export function usePayrollRuns(params: { page?: number; limit?: number }, opts?: Enabled) {
  return useQuery({ queryKey: hrKeys.runs(params), queryFn: () => hrService.runs(params), enabled: opts?.enabled ?? true, placeholderData: keepPreviousData });
}

export function usePayrollRun(id: string | null) {
  return useQuery({ queryKey: hrKeys.run(id ?? ''), queryFn: () => hrService.run(id!), enabled: !!id });
}

export function usePayStructure(userId: string, opts?: Enabled) {
  return useQuery({ queryKey: hrKeys.payStructure(userId), queryFn: () => hrService.payStructure(userId), enabled: opts?.enabled ?? true });
}

// ── Manager mutations ──────────────────────────────────────────────────

export function useMarkAttendance() {
  const invalidate = useInvalidateHr();
  return useMutation({ mutationFn: (p: MarkAttendancePayload) => hrService.markAttendance(p), onSuccess: invalidate });
}

export function useBulkAttendance() {
  const invalidate = useInvalidateHr();
  return useMutation({ mutationFn: (p: BulkAttendancePayload) => hrService.bulkAttendance(p), onSuccess: invalidate });
}

export function useClearAttendance() {
  const invalidate = useInvalidateHr();
  return useMutation({ mutationFn: (v: { userId: string; date: string; remark: string }) => hrService.clearAttendance(v.userId, v.date, v.remark), onSuccess: invalidate });
}

export function useApplyOnBehalf() {
  const invalidate = useInvalidateHr();
  return useMutation({ mutationFn: (p: ApplyOnBehalfPayload) => hrService.applyOnBehalf(p), onSuccess: invalidate });
}

export function useApproveLeave() {
  const invalidate = useInvalidateHr();
  return useMutation({ mutationFn: ({ id, remark }: { id: string; remark?: string }) => hrService.approveLeave(id, remark), onSuccess: invalidate });
}

export function useRejectLeave() {
  const invalidate = useInvalidateHr();
  return useMutation({ mutationFn: ({ id, remark }: { id: string; remark: string }) => hrService.rejectLeave(id, remark), onSuccess: invalidate });
}

export function useCancelLeave() {
  const invalidate = useInvalidateHr();
  return useMutation({ mutationFn: ({ id, remark }: { id: string; remark: string }) => hrService.cancelLeave(id, remark), onSuccess: invalidate });
}

export function useAdjustBalance() {
  const invalidate = useInvalidateHr();
  return useMutation({ mutationFn: (p: AdjustBalancePayload) => hrService.adjustBalance(p), onSuccess: invalidate });
}

export function useSaveLeaveType() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: Partial<LeaveTypePayload> & { isActive?: boolean } }) =>
      id ? hrService.updateLeaveType(id, payload) : hrService.createLeaveType(payload as LeaveTypePayload),
    onSuccess: invalidate,
  });
}

export function useDeleteLeaveType() {
  const invalidate = useInvalidateHr();
  return useMutation({ mutationFn: (id: string) => hrService.deleteLeaveType(id), onSuccess: invalidate });
}

export function useCreateHoliday() {
  const invalidate = useInvalidateHr();
  return useMutation({ mutationFn: (p: HolidayPayload) => hrService.createHoliday(p), onSuccess: invalidate });
}

export function useDeleteHoliday() {
  const invalidate = useInvalidateHr();
  return useMutation({ mutationFn: (id: string) => hrService.deleteHoliday(id), onSuccess: invalidate });
}

export function useSaveShift() {
  const invalidate = useInvalidateHr();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: Partial<ShiftPayload> & { isActive?: boolean } }) =>
      id ? hrService.updateShift(id, payload) : hrService.createShift(payload as ShiftPayload),
    onSuccess: invalidate,
  });
}

export function useDeleteShift() {
  const invalidate = useInvalidateHr();
  return useMutation({ mutationFn: (id: string) => hrService.deleteShift(id), onSuccess: invalidate });
}

export function useSavePolicy() {
  const invalidate = useInvalidateHr();
  return useMutation({ mutationFn: (p: Partial<Omit<Policy, 'workingDaysBasis'>>) => hrService.savePolicy(p), onSuccess: invalidate });
}

export function useSetWorkSetup() {
  const invalidate = useInvalidateHr();
  return useMutation({ mutationFn: ({ userId, payload }: { userId: string; payload: WorkSetupPayload }) => hrService.setWorkSetup(userId, payload), onSuccess: invalidate });
}

export function useSavePayStructure() {
  const invalidate = useInvalidateHr();
  return useMutation({ mutationFn: ({ userId, payload }: { userId: string; payload: PayStructurePayload }) => hrService.savePayStructure(userId, payload), onSuccess: invalidate });
}

export function useGenerateRun() {
  const invalidate = useInvalidateHr();
  return useMutation({ mutationFn: ({ month, notes }: { month: string; notes?: string }) => hrService.generateRun(month, notes), onSuccess: invalidate });
}

export function useRecalcRun() {
  const invalidate = useInvalidateHr();
  return useMutation({ mutationFn: (id: string) => hrService.recalcRun(id), onSuccess: invalidate });
}

export function useDeleteRun() {
  const invalidate = useInvalidateHr();
  return useMutation({ mutationFn: (id: string) => hrService.deleteRun(id), onSuccess: invalidate });
}

export function useApproveRun() {
  const invalidate = useInvalidateHr();
  return useMutation({ mutationFn: (id: string) => hrService.approveRun(id), onSuccess: invalidate });
}

export function usePatchPayslip() {
  const invalidate = useInvalidateHr();
  return useMutation({ mutationFn: ({ id, payload }: { id: string; payload: PayslipPatchPayload }) => hrService.patchPayslip(id, payload), onSuccess: invalidate });
}

export function usePayPayslip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PayPayload }) => hrService.pay(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: hrKeys.all });
      // The payment creates an Expense (category SALARY), so the finance lists/summary are stale too.
      void qc.invalidateQueries({ queryKey: ['expenses'] });
      void qc.invalidateQueries({ queryKey: ['finance'] });
    },
  });
}

export function usePayAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ runId, payload }: { runId: string; payload: PayPayload }) => hrService.payAll(runId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: hrKeys.all });
      void qc.invalidateQueries({ queryKey: ['expenses'] });
      void qc.invalidateQueries({ queryKey: ['finance'] });
    },
  });
}
