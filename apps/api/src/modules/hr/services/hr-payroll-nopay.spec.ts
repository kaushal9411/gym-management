import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ audits: [] as Array<Record<string, unknown>>, existing: [] as Array<Record<string, unknown>> }));

vi.mock('../../../infrastructure/database/tenant-scoped-client', () => ({ getTenantScopedClient: () => ({}) }));
vi.mock('../repositories/hr-payroll.repository', () => ({
  HrPayrollRepository: class {
    findRunByMonth = vi.fn(async () => null);
    createRun = vi.fn(async () => ({ id: 'run-1', month: '2026-11', status: 'DRAFT' }));
    findRun = vi.fn(async () => ({ id: 'run-1', month: '2026-11', status: 'DRAFT' }));
    listByRun = vi.fn(async () => state.existing);
    updatePayslip = vi.fn(async () => undefined);
  },
}));
vi.mock('../repositories/hr-employee.repository', () => ({ HrEmployeeRepository: class {} }));
vi.mock('../repositories/hr-attendance.repository', () => ({ HrAttendanceRepository: class {} }));
vi.mock('./hr-config.service', () => ({ HrConfigService: class {} }));
vi.mock('./hr-calendar.service', () => ({ HrCalendarService: class {} }));
vi.mock('./hr-audit.service', () => ({
  HrAudit: class {
    record = vi.fn(async (_a: unknown, action: string, _t: string, _id: string, detail: Record<string, unknown>) => void state.audits.push({ action, ...detail }));
  },
}));
vi.mock('./hr-notification.service', () => ({ HrNotificationService: class {} }));
vi.mock('../../finance/services/expense.service', () => ({ ExpenseService: class {} }));

import { hasPay, HrPayrollService, splitByPay } from './hr-payroll.service';

const emp = (id: string, salaryAmount: number | null) => ({ id, staffProfile: { salaryAmount, joiningDate: new Date('2026-01-01T00:00:00Z') } }) as never;
const actor = { userId: 'owner-1', role: 'OWNER' };

describe('payroll skips employees with no pay set', () => {
  it('hasPay / splitByPay: null and 0 are unpaid; any positive amount is payable', () => {
    expect(hasPay(emp('a', null))).toBe(false);
    expect(hasPay(emp('a', 0))).toBe(false);
    expect(hasPay(emp('a', 18000))).toBe(true);
    const { payable, skippedNoPay } = splitByPay([emp('a', 18000), emp('b', null), emp('c', 0), emp('d', 250.5)]);
    expect(payable.map((e: { id: string }) => e.id)).toEqual(['a', 'd']);
    expect(skippedNoPay.map((e: { id: string }) => e.id)).toEqual(['b', 'c']);
  });

  describe('generate() / recalculate()', () => {
    const service = new HrPayrollService('tenant-1');
    const inserted: string[] = [];
    let computedFor: string[] = [];

    beforeEach(() => {
      state.audits = [];
      state.existing = [];
      inserted.length = 0;
      computedFor = [];
      const s = service as unknown as Record<string, unknown>;
      s.eligibleEmployees = vi.fn(async () => [emp('paid-1', 20000), emp('nopay-1', null), emp('nopay-2', 0)]);
      s.computeFor = vi.fn(async (employees: Array<{ id: string }>) => {
        computedFor = employees.map((e) => e.id);
        return new Map(employees.map((e) => [e.id, {}]));
      });
      s.insertPayslip = vi.fn(async (_run: unknown, e: { id: string }) => void inserted.push(e.id));
      s.refreshTotals = vi.fn(async () => undefined);
      s.runDetail = vi.fn(async () => ({ run: { id: 'run-1' }, payslips: [] }));
    });

    it('generate creates payslips only for employees with a salary and reports skippedNoPay', async () => {
      const res = await service.generate({ month: '2026-11' }, actor);
      expect(inserted).toEqual(['paid-1']);
      expect(computedFor).toEqual(['paid-1']);
      expect(res.skippedNoPay).toBe(2);
      expect(state.audits[0]).toMatchObject({ action: 'hr.payroll_generated', employees: 1, skippedNoPay: 2 });
    });

    it('recalculate keeps an existing draft payslip of a now-unpaid employee but never creates new ones for them', async () => {
      state.existing = [{ id: 'slip-nopay', userId: 'nopay-1', status: 'DRAFT', bonus: 0, advanceRecovery: 0, lines: [] }];
      const res = await service.recalculate('run-1', actor);
      expect(computedFor.sort()).toEqual(['nopay-1', 'paid-1']);
      expect(inserted).toEqual(['paid-1']);
      expect(res.skippedNoPay).toBe(1); // nopay-2 only
    });
  });
});
