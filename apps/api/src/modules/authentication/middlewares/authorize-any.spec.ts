import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ perms: [] as string[] }));

vi.mock('../../../infrastructure/cache/redis', () => ({ cache: { get: vi.fn(async () => state.perms), set: vi.fn() } }));
vi.mock('../../../infrastructure/database/tenant-scoped-client', () => ({ getTenantScopedClient: () => ({}) }));
vi.mock('../repositories/role.repository', () => ({ RoleRepository: class {} }));

import { requireAnyPermission, requirePermission } from './authorize.middleware';

const run = async (mw: ReturnType<typeof requireAnyPermission>) => {
  const next = vi.fn();
  await mw({ auth: { sub: 'u1', permVer: 1 }, tenant: { id: 't1' } } as never, {} as never, next);
  return next.mock.calls[0]?.[0] as { code?: string; httpStatus?: number; message?: string } | undefined;
};

describe('requireAnyPermission (used by POST /hr/me/enroll)', () => {
  beforeEach(() => {
    state.perms = [];
  });

  it('passes with either self key', async () => {
    state.perms = ['hr:self_leave'];
    expect(await run(requireAnyPermission('hr:self_attendance', 'hr:self_leave'))).toBeUndefined();
    state.perms = ['hr:self_attendance'];
    expect(await run(requireAnyPermission('hr:self_attendance', 'hr:self_leave'))).toBeUndefined();
  });

  it('is 403 without any of the keys (e.g. only hr:self_payslip or hr:view)', async () => {
    state.perms = ['hr:self_payslip', 'hr:view'];
    const err = await run(requireAnyPermission('hr:self_attendance', 'hr:self_leave'));
    expect(err).toMatchObject({ code: 'FORBIDDEN', httpStatus: 403 });
    expect(err?.message).toContain('hr:self_attendance or hr:self_leave');
  });

  it('requirePermission behaves as before (single key, same message)', async () => {
    state.perms = ['x'];
    const err = await run(requirePermission('hr:view'));
    expect(err).toMatchObject({ code: 'FORBIDDEN' });
    expect(err?.message).toBe('Missing required permission: hr:view');
  });
});
