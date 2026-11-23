import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  profiles: new Map<string, Record<string, unknown>>(),
  user: { id: 'owner-1', name: 'Kaushal Singh Chauhan', deletedAt: null } as Record<string, unknown> | null,
  defaultShift: { id: 'shift-1', name: 'General', isActive: true } as Record<string, unknown> | null,
  shifts: new Map<string, Record<string, unknown>>(),
  taken: [] as string[],
  created: [] as Array<Record<string, unknown>>,
  audits: [] as Array<{ action: string; entityId: string | undefined; detail: Record<string, unknown> }>,
  failCreateOnce: null as 'userId' | 'employeeId' | null,
  userLookupTenant: '' as string,
}));

vi.mock('../../../infrastructure/database/tenant-scoped-client', () => ({
  getTenantScopedClient: () => ({
    user: {
      findFirst: vi.fn(async ({ where }: { where: { tenantId: string } }) => {
        state.userLookupTenant = where.tenantId;
        return state.user;
      }),
    },
  }),
}));
vi.mock('../../staff/repositories/staff-profile.repository', () => ({
  StaffProfileRepository: class {
    findByUserId = vi.fn(async (userId: string) => state.profiles.get(userId) ?? null);
    nextEmployeeId = vi.fn(async () => (state.taken.length ? `EMP-000${state.taken.length + 1}` : 'EMP-0001'));
    create = vi.fn(async (data: Record<string, unknown>) => {
      if (state.failCreateOnce === 'employeeId') {
        state.failCreateOnce = null;
        state.taken.push(String(data.employeeId));
        throw new Error('unique(tenant_id, employee_id)');
      }
      if (state.failCreateOnce === 'userId') {
        state.failCreateOnce = null;
        state.profiles.set(String(data.userId), { userId: data.userId }); // the concurrent request won
        throw new Error('unique(user_id)');
      }
      state.created.push(data);
      state.profiles.set(String(data.userId), data);
      return data;
    });
  },
}));
vi.mock('./hr-config.service', () => ({
  HrConfigService: class {
    repo = { findDefaultShift: vi.fn(async () => state.defaultShift) };
    ensureDefaults = vi.fn(async () => ({}));
    mustFindShift = vi.fn(async (id: string) => {
      const s = state.shifts.get(id);
      if (!s) throw Object.assign(new Error('Shift not found.'), { code: 'NOT_FOUND', httpStatus: 404 });
      return s;
    });
  },
}));
vi.mock('./hr-audit.service', () => ({
  HrAudit: class {
    record = vi.fn(async (_a: unknown, action: string, _t: string, entityId: string | undefined, detail: Record<string, unknown>) => void state.audits.push({ action, entityId, detail }));
  },
}));
vi.mock('./hr-self.service', () => ({ HrSelfService: class { summary = vi.fn(async (userId: string) => ({ employee: { userId }, today: {}, month: {} })); } }));

import { HrEnrollmentService, splitName } from './hr-enrollment.service';

const owner = { userId: 'owner-1', role: 'OWNER' };

describe('POST /hr/me/enroll - HrEnrollmentService', () => {
  const service = new HrEnrollmentService('tenant-1');

  beforeEach(() => {
    state.profiles = new Map();
    state.user = { id: 'owner-1', name: 'Kaushal Singh Chauhan', deletedAt: null };
    state.defaultShift = { id: 'shift-1', name: 'General', isActive: true };
    state.shifts = new Map();
    state.taken = [];
    state.created = [];
    state.audits = [];
    state.failCreateOnce = null;
  });

  it('creates the callers own profile with the documented defaults and returns the /hr/me/summary shape', async () => {
    const res = await service.enroll('owner-1', {}, owner);
    expect(state.created).toHaveLength(1);
    expect(state.created[0]).toMatchObject({
      tenantId: 'tenant-1',
      userId: 'owner-1',
      employeeId: 'EMP-0001',
      firstName: 'Kaushal',
      lastName: 'Singh Chauhan',
      employmentType: 'FULL_TIME',
      salaryType: 'MONTHLY',
      salaryAmount: null,
      shift: 'General',
      shiftId: 'shift-1',
      weeklyOff: null,
      workStatus: 'WORKING',
    });
    expect((state.created[0]!.joiningDate as Date).toISOString()).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
    expect(res).toMatchObject({ employee: { userId: 'owner-1' } });
  });

  it('the second call is 409 ALREADY_EMPLOYEE and creates nothing', async () => {
    await service.enroll('owner-1', {}, owner);
    await expect(service.enroll('owner-1', {}, owner)).rejects.toMatchObject({ code: 'ALREADY_EMPLOYEE', httpStatus: 409 });
    expect(state.created).toHaveLength(1);
  });

  it('a concurrent enrol that wins the unique(user_id) race is reported as 409, not 500', async () => {
    state.failCreateOnce = 'userId';
    await expect(service.enroll('owner-1', {}, owner)).rejects.toMatchObject({ code: 'ALREADY_EMPLOYEE' });
  });

  it('uses the employee-id generator and retries when the number was taken meanwhile', async () => {
    state.failCreateOnce = 'employeeId';
    await service.enroll('owner-1', {}, owner);
    expect(state.created).toHaveLength(1);
    expect(state.created[0]!.employeeId).toBe('EMP-0002');
  });

  it('is tenant scoped: the user is looked up and the profile created in the callers tenant only', async () => {
    await service.enroll('owner-1', {}, owner);
    expect(state.userLookupTenant).toBe('tenant-1');
    expect(state.created[0]!.tenantId).toBe('tenant-1');
  });

  it('writes an hr.employee_enrolled audit row (who + employeeId)', async () => {
    await service.enroll('owner-1', {}, owner);
    expect(state.audits).toEqual([{ action: 'hr.employee_enrolled', entityId: 'owner-1', detail: expect.objectContaining({ employeeId: 'EMP-0001', shift: 'General', selfEnrolled: true }) }]);
  });

  it('no default shift enrols without a shift; an explicit shiftId is honoured; an inactive one is refused', async () => {
    state.defaultShift = null;
    await service.enroll('owner-1', {}, owner);
    expect(state.created[0]).toMatchObject({ shift: null, shiftId: null });

    state.profiles = new Map();
    state.created = [];
    state.shifts.set('s2', { id: 's2', name: 'Morning', isActive: true });
    await service.enroll('owner-1', { shiftId: 's2' }, owner);
    expect(state.created[0]).toMatchObject({ shift: 'Morning', shiftId: 's2' });

    state.profiles = new Map();
    state.shifts.set('s3', { id: 's3', name: 'Old', isActive: false });
    await expect(service.enroll('owner-1', { shiftId: 's3' }, owner)).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });

  it('a deleted or unknown user cannot enrol', async () => {
    state.user = null;
    await expect(service.enroll('owner-1', {}, owner)).rejects.toMatchObject({ httpStatus: 404 });
  });
});

describe('splitName', () => {
  it('splits first / rest and tolerates single names and extra spaces', () => {
    expect(splitName('  Kaushal   Chauhan ')).toEqual({ firstName: 'Kaushal', lastName: 'Chauhan' });
    expect(splitName('Madonna')).toEqual({ firstName: 'Madonna', lastName: '' });
  });
});
