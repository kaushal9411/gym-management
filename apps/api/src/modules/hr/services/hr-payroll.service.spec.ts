import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  slip: null as Record<string, unknown> | null,
  run: null as Record<string, unknown> | null,
  claim: true,
  unpaidLeft: 1,
  expenseError: null as Error | null,
  calls: [] as string[],
  expenseInputs: [] as Array<Record<string, unknown>>,
  notified: [] as Array<Record<string, unknown>>,
  slipsInRun: [] as Array<Record<string, unknown>>,
}));

vi.mock('../../../infrastructure/database/tenant-scoped-client', () => ({ getTenantScopedClient: () => ({}) }));
vi.mock('../../authentication/middlewares/branch-access.middleware', () => ({ getBranchAccess: vi.fn(async () => ({ allBranches: true, branchIds: [], primaryBranchId: null })) }));
vi.mock('../repositories/hr-payroll.repository', () => ({
  HrPayrollRepository: class {
    findPayslip = vi.fn(async () => state.slip);
    findRun = vi.fn(async () => state.run);
    claimPaid = vi.fn(async () => {
      state.calls.push('claim');
      return state.claim;
    });
    releaseClaim = vi.fn(async () => {
      state.calls.push('release');
    });
    updatePayslip = vi.fn(async (_id: string, data: Record<string, unknown>) => {
      state.calls.push(`update:${Object.keys(data).join(',')}`);
      return { ...state.slip, ...data };
    });
    countUnpaid = vi.fn(async () => state.unpaidLeft);
    updateRun = vi.fn(async () => {
      state.calls.push('run-paid');
    });
    listByRun = vi.fn(async () => state.slipsInRun);
    paidByRun = vi.fn(async () => new Map());
  },
}));
vi.mock('../repositories/hr-employee.repository', () => ({
  HrEmployeeRepository: class {
    refsFor = vi.fn(async () => new Map());
    namesFor = vi.fn(async () => new Map());
  },
}));
vi.mock('../repositories/hr-attendance.repository', () => ({ HrAttendanceRepository: class {} }));
vi.mock('./hr-config.service', () => ({ HrConfigService: class {} }));
vi.mock('./hr-calendar.service', () => ({ HrCalendarService: class {} }));
vi.mock('./hr-audit.service', () => ({ HrAudit: class { record = vi.fn(async () => undefined); } }));
vi.mock('./hr-notification.service', () => ({
  HrNotificationService: class {
    notify = vi.fn(async (_ids: string[], n: Record<string, unknown>) => {
      state.notified.push(n);
    });
  },
}));
vi.mock('../../finance/services/expense.service', () => ({
  ExpenseService: class {
    create = vi.fn(async (input: Record<string, unknown>) => {
      if (state.expenseError) throw state.expenseError;
      state.expenseInputs.push(input);
      state.calls.push('expense');
      return { id: 'expense-1' };
    });
  },
}));

import { HrPayrollService } from './hr-payroll.service';

const actor = { userId: 'owner-1', role: 'OWNER' };
const slip = (over: Record<string, unknown> = {}) => ({
  id: 'slip-1',
  runId: 'run-1',
  userId: 'emp-1',
  month: '2026-11',
  status: 'DRAFT',
  employeeCode: 'EMP-0002',
  employeeName: 'Hr Trainer',
  roleName: 'TRAINER',
  netPay: 17830,
  lines: [],
  notes: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});
const zeros = ['salaryType', 'workingDays', 'presentDays', 'halfDays', 'paidLeaveDays', 'unpaidLeaveDays', 'absentDays', 'holidayDays', 'weeklyOffDays', 'notEmployedDays', 'lateCount', 'overtimeMinutes', 'unpaidDays', 'dailyRate', 'baseSalary', 'fixedAllowances', 'monthlyGross', 'attendanceDeduction', 'overtimePay', 'extraAllowances', 'bonus', 'grossEarnings', 'fixedDeductions', 'extraDeductions', 'latePenalty', 'advanceRecovery', 'totalDeductions'];
const withZeros = (s: Record<string, unknown>) => ({ ...Object.fromEntries(zeros.map((k) => [k, k === 'salaryType' ? 'MONTHLY' : 0])), ...s });

describe('HrPayrollService#pay — one Expense, never twice', () => {
  const service = new HrPayrollService('tenant-1');

  beforeEach(() => {
    state.slip = withZeros(slip());
    state.run = { id: 'run-1', month: '2026-11', status: 'APPROVED' };
    state.claim = true;
    state.unpaidLeft = 1;
    state.expenseError = null;
    state.calls = [];
    state.expenseInputs = [];
    state.notified = [];
    state.slipsInRun = [];
  });

  it('creates exactly one SALARY expense for the net amount, links it, and notifies the employee', async () => {
    await service.pay('slip-1', { paymentMode: 'UPI', paidOn: '2026-11-22' }, actor);
    expect(state.expenseInputs).toHaveLength(1);
    expect(state.expenseInputs[0]).toMatchObject({ category: 'SALARY', amount: 17830, expenseDate: '2026-11-22' });
    expect(String(state.expenseInputs[0]!.description)).toContain('Hr Trainer');
    expect(String(state.expenseInputs[0]!.description)).toContain('Nov 2026');
    expect(state.calls).toEqual(['claim', 'expense', 'update:expenseId']);
    expect(state.notified).toHaveLength(1);
    expect(state.notified[0]).toMatchObject({ type: 'PAYSLIP_PAID', entityType: 'payslip' });
  });

  it('a payslip that is already PAID is rejected with 409 ALREADY_PAID and creates nothing', async () => {
    state.slip = withZeros(slip({ status: 'PAID' }));
    await expect(service.pay('slip-1', { paymentMode: 'CASH' }, actor)).rejects.toMatchObject({ code: 'ALREADY_PAID', httpStatus: 409 });
    expect(state.expenseInputs).toHaveLength(0);
    expect(state.calls).toEqual([]);
  });

  it('losing the atomic DRAFT -> PAID claim (concurrent request) is 409 and creates no expense', async () => {
    state.claim = false;
    await expect(service.pay('slip-1', { paymentMode: 'CASH' }, actor)).rejects.toMatchObject({ code: 'ALREADY_PAID' });
    expect(state.expenseInputs).toHaveLength(0);
  });

  it('refuses to pay until the run is approved', async () => {
    state.run = { id: 'run-1', month: '2026-11', status: 'DRAFT' };
    await expect(service.pay('slip-1', { paymentMode: 'CASH' }, actor)).rejects.toMatchObject({ code: 'INVALID_STATE' });
    expect(state.calls).toEqual([]);
  });

  it('releases the claim when the expense cannot be written, so the payslip can be retried', async () => {
    state.expenseError = new Error('db down');
    await expect(service.pay('slip-1', { paymentMode: 'CASH' }, actor)).rejects.toThrow('db down');
    expect(state.calls).toEqual(['claim', 'release']);
    expect(state.notified).toHaveLength(0);
  });

  it('a zero net payslip is marked paid without an expense row', async () => {
    state.slip = withZeros(slip({ netPay: 0 }));
    await service.pay('slip-1', { paymentMode: 'CASH' }, actor);
    expect(state.expenseInputs).toHaveLength(0);
    expect(state.calls).toEqual(['claim']);
  });

  it('closes the run once the last payslip is paid', async () => {
    state.unpaidLeft = 0;
    await service.pay('slip-1', { paymentMode: 'CASH' }, actor);
    expect(state.calls).toContain('run-paid');
  });

  it('rejects a future payment date', async () => {
    await expect(service.pay('slip-1', { paymentMode: 'CASH', paidOn: '2099-01-01' }, actor)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(state.calls).toEqual([]);
  });
});

describe('HrPayrollService#payAll', () => {
  const service = new HrPayrollService('tenant-1');

  it('pays unpaid slips, skips paid ones and reports failures without stopping', async () => {
    state.calls = [];
    state.expenseInputs = [];
    state.run = { id: 'run-1', month: '2026-11', status: 'APPROVED', createdBy: null, approvedBy: null, totalGross: 0, totalDeductions: 0, totalNet: 0, employeeCount: 3, createdAt: new Date() };
    state.slipsInRun = [{ id: 'a', status: 'PAID' }, { id: 'b', status: 'DRAFT' }];
    state.slip = withZeros(slip({ id: 'b' }));
    state.claim = true;
    state.unpaidLeft = 1;
    const r = await service.payAll('run-1', { paymentMode: 'BANK_TRANSFER' }, actor);
    expect(r.paid).toBe(1);
    expect(r.skipped).toBe(1);
    expect(r.failed).toEqual([]);
    expect(state.expenseInputs).toHaveLength(1);
  });
});
