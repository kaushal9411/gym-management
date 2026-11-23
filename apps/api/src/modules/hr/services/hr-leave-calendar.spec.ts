import { beforeEach, describe, expect, it, vi } from 'vitest';

import { leaveCalendarQuerySchema } from '../validators/hr.validators';

const state = vi.hoisted(() => ({
  scope: { allBranches: true, branchIds: [] as string[], primaryBranchId: null as string | null },
  employees: [] as Array<{ id: string; name: string }>,
  leaves: [] as Array<Record<string, unknown>>,
  holidays: [] as Array<Record<string, unknown>>,
  overlapArgs: null as unknown[] | null,
  employeeFilter: null as Record<string, unknown> | null,
}));

vi.mock('../../../infrastructure/database/tenant-scoped-client', () => ({ getTenantScopedClient: () => ({}) }));
vi.mock('../../authentication/middlewares/branch-access.middleware', () => ({ getBranchAccess: vi.fn(async () => state.scope) }));
vi.mock('../repositories/hr-leave.repository', () => ({
  HrLeaveRepository: class {
    openOverlapping = vi.fn(async (...args: unknown[]) => {
      state.overlapArgs = args;
      return state.leaves;
    });
  },
}));
vi.mock('../repositories/hr-employee.repository', () => ({
  HrEmployeeRepository: class {
    list = vi.fn(async (_t: string, f: Record<string, unknown>) => {
      state.employeeFilter = f;
      return { items: state.employees, total: state.employees.length };
    });
  },
}));
vi.mock('./hr-attendance.service', () => ({ HrAttendanceService: class { calendar = {}; } }));
vi.mock('./hr-config.service', () => ({
  HrConfigService: class {
    repo = { listHolidays: vi.fn(async () => state.holidays) };
  },
  toHolidayDto: (h: { id: string; date: Date; name: string; branchId: string | null }) => ({ id: h.id, date: h.date.toISOString().slice(0, 10), name: h.name, description: null, branch: h.branchId ? { id: h.branchId, name: 'B' } : null }),
}));
vi.mock('./hr-audit.service', () => ({ HrAudit: class { record = vi.fn(); } }));
vi.mock('./hr-notification.service', () => ({ HrNotificationService: class {} }));

import { HrLeaveService } from './hr-leave.service';

const type = { id: 't1', name: 'Casual Leave', code: 'CASUAL', color: '#6366f1', isPaid: true };
const leave = (over: Record<string, unknown>) => ({
  id: 'l1',
  userId: 'u1',
  leaveType: type,
  startDate: new Date('2026-11-25T00:00:00Z'),
  endDate: new Date('2026-11-26T00:00:00Z'),
  dayPart: 'FULL_DAY',
  days: 2,
  status: 'APPROVED',
  ...over,
});

describe('HrLeaveService.calendar', () => {
  const service = new HrLeaveService('tenant-1');

  beforeEach(() => {
    state.scope = { allBranches: true, branchIds: [], primaryBranchId: null };
    state.employees = [
      { id: 'u1', name: 'Vikram Coach' },
      { id: 'u2', name: 'Asha Desk' },
    ];
    state.leaves = [];
    state.holidays = [];
    state.overlapArgs = null;
    state.employeeFilter = null;
  });

  it('returns every overlapping PENDING/APPROVED leave (no 100-row cap), sorted by start date then name', async () => {
    state.leaves = [
      leave({ id: 'l3', userId: 'u1', startDate: new Date('2026-12-01T00:00:00Z'), endDate: new Date('2026-12-01T00:00:00Z'), days: 1, dayPart: 'HALF_DAY_MORNING', status: 'PENDING' }),
      leave({ id: 'l2', userId: 'u2' }),
      leave({ id: 'l1', userId: 'u1' }),
    ];
    const res = await service.calendar('2026-11-20', '2026-12-10', 'actor');
    expect(res.from).toBe('2026-11-20');
    expect(res.to).toBe('2026-12-10');
    expect(res.items.map((i) => i.id)).toEqual(['l2', 'l1', 'l3']); // Asha before Vikram on the same start date
    expect(res.items[0]).toEqual({
      id: 'l2',
      userId: 'u2',
      employeeName: 'Asha Desk',
      leaveType: type,
      startDate: '2026-11-25',
      endDate: '2026-11-26',
      dayPart: 'FULL_DAY',
      days: 2,
      status: 'APPROVED',
    });
    expect(res.items[2]).toMatchObject({ dayPart: 'HALF_DAY_MORNING', status: 'PENDING', days: 1 });
    // only PENDING/APPROVED requests are fetched, for exactly the in-scope employees, for the exact window
    expect(state.overlapArgs).toEqual(['tenant-1', ['u1', 'u2'], '2026-11-20', '2026-12-10']);
  });

  it('includes the holidays of the window', async () => {
    state.holidays = [{ id: 'h1', date: new Date('2026-11-24T00:00:00Z'), name: 'Guru Nanak Jayanti', branchId: null }];
    const res = await service.calendar('2026-11-20', '2026-12-10', 'actor');
    expect(res.holidays).toEqual([{ id: 'h1', date: '2026-11-24', name: 'Guru Nanak Jayanti', description: null, branch: null }]);
  });

  it('branch-restricted actors: employee list is restricted and other branches\' holidays are hidden', async () => {
    state.scope = { allBranches: false, branchIds: ['b1'], primaryBranchId: 'b1' };
    state.holidays = [
      { id: 'h1', date: new Date('2026-11-24T00:00:00Z'), name: 'All', branchId: null },
      { id: 'h2', date: new Date('2026-11-25T00:00:00Z'), name: 'Mine', branchId: 'b1' },
      { id: 'h3', date: new Date('2026-11-26T00:00:00Z'), name: 'Other branch', branchId: 'b2' },
    ];
    const res = await service.calendar('2026-11-20', '2026-12-10', 'actor');
    expect(state.employeeFilter).toMatchObject({ restrictToBranchIds: ['b1'] });
    expect(res.holidays.map((h) => h.id)).toEqual(['h1', 'h2']);
  });

  it('no visible employees => no leaves and no leave query', async () => {
    state.employees = [];
    state.leaves = [leave({})];
    const res = await service.calendar('2026-11-20', '2026-12-10', 'actor');
    expect(res.items).toEqual([]);
    expect(state.overlapArgs).toBeNull();
  });
});

describe('leaveCalendarQuerySchema', () => {
  it('accepts a window of up to 62 days inclusive', () => {
    expect(leaveCalendarQuerySchema.safeParse({ from: '2026-11-01', to: '2026-11-01' }).success).toBe(true);
    expect(leaveCalendarQuerySchema.safeParse({ from: '2026-11-01', to: '2026-12-31' }).success).toBe(true); // 61 days
    expect(leaveCalendarQuerySchema.safeParse({ from: '2026-11-01', to: '2027-01-01' }).success).toBe(true); // 62 days
  });
  it('rejects 63+ days, inverted ranges and missing/invalid bounds', () => {
    const tooLong = leaveCalendarQuerySchema.safeParse({ from: '2026-11-01', to: '2027-01-02' }); // 63 days
    expect(tooLong.success).toBe(false);
    expect(leaveCalendarQuerySchema.safeParse({ from: '2026-11-10', to: '2026-11-09' }).success).toBe(false);
    expect(leaveCalendarQuerySchema.safeParse({ from: '2026-11-10' }).success).toBe(false);
    expect(leaveCalendarQuerySchema.safeParse({ from: '2026-13-10', to: '2026-13-11' }).success).toBe(false);
  });
});
