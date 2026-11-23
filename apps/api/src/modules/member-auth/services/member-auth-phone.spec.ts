import { beforeEach, describe, expect, it, vi } from 'vitest';

import { encryptEmail, encryptPhone, hashPhone } from '../../members/utils/member-pii.util';

const state = vi.hoisted(() => ({
  members: [] as Array<Record<string, unknown>>,
  emitted: [] as Array<Record<string, unknown>>,
  credential: { id: 'cred-1', status: 'ACTIVE', lockedUntil: null as Date | null } as Record<string, unknown> | null,
}));

vi.mock('../../../infrastructure/database/tenant-scoped-client', () => ({
  getTenantScopedClient: () => ({
    member: {
      findMany: vi.fn(async ({ where }: { where: { phoneHash: { in: string[] } } }) => state.members.filter((m) => where.phoneHash.in.includes(m.phoneHash as string))),
    },
  }),
}));
vi.mock('../../../core/events/event-bus', () => ({
  eventBus: { emitEvent: vi.fn((_name: string, payload: Record<string, unknown>) => void state.emitted.push(payload)) },
}));
vi.mock('../../authentication/repositories/audit-log.repository', () => ({ AuditLogRepository: class { record = vi.fn(); } }));
vi.mock('../repositories/member-credential.repository', () => ({ MemberCredentialRepository: class { findByMemberId = vi.fn(async () => state.credential); } }));
vi.mock('../repositories/member-otp.repository', () => ({ MemberOtpRepository: class { createOtp = vi.fn(async () => undefined); getLatestOtpIssuedAt = vi.fn(async () => null); } }));
vi.mock('../repositories/member-session.repository', () => ({ MemberSessionRepository: class {} }));
vi.mock('../repositories/member-verification.repository', () => ({ MemberVerificationRepository: class {} }));

import { MemberAuthService } from './member-auth.service';

/** A member whose phone was typed (and therefore blind-indexed) exactly as `typed`. */
const member = (id: string, typed: string) => ({
  id,
  firstName: 'Asha',
  lastName: 'Rao',
  email: encryptEmail(`${id}@example.com`),
  phone: encryptPhone(typed),
  phoneHash: hashPhone(typed),
  deletedAt: null,
});

describe('MemberAuthService phone login: +91 / spaces / dashes / leading 0', () => {
  const service = new MemberAuthService('tenant-1');

  beforeEach(() => {
    state.members = [];
    state.emitted = [];
    state.credential = { id: 'cred-1', status: 'ACTIVE', lockedUntil: null };
  });

  it.each(['9876500000', '+91 98765 00000', '+919876500000', '09876500000', '98765-00000', ' 91 9876500000 '])('stored "+91 98765 00000" is found by typed "%s"', async (typed) => {
    state.members = [member('m1', '+91 98765 00000')];
    await service.requestPhoneLoginOtp(typed);
    expect(state.emitted).toHaveLength(1);
    expect(state.emitted[0]).toMatchObject({ memberId: 'm1', phone: '+91 98765 00000' });
  });

  it.each(['+91 98765 00000', '+919876500000', '09876500000'])('stored plain "9876500000" is found by typed "%s"', async (typed) => {
    state.members = [member('m1', '9876500000')];
    await service.requestPhoneLoginOtp(typed);
    expect(state.emitted).toHaveLength(1);
  });

  it('a different number, a partial number or a foreign number with the same trailing digits finds nobody (silent success)', async () => {
    state.members = [member('m1', '+91 98765 00000')];
    for (const typed of ['9876500001', '98765 0000', '+1 9876500000']) await expect(service.requestPhoneLoginOtp(typed)).resolves.toBeUndefined();
    expect(state.emitted).toEqual([]);
  });

  it('verify with a formatted number finds the member (and a non-matching one is a generic OTP_INVALID)', async () => {
    state.members = [member('m1', '+91 98765 00000')];
    await expect(service.verifyPhoneLoginOtp('9000000000', '123456', {})).rejects.toMatchObject({ code: 'OTP_INVALID', httpStatus: 401 });
  });

  it('an inactive / locked portal credential still never leaks: no OTP is issued', async () => {
    state.members = [member('m1', '+91 98765 00000')];
    state.credential = { id: 'cred-1', status: 'SUSPENDED', lockedUntil: null };
    await service.requestPhoneLoginOtp('9876500000');
    expect(state.emitted).toEqual([]);
  });
});
