import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { phoneStorageVariants } from '../../../core/utils/phone-match.util';

const state = vi.hoisted(() => ({
  /** `phone` = the phone as stored for that staff user (defaults to 9876500000). */
  users: [] as Array<{ tenant: Record<string, unknown>; phone?: string }>,
  /** `phone` = the phone as it was typed when the member was created (hashed as-is). */
  members: [] as Array<{ tenant: Record<string, unknown>; phone?: string }>,
  staffCalls: [] as string[],
  memberCalls: [] as string[],
  staffVerify: new Map<string, () => unknown>(),
  memberVerify: new Map<string, () => unknown>(),
  failingTenants: new Set<string>(),
}));

vi.mock('../../../infrastructure/database/prisma', () => ({
  prisma: {
    user: { findMany: vi.fn(async () => state.users) },
    // phone lookups run raw SQL: the mock plays "SQL returned every staff row"; the service's own phonesMatch must do the matching
    $queryRaw: vi.fn(async () => state.users.map((u) => ({ tenant_id: (u.tenant as { id: string }).id, phone: u.phone ?? '9876500000' }))),
    tenant: { findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => state.users.map((u) => u.tenant).filter((t) => where.id.in.includes((t as { id: string }).id))) },
    member: {
      findMany: vi.fn(async (args?: { where?: { phoneHash?: { in: string[] } } }) => {
        const wanted = args?.where?.phoneHash?.in;
        return wanted ? state.members.filter((m) => wanted.includes(`hash:${m.phone ?? '9876500000'}`)) : state.members;
      }),
    },
  },
}));
vi.mock('../../members/utils/member-pii.util', () => ({ phoneHashCandidates: (p: string) => phoneStorageVariants(p).map((v) => `hash:${v}`) }));
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

  it('verify: every response names the plane that matched (actorType)', async () => {
    state.users = [{ tenant: tenant('a') }];
    state.members = [{ tenant: tenant('m1') }];
    state.staffVerify.set('a', () => ({ accessToken: 't' }));
    state.memberVerify.set('m1', () => ({ accessToken: 'mt' }));
    expect(await service.verifyPhoneOtp('9876500000', 'staff', '123456', {})).toMatchObject({ actorType: 'staff', tenantSlug: 'slug-a' });
    expect(await service.verifyPhoneOtp('9876500000', 'member', '123456', {})).toMatchObject({ actorType: 'member', tenantSlug: 'slug-m1' });
  });

  describe('phone matching ignores country code, spaces, dashes and a leading 0', () => {
    const typedVariants = ['9876500000', '+91 98765 00000', '+919876500000', '91 98765-00000', '09876500000', ' 98765 00000 ', '+91-9876500000'];

    it.each(typedVariants)('staff stored as "+91 98765 00000" matches typed "%s"', async (typed) => {
      state.users = [{ tenant: tenant('a'), phone: '+91 98765 00000' }];
      await service.requestPhoneOtp(typed, 'staff');
      expect(state.staffCalls).toEqual([`otp:a:${typed}`]);
    });

    it.each(['+91 98765 00000', '+919876500000', '09876500000', '98765-00000'])('staff stored as plain 9876500000 matches typed "%s"', async (typed) => {
      state.users = [{ tenant: tenant('a'), phone: '9876500000' }];
      await service.requestPhoneOtp(typed, 'staff');
      expect(state.staffCalls).toEqual([`otp:a:${typed}`]);
    });

    it('staff: a different number, a too-short number and a foreign number sharing 10 trailing digits do NOT match', async () => {
      state.users = [{ tenant: tenant('a'), phone: '+91 98765 00000' }];
      for (const typed of ['9876500001', '+91 98765 0000', '12345', '+1 9876500000 ']) await service.requestPhoneOtp(typed, 'staff');
      expect(state.staffCalls).toEqual([]);
      state.users = [{ tenant: tenant('a'), phone: '+44 7911 123456' }];
      await service.requestPhoneOtp('7911123456', 'staff'); // UK stored; Indian-shaped typed 10 digits must not match
      expect(state.staffCalls).toEqual([]);
    });

    it('staff: non-Indian numbers match on identical digits regardless of formatting', async () => {
      state.users = [{ tenant: tenant('a'), phone: '+44 7911 123456' }];
      await service.requestPhoneOtp('+447911123456', 'staff');
      expect(state.staffCalls).toEqual(['otp:a:+447911123456']);
    });

    it('staff: matches in several gyms, ignoring gyms whose number differs', async () => {
      state.users = [
        { tenant: tenant('a'), phone: '+91 98765 00000' },
        { tenant: tenant('b'), phone: '9876500000' },
        { tenant: tenant('c'), phone: '9876511111' },
      ];
      await service.requestPhoneOtp('+91 9876500000', 'staff');
      expect(state.staffCalls).toEqual(['otp:a:+91 9876500000', 'otp:b:+91 9876500000']);
    });

    it('verify: a typed +91 number logs in to the gym that stored it with spaces', async () => {
      state.users = [{ tenant: tenant('a'), phone: '+91 98765 00000' }];
      state.staffVerify.set('a', () => ({ accessToken: 't' }));
      expect(await service.verifyPhoneOtp('9876500000', 'staff', '123456', {})).toMatchObject({ actorType: 'staff', tenantSlug: 'slug-a', accessToken: 't' });
    });

    it.each(['9876500000', '+91 98765 00000', '+919876500000', '09876500000', '98765-00000'])('member stored as "+91 98765 00000" matches typed "%s" (hash of the stored variant is tried)', async (typed) => {
      state.members = [{ tenant: tenant('m1'), phone: '+91 98765 00000' }];
      await service.requestPhoneOtp(typed, 'member');
      expect(state.memberCalls).toEqual([`otp:m1:${typed}`]);
    });

    it('member stored as plain 9876500000 matches typed "+91 98765 00000"', async () => {
      state.members = [{ tenant: tenant('m1'), phone: '9876500000' }];
      await service.requestPhoneOtp('+91 98765 00000', 'member');
      expect(state.memberCalls).toEqual(['otp:m1:+91 98765 00000']);
    });

    it('member: a different number does not match', async () => {
      state.members = [{ tenant: tenant('m1'), phone: '9876500001' }];
      await service.requestPhoneOtp('+91 98765 00000', 'member');
      expect(state.memberCalls).toEqual([]);
    });

    it('a non-matching typed number is still a silent no-op on the any plane', async () => {
      state.users = [{ tenant: tenant('a'), phone: '+91 98765 00000' }];
      state.members = [{ tenant: tenant('m1'), phone: '9876500001' }];
      await expect(service.requestPhoneOtp('9000000000', 'any')).resolves.toBeUndefined();
      expect(state.staffCalls).toEqual([]);
      expect(state.memberCalls).toEqual([]);
    });
  });

  describe("actorType 'any' — the phone number does not say staff or member", () => {
    it('request: staff-only phone emails the staff gym and touches no member flow', async () => {
      state.users = [{ tenant: tenant('a') }];
      await service.requestPhoneOtp('9876500000', 'any');
      expect(state.staffCalls).toEqual(['otp:a:9876500000']);
      expect(state.memberCalls).toEqual([]);
    });

    it('request: member-only phone emails the member gym only', async () => {
      state.members = [{ tenant: tenant('m1') }];
      await service.requestPhoneOtp('9876500000', 'any');
      expect(state.memberCalls).toEqual(['otp:m1:9876500000']);
      expect(state.staffCalls).toEqual([]);
    });

    it('request: omitting actorType behaves as any and covers BOTH planes', async () => {
      state.users = [{ tenant: tenant('a') }, { tenant: tenant('b') }];
      state.members = [{ tenant: tenant('m1') }];
      await service.requestPhoneOtp('9876500000');
      expect(state.staffCalls).toEqual(['otp:a:9876500000', 'otp:b:9876500000']);
      expect(state.memberCalls).toEqual(['otp:m1:9876500000']);
    });

    it('request: no account anywhere is a silent no-op (no existence leak)', async () => {
      await expect(service.requestPhoneOtp('1112223333', 'any')).resolves.toBeUndefined();
      expect(state.staffCalls).toEqual([]);
      expect(state.memberCalls).toEqual([]);
    });

    it('verify: staff-only phone signs in as staff', async () => {
      state.users = [{ tenant: tenant('a') }];
      state.staffVerify.set('a', () => ({ accessToken: 't', user: { id: 'u' } }));
      expect(await service.verifyPhoneOtp('9876500000', 'any', '123456', {})).toMatchObject({ actorType: 'staff', tenantSlug: 'slug-a', accessToken: 't' });
    });

    it('verify: member-only phone falls through the staff plane to the member', async () => {
      state.members = [{ tenant: tenant('m1') }];
      state.memberVerify.set('m1', () => ({ accessToken: 'mt', member: { id: 'm' } }));
      expect(await service.verifyPhoneOtp('9876500000', 'any', '123456', {})).toMatchObject({ actorType: 'member', tenantSlug: 'slug-m1', accessToken: 'mt' });
    });

    it('verify: a phone on BOTH planes resolves to whichever plane the code belongs to', async () => {
      state.users = [{ tenant: tenant('a') }];
      state.members = [{ tenant: tenant('m1') }];
      // Code was issued by the member plane only: staff rejects it, member accepts.
      state.memberVerify.set('m1', () => ({ accessToken: 'mt' }));
      expect(await service.verifyPhoneOtp('9876500000', 'any', '123456', {})).toMatchObject({ actorType: 'member', tenantSlug: 'slug-m1' });
      // Both would accept: the staff plane is tried first.
      state.staffVerify.set('a', () => ({ accessToken: 't' }));
      expect(await service.verifyPhoneOtp('9876500000', 'any', '123456', {})).toMatchObject({ actorType: 'staff', tenantSlug: 'slug-a' });
    });

    it('verify: no matching account looks identical to a wrong code', async () => {
      await expect(service.verifyPhoneOtp('1112223333', 'any', '123456', {})).rejects.toMatchObject({ code: ErrorCode.OTP_INVALID, httpStatus: 401 });
    });

    it('verify: wrong code on both planes is a generic OTP_INVALID', async () => {
      state.users = [{ tenant: tenant('a') }];
      state.members = [{ tenant: tenant('m1') }];
      await expect(service.verifyPhoneOtp('9876500000', 'any', '000000', {})).rejects.toMatchObject({ code: ErrorCode.OTP_INVALID });
    });

    it('verify: an expired code on one plane is reported when nothing else succeeds', async () => {
      state.users = [{ tenant: tenant('a') }];
      state.members = [{ tenant: tenant('m1') }];
      state.staffVerify.set('a', () => Promise.reject(new AppError(ErrorCode.OTP_EXPIRED, 'old', 401)));
      await expect(service.verifyPhoneOtp('9876500000', 'any', '123456', {})).rejects.toMatchObject({ code: ErrorCode.OTP_EXPIRED });
    });
  });
});
