import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';

const state = vi.hoisted(() => ({
  users: [] as Array<{ tenant: Record<string, unknown> }>,
  members: [] as Array<{ tenant: Record<string, unknown> }>,
  staffCalls: [] as string[],
  memberCalls: [] as string[],
  staffVerify: new Map<string, () => unknown>(),
  memberVerify: new Map<string, () => unknown>(),
  failingTenants: new Set<string>(),
}));

vi.mock('../../../infrastructure/database/prisma', () => ({
  prisma: {
    user: { findMany: vi.fn(async () => state.users) },
    member: { findMany: vi.fn(async () => state.members) },
  },
}));
vi.mock('../../members/utils/member-pii.util', () => ({ hashPhone: (p: string) => `hash:${p}` }));
vi.mock('../../authentication/utils/auth-module.factory', () => ({
  buildAuthModule: (tenantId: string) => ({
    forgotPassword: async (email: string) => {
      if (state.failingTenants.has(tenantId)) throw new Error('boom');
      state.staffCalls.push(`forgot:${tenantId}:${email}`);
    },
    requestPhoneLoginOtp: async (phone: string) => void state.staffCalls.push(`otp:${tenantId}:${phone}`),
    verifyPhoneLoginOtp: async () => state.staffVerify.get(tenantId)?.() ?? Promise.reject(new AppError(ErrorCode.OTP_INVALID, 'bad', 401)),
  }),
}));
vi.mock('../../member-auth/services/member-auth.service', () => ({
  MemberAuthService: class {
    constructor(private readonly tenantId: string) {}
    async forgotPassword(code: string) {
      state.memberCalls.push(`forgot:${this.tenantId}:${code}`);
    }
    async requestPhoneLoginOtp(phone: string) {
      state.memberCalls.push(`otp:${this.tenantId}:${phone}`);
    }
    async verifyPhoneLoginOtp() {
      return state.memberVerify.get(this.tenantId)?.() ?? Promise.reject(new AppError(ErrorCode.OTP_INVALID, 'bad', 401));
    }
  },
}));

import { CrossGymAccessService } from './cross-gym-access.service';

const tenant = (id: string, over: Record<string, unknown> = {}) => ({ id, slug: `slug-${id}`, status: 'ACTIVE', maintenanceMode: false, deletedAt: null, ...over });

describe('CrossGymAccessService — forgot password / phone login with no gym picker', () => {
  const service = new CrossGymAccessService();

  beforeEach(() => {
    state.users = [];
    state.members = [];
    state.staffCalls = [];
    state.memberCalls = [];
    state.staffVerify = new Map();
    state.memberVerify = new Map();
    state.failingTenants = new Set();
  });

  it('forgot password: an email runs the staff flow in EVERY matching gym', async () => {
    state.users = [{ tenant: tenant('a') }, { tenant: tenant('b') }];
    await service.forgotPassword('Coach@Gym.com');
    expect(state.staffCalls).toEqual(['forgot:a:coach@gym.com', 'forgot:b:coach@gym.com']);
    expect(state.memberCalls).toEqual([]);
  });

  it('forgot password: a Member ID runs the member flow, never the staff one', async () => {
    state.members = [{ tenant: tenant('a') }];
    await service.forgotPassword('MEM-0007');
    expect(state.memberCalls).toEqual(['forgot:a:MEM-0007']);
    expect(state.staffCalls).toEqual([]);
  });

  it('skips gyms a login could not succeed against (suspended, in maintenance, deleted)', async () => {
    state.users = [
      { tenant: tenant('ok') },
      { tenant: tenant('sus', { status: 'SUSPENDED' }) },
      { tenant: tenant('mnt', { maintenanceMode: true }) },
      { tenant: tenant('del', { deletedAt: new Date() }) },
    ];
    await service.forgotPassword('a@b.com');
    expect(state.staffCalls).toEqual(['forgot:ok:a@b.com']);
  });

  it('never throws and never reveals anything when nothing matches', async () => {
    await expect(service.forgotPassword('nobody@nowhere.com')).resolves.toBeUndefined();
    await expect(service.requestPhoneOtp('9990001111', 'staff')).resolves.toBeUndefined();
  });

  it('one gym failing does not stop the others', async () => {
    state.users = [{ tenant: tenant('a') }, { tenant: tenant('b') }];
    state.failingTenants.add('a');
    await service.forgotPassword('x@y.com');
    expect(state.staffCalls).toEqual(['forgot:b:x@y.com']);
  });

  it('phone OTP request goes to each matching gym of the chosen plane only', async () => {
    state.users = [{ tenant: tenant('a') }];
    state.members = [{ tenant: tenant('m1') }];
    await service.requestPhoneOtp('9876500000', 'staff');
    expect(state.staffCalls).toEqual(['otp:a:9876500000']);
    expect(state.memberCalls).toEqual([]);
    await service.requestPhoneOtp('9876500000', 'member');
    expect(state.memberCalls).toEqual(['otp:m1:9876500000']);
  });

  it('verify: the gym whose code it is logs in, and the answer names that gym', async () => {
    state.users = [{ tenant: tenant('a') }, { tenant: tenant('b') }];
    state.staffVerify.set('b', () => ({ accessToken: 't', user: { id: 'u' } }));
    const result = await service.verifyPhoneOtp('9876500000', 'staff', '123456', {});
    expect(result).toMatchObject({ accessToken: 't', tenantSlug: 'slug-b' });
  });

  it('verify: a 2FA challenge from the matching gym is passed through with its gym', async () => {
    state.users = [{ tenant: tenant('a') }];
    state.staffVerify.set('a', () => ({ challenge: 'otp_required', email: 'x@y.com', purpose: '2fa' }));
    expect(await service.verifyPhoneOtp('9876500000', 'staff', '123456', {})).toMatchObject({ challenge: 'otp_required', tenantSlug: 'slug-a' });
  });

  it('verify: wrong code everywhere is a generic OTP_INVALID (no gym is revealed)', async () => {
    state.users = [{ tenant: tenant('a') }, { tenant: tenant('b') }];
    await expect(service.verifyPhoneOtp('9876500000', 'staff', '000000', {})).rejects.toMatchObject({ code: ErrorCode.OTP_INVALID, httpStatus: 401 });
  });

  it('verify: no matching account at all looks identical to a wrong code', async () => {
    await expect(service.verifyPhoneOtp('1112223333', 'member', '123456', {})).rejects.toMatchObject({ code: ErrorCode.OTP_INVALID });
  });

  it('verify: reports an expired code when that is the only failure seen', async () => {
    state.members = [{ tenant: tenant('a') }];
    state.memberVerify.set('a', () => Promise.reject(new AppError(ErrorCode.OTP_EXPIRED, 'old', 401)));
    await expect(service.verifyPhoneOtp('9876500000', 'member', '123456', {})).rejects.toMatchObject({ code: ErrorCode.OTP_EXPIRED });
  });
});
