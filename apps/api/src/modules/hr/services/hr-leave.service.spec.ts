import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  transitionOk: true,
  calls: [] as string[],
  notified: [] as Array<Record<string, unknown>>,
  employee: { id: 'emp-1', name: 'Hr Trainer' } as Record<string, unknown> | null,
}));

vi.mock('../../../infrastructure/database/tenant-scoped-client', () => ({ getTenantScopedClient: () => ({}) }));
vi.mock('../../authentication/middlewares/branch-access.middleware', () => ({ getBranchAccess: vi.fn(async () => ({ allBranches: true, branchIds: [], primaryBranchId: null })) }));
vi.mock('../repositories/hr-leave.repository', () => ({
  HrLeaveRepository: class {
    findById = vi.fn(async () => state.row);
    transition = vi.fn(async () => {
      state.calls.push('transition');
      return state.transitionOk;
    });
  },
}));
vi.mock('../repositories/hr-employee.repository', () => ({
  HrEmployeeRepository: class {
    findOne = vi.fn(async () => state.employee);
    userIdsWithPermission = vi.fn(async () => ['approver-1', 'emp-1']);
    refsFor = vi.fn(async () => new Map());
    namesFor = vi.fn(async () => new Map([['emp-1', 'Hr Trainer']]));
  },
}));
vi.mock('./hr-attendance.service', () => ({
  HrAttendanceService: class {
    calendar = {};
    removeLeaveRows = vi.fn(async () => {
      state.calls.push('remove-rows');
      return 2;
    });
  },
}));
vi.mock('./hr-config.service', () => ({ HrConfigService: class {} }));
vi.mock('./hr-audit.service', () => ({ HrAudit: class { record = vi.fn(async () => undefined); } }));
vi.mock('./hr-notification.service', () => ({
  HrNotificationService: class {
    notify = vi.fn(async (ids: string[], n: Record<string, unknown>) => {
      state.notified.push({ ids, ...n });
    });
  },
}));

import { HrLeaveService } from './hr-leave.service';

const manager = { userId: 'mgr-1', role: 'MANAGER' };
const employeeActor = { userId: 'emp-1', role: 'TRAINER' };
const row = (over: Record<string, unknown> = {}) => ({
  id: 'leave-1',
  userId: 'emp-1',
  status: 'PENDING',
  startDate: new Date('2026-12-10T00:00:00Z'),
  endDate: new Date('2026-12-10T00:00:00Z'),
  dayPart: 'FULL_DAY',
  days: 1,
  leaveYear: 2026,
  leaveTypeId: 'type-1',
  leaveType: { id: 'type-1', name: 'Casual Leave', code: 'CASUAL', color: '#6366f1', isPaid: true, yearlyQuota: 12 },
  reason: 'x',
  appliedOnBehalf: false,
  appliedBy: 'emp-1',
  decidedBy: null,
  decidedAt: null,
  decisionRemark: null,
  cancelledAt: null,
  createdAt: new Date(),
  ...over,
});

describe('HrLeaveService decisions', () => {
  const service = new HrLeaveService('tenant-1');

  beforeEach(() => {
    state.row = row();
    state.transitionOk = true;
    state.calls = [];
    state.notified = [];
    state.employee = { id: 'emp-1', name: 'Hr Trainer' };
  });

  it('nobody can approve or reject their own request', async () => {
    await expect(service.approve('leave-1', undefined, employeeActor)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(service.reject('leave-1', 'no way', employeeActor)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(state.calls).toEqual([]);
  });

  it('only PENDING requests can be rejected; the decision is race-safe', async () => {
    state.row = row({ status: 'APPROVED' });
    await expect(service.reject('leave-1', 'late', manager)).rejects.toMatchObject({ code: 'INVALID_STATE', httpStatus: 409 });
    state.row = row();
    state.transitionOk = false; // someone else decided first
    await expect(service.reject('leave-1', 'late', manager)).rejects.toMatchObject({ code: 'INVALID_STATE' });
    expect(state.notified).toHaveLength(0);
  });

  it('rejecting notifies the applicant with the remark', async () => {
    state.transitionOk = true;
    // after the transition the service re-reads the row; give it the rejected state
    await service.reject('leave-1', 'Peak week', manager).catch(() => undefined);
    expect(state.notified).toHaveLength(1);
    expect(state.notified[0]).toMatchObject({ ids: ['emp-1'], type: 'LEAVE_REJECTED' });
    expect(String(state.notified[0]!.body)).toContain('Peak week');
    expect(String(state.notified[0]!.body)).toContain('10 Dec 2026'); // human IST date, not 2026-12-10
    expect(String(state.notified[0]!.body)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('an employee may cancel a pending request, notifying approvers (not themselves)', async () => {
    await service.cancel('leave-1', undefined, employeeActor, 'self').catch(() => undefined);
    expect(state.notified[0]).toMatchObject({ ids: ['approver-1'], type: 'LEAVE_CANCELLED' });
    expect(String(state.notified[0]!.body)).toContain('on 10 Dec 2026.');
    expect(state.calls).not.toContain('remove-rows');
  });

  it('cancelling an APPROVED future leave removes the attendance rows it wrote', async () => {
    state.row = row({ status: 'APPROVED', startDate: new Date('2099-01-05T00:00:00Z'), endDate: new Date('2099-01-05T00:00:00Z') });
    await service.cancel('leave-1', undefined, employeeActor, 'self').catch(() => undefined);
    expect(state.calls).toContain('remove-rows');
  });

  it('an employee cannot cancel an approved leave that already started, nor someone else\'s request', async () => {
    state.row = row({ status: 'APPROVED', startDate: new Date('2020-01-05T00:00:00Z'), endDate: new Date('2020-01-06T00:00:00Z') });
    await expect(service.cancel('leave-1', undefined, employeeActor, 'self')).rejects.toMatchObject({ code: 'INVALID_STATE' });
    state.row = row();
    await expect(service.cancel('leave-1', undefined, { userId: 'someone-else', role: 'TRAINER' }, 'self')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('terminal requests cannot be cancelled again', async () => {
    state.row = row({ status: 'REJECTED' });
    await expect(service.cancel('leave-1', 'x', manager, 'hr')).rejects.toMatchObject({ code: 'INVALID_STATE' });
    state.row = row({ status: 'CANCELLED' });
    await expect(service.cancel('leave-1', 'x', manager, 'hr')).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });
});
