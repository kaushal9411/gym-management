import { beforeEach, describe, expect, it, vi } from 'vitest';

const TENANT = '00000000-0000-0000-0000-0000000000aa';
const MEMBER_A = '11111111-1111-1111-1111-111111111111';
const MEMBER_B = '22222222-2222-2222-2222-222222222222';

const state = vi.hoisted(() => ({
  updates: [] as Array<{ id: string; data: Record<string, unknown> }>,
  audits: [] as Array<Record<string, unknown>>,
  emailOwner: null as string | null,
  phoneOwner: null as string | null,
  passwordOk: true,
  verifyCalls: 0,
  uploaded: [] as string[],
  deleted: [] as Array<string | null | undefined>,
}));

const row = (id: string) => ({
  id,
  memberId: id === '1' ? 'MEM-A' : 'MEM-B',
  firstName: 'Ann',
  lastName: 'Lee',
  email: 'ann@x.com',
  phone: '111',
  profilePhotoUrl: 'http://h/uploads/public/member-photos/old.png',
  qrCodeImageUrl: null,
  dateOfBirth: null,
  gender: null,
  status: 'ACTIVE',
  joiningDate: new Date('2026-01-01'),
  branch: { id: 'b', name: 'Main' },
  trainer: null,
  memberships: [],
});

vi.mock('../../../infrastructure/database/tenant-scoped-client', () => ({
  getTenantScopedClient: () => ({}),
}));
vi.mock('../../members/repositories/member.repository', () => ({
  MemberRepository: class {
    async findDetail(_t: string, id: string) {
      return row(id);
    }
    async findByEmail() {
      return state.emailOwner ? { id: state.emailOwner } : null;
    }
    async findByPhone() {
      return state.phoneOwner ? { id: state.phoneOwner } : null;
    }
    async update(id: string, data: Record<string, unknown>) {
      state.updates.push({ id, data });
    }
  },
}));
vi.mock('../../authentication/repositories/audit-log.repository', () => ({
  AuditLogRepository: class {
    async record(input: Record<string, unknown>) {
      state.audits.push(input);
    }
  },
}));
vi.mock('../../member-auth/services/member-auth.service', async () => {
  const { ValidationError } = (await vi.importActual('../../../core/errors/app-error')) as {
    ValidationError: new (message: string) => Error;
  };
  return {
    MemberAuthService: class {
      async verifyCurrentPassword() {
        state.verifyCalls += 1;
        if (!state.passwordOk) throw new ValidationError('Current password is incorrect');
      }
    },
  };
});
vi.mock('../../../core/storage/storage.service', () => ({
  uploadDataUrl: async () => {
    state.uploaded.push('x');
    return 'http://h/uploads/public/member-photos/new.png';
  },
  deleteStoredMemberPhoto: async (u: string) => {
    state.deleted.push(u);
  },
}));
vi.mock('../../../infrastructure/queue/email.queue', () => ({
  enqueueEmail: async () => undefined,
}));
vi.mock('../../tenants/service/tenant.service', () => ({
  tenantService: { resolveById: async () => null },
}));

import { ConflictError, ValidationError } from '../../../core/errors/app-error';

import { MemberProfileService } from './member-profile.service';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const PNG_URL = `data:image/png;base64,${PNG.toString('base64')}`;
const ctx = {};

beforeEach(() => {
  Object.assign(state, {
    updates: [],
    audits: [],
    emailOwner: null,
    phoneOwner: null,
    passwordOk: true,
    verifyCalls: 0,
    uploaded: [],
    deleted: [],
  });
});

describe('MemberProfileService', () => {
  it('email change without a password fails and writes nothing', async () => {
    await expect(new MemberProfileService(TENANT).update('1', { email: 'new@x.com' }, ctx)).rejects.toBeInstanceOf(ValidationError);
    expect(state.updates).toHaveLength(0);
  });

  it('email change with a wrong password fails and writes nothing', async () => {
    state.passwordOk = false;
    await expect(new MemberProfileService(TENANT).update('1', { email: 'new@x.com', currentPassword: 'bad' }, ctx)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(state.verifyCalls).toBe(1);
    expect(state.updates).toHaveLength(0);
  });

  it('duplicate email (owned by another member) is rejected with 409; own email is not a clash', async () => {
    state.emailOwner = MEMBER_B;
    await expect(new MemberProfileService(TENANT).update('1', { email: 'taken@x.com', currentPassword: 'pw' }, ctx)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(state.updates).toHaveLength(0);
    state.emailOwner = '1';
    await expect(new MemberProfileService(TENANT).update('1', { email: 'mine@x.com', currentPassword: 'pw' }, ctx)).resolves.toBeDefined();
  });

  it('duplicate phone is rejected', async () => {
    state.phoneOwner = MEMBER_B;
    await expect(new MemberProfileService(TENANT).update('1', { phone: '999' }, ctx)).rejects.toBeInstanceOf(ConflictError);
  });

  it('non-email edit needs no password and audits field NAMES only (no values)', async () => {
    await new MemberProfileService(TENANT).update('1', { city: 'Pune', goal: 'ENDURANCE' }, ctx);
    expect(state.verifyCalls).toBe(0);
    expect(state.updates).toEqual([{ id: '1', data: { city: 'Pune', goal: 'ENDURANCE' } }]);
    const audit = state.audits[0]!;
    expect(audit).toMatchObject({
      actorUserId: null,
      actorRole: 'MEMBER',
      action: 'member_portal.profile_updated',
      entityId: '1',
    });
    expect(JSON.stringify(audit.after)).not.toContain('Pune');
  });

  it('isolation: every write targets exactly the id passed from the token (routes take no id)', async () => {
    await new MemberProfileService(TENANT).update(MEMBER_A, { city: 'X' }, ctx);
    expect(state.updates.every((u) => u.id === MEMBER_A)).toBe(true);
    expect(state.updates.some((u) => u.id === MEMBER_B)).toBe(false);
  });

  it('photo upload replaces the old object and audits; bad bytes are rejected before storage', async () => {
    await expect(new MemberProfileService(TENANT).uploadPhoto('1', 'data:image/png;base64,PHN2Zz4=', ctx)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(state.uploaded).toHaveLength(0);
    const res = await new MemberProfileService(TENANT).uploadPhoto('1', PNG_URL, ctx);
    expect(res.profilePhotoUrl).toContain('new.png');
    expect(state.deleted).toEqual(['http://h/uploads/public/member-photos/old.png']);
    expect(state.audits[0]).toMatchObject({ action: 'member_portal.photo_updated' });
  });

  it('photo removal nulls the column, deletes the object, audits', async () => {
    await new MemberProfileService(TENANT).removePhoto('1', ctx);
    expect(state.updates[0]).toEqual({ id: '1', data: { profilePhotoUrl: null } });
    expect(state.deleted).toHaveLength(1);
    expect(state.audits[0]).toMatchObject({ action: 'member_portal.photo_removed' });
  });
});
