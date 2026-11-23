import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  audits: [] as Array<{ action: string; detail: Record<string, unknown> }>,
  transitioned: 0,
}));

vi.mock('../../../infrastructure/database/tenant-scoped-client', () => ({ getTenantScopedClient: () => ({}) }));
vi.mock('../../authentication/middlewares/branch-access.middleware', () => ({ getBranchAccess: vi.fn(async () => ({ allBranches: true, branchIds: [], primaryBranchId: null })) }));
vi.mock('../repositories/hr-leave.repository', () => ({
  HrLeaveRepository: class {
    findById = vi.fn(async () => (state.row ? { ...state.row, status: state.transitioned ? 'APPROVED' : state.row.status } : null));
    transition = vi.fn(async () => {
      state.transitioned += 1;
      return true;
    });
  },
}));
vi.mock('../repositories/hr-employee.repository', () => ({
  HrEmployeeRepository: class {
    findOne = vi.fn(async (_t: string, id: string) => ({ id, name: 'Kaushal', staffProfile: {} }));
    refsFor = vi.fn(async () => new Map());
    namesFor = vi.fn(async () => new Map());
    userIdsWithPermission = vi.fn(async () => []);
  },
}));
vi.mock('./hr-attendance.service', () => ({
  HrAttendanceService: class {
    calendar = {
      contexts: vi.fn(async (emps: Array<{ id: string }>) => new Map(emps.map((e) => [e.id, { weeklyOff: new Set(['SUNDAY']), branchIds: [], shift: null }]))),
      holidayMap: () => new Map(),
    };
    writeLeaveRows = vi.fn(async () => 1);
  },
}));
vi.mock('./hr-config.service', () => ({
  HrConfigService: class {
    repo = { listHolidays: vi.fn(async () => []) };
  },
  toHolidayDto: (h: unknown) => h,
}));
vi.mock('./hr-audit.service', () => ({
  HrAudit: class {
    record = vi.fn(async (_a: unknown, action: string, _t: string, _id: string, detail: Record<string, unknown>) => void state.audits.push({ action, detail }));
  },
}));
vi.mock('./hr-notification.service', () => ({ HrNotificationService: class { notify = vi.fn(async () => undefined); } }));

import { HrLeaveService, mayDecideOwnLeave } from './hr-leave.service';

const leave = (over: Record<string, unknown> = {}) => ({
  id: 'leave-1',
  userId: 'person-1',
  status: 'PENDING',
  startDate: new Date('2026-12-10T00:00:00Z'), // a Thursday
  endDate: new Date('2026-12-10T00:00:00Z'),
  dayPart: 'FULL_DAY',
  days: 1,
  leaveYear: 2026,
  leaveTypeId: 't1',
  leaveType: { id: 't1', name: 'Casual Leave', code: 'CASUAL', color: '#6366f1', isPaid: true, yearlyQuota: null },
  reason: 'x',
  appliedOnBehalf: false,
  appliedBy: 'person-1',
  decidedBy: null,
  decidedAt: null,
  decisionRemark: null,
  cancelledAt: null,
  createdAt: new Date(),
  ...over,
});

describe('who may approve their own leave', () => {
  const service = new HrLeaveService('tenant-1');
  const owner = { userId: 'person-1', role: 'OWNER' };
  const manager = { userId: 'person-1', role: 'MANAGER' };

  beforeEach(() => {
    state.row = leave();
    state.audits = [];
    state.transitioned = 0;
  });

  it('only the OWNER role is allowed', () => {
    expect(mayDecideOwnLeave(owner)).toBe(true);
    expect(mayDecideOwnLeave(manager)).toBe(false);
    expect(mayDecideOwnLeave({ userId: 'x', role: 'TRAINER' })).toBe(false);
  });

  it('a MANAGER still cannot approve their own request (403, nothing written)', async () => {
    await expect(service.approve('leave-1', undefined, manager)).rejects.toMatchObject({ code: 'FORBIDDEN', httpStatus: 403 });
    expect(state.transitioned).toBe(0);
    expect(state.audits).toEqual([]);
  });

  it('the OWNER can approve their own request and the audit row says selfApproved: true', async () => {
    const res = await service.approve('leave-1', 'Owner approval', owner);
    expect(res.status).toBe('APPROVED');
    expect(state.transitioned).toBe(1);
    const audit = state.audits.find((a) => a.action === 'hr.leave_approved');
    expect(audit?.detail).toMatchObject({ userId: 'person-1', selfApproved: true });
  });

  it('approving someone else request as owner is a normal approval (no selfApproved flag)', async () => {
    state.row = leave({ userId: 'emp-9' });
    await service.approve('leave-1', undefined, owner);
    const audit = state.audits.find((a) => a.action === 'hr.leave_approved');
    expect(audit?.detail).not.toHaveProperty('selfApproved');
  });

  it('rejecting your own request stays forbidden, even for the owner', async () => {
    await expect(service.reject('leave-1', 'nope', owner)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
