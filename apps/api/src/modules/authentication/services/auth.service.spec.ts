import { describe, expect, it, vi } from 'vitest';

import { passwordService } from '../../../core/security/password.service';
import type {
  IAuditLogRepository,
  ILoginHistoryRepository,
  IRoleRepository,
  ISessionRepository,
  IUserRepository,
  IVerificationRepository,
} from '../interfaces/repositories.interface';

import { AuthService } from './auth.service';

/**
 * MOCK STRATEGY: every repository is an interface (see
 * interfaces/repositories.interface.ts); AuthService depends only on those
 * interfaces (constructor injection), so unit tests substitute lightweight
 * in-memory fakes instead of a real tenant-scoped Prisma client. This is
 * the pattern every future module's service layer should follow — no
 * database, no Redis, no network calls in a unit test.
 */
interface FakeUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  status: string;
  mfaEnabled: boolean;
  createdAt: Date;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
}

function buildFakes() {
  const users = new Map<string, FakeUser>();

  const userRepository: IUserRepository = {
    async findByEmail(_tenantId, email) {
      return (Array.from(users.values()).find((u) => u.email === email) as never) ?? null;
    },
    async findById(_tenantId, userId) {
      return (users.get(userId) as never) ?? null;
    },
    async create(input) {
      const user: FakeUser = {
        id: `usr_${users.size + 1}`,
        tenantId: input.tenantId,
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        passwordHash: input.passwordHash,
        status: input.status ?? 'PENDING_VERIFICATION',
        mfaEnabled: false,
        createdAt: new Date(),
        emailVerifiedAt: null,
        lastLoginAt: null,
      };
      users.set(user.id, user);
      return user as never;
    },
    async updatePasswordHash(_t, userId, passwordHash) {
      const user = users.get(userId)!;
      user.passwordHash = passwordHash;
    },
    async markEmailVerified(_t, userId) {
      users.get(userId)!.status = 'ACTIVE';
    },
    async setStatus(_t, userId, status) {
      users.get(userId)!.status = status;
    },
    async recordFailedLogin() {},
    async resetFailedLogins() {},
    async touchLastLogin() {},
  };

  const roleRepository: IRoleRepository = {
    async assignSystemRole() {},
    async getPermissionKeysForUser() {
      return [];
    },
    async getRoleNamesForUser() {
      return ['OWNER'];
    },
    async getPermissionVersion() {
      return 1;
    },
  };

  const sessions = new Map<string, { sessionId: string; tokenHash: string; family: string; expiresAt: Date; revokedAt: Date | null; userId: string; tenantId: string; refreshTokenId: string }>();
  const sessionRepository: ISessionRepository = {
    async create(input) {
      const session = { sessionId: `ses_${sessions.size + 1}`, refreshTokenId: `rt_${sessions.size + 1}`, tokenHash: input.tokenHash, family: input.family, expiresAt: input.expiresAt, revokedAt: null, userId: input.userId, tenantId: input.tenantId };
      sessions.set(session.tokenHash, session);
      return session;
    },
    async findByTokenHash(tokenHash) {
      return sessions.get(tokenHash) ?? null;
    },
    async rotate(oldTokenHash, next) {
      const old = sessions.get(oldTokenHash);
      if (old) old.revokedAt = new Date();
      const created = { sessionId: old?.sessionId ?? `ses_${sessions.size + 1}`, refreshTokenId: `rt_${sessions.size + 1}`, tokenHash: next.tokenHash, family: next.family, expiresAt: next.expiresAt, revokedAt: null, userId: next.userId, tenantId: next.tenantId };
      sessions.set(next.tokenHash, created);
      return created;
    },
    async revokeBySessionId(sessionId) {
      for (const s of sessions.values()) if (s.sessionId === sessionId) s.revokedAt = new Date();
    },
    async revokeFamily(family) {
      for (const s of sessions.values()) if (s.family === family) s.revokedAt = new Date();
    },
    async revokeAllForUser(_t, userId) {
      for (const s of sessions.values()) if (s.userId === userId) s.revokedAt = new Date();
    },
    async listActiveForUser() {
      return [];
    },
  };

  const verificationRepository: IVerificationRepository = {
    async createEmailVerification() {},
    async consumeEmailVerification() {
      return 'not_found';
    },
    async createPasswordReset() {},
    async consumePasswordReset() {
      return 'not_found';
    },
    async createOtp() {},
    async verifyOtp() {
      return 'invalid';
    },
    async getLatestOtpIssuedAt() {
      return null;
    },
  };

  const loginHistoryRepository: ILoginHistoryRepository = {
    record: vi.fn(async () => {}),
    countRecentFailures: vi.fn(async () => 0),
  };

  const auditLogRepository: IAuditLogRepository = { record: vi.fn(async () => {}) };

  return { users, userRepository, roleRepository, sessionRepository, verificationRepository, loginHistoryRepository, auditLogRepository };
}

describe('AuthService (unit, mocked repositories)', () => {
  const tenantId = 'tnt_test';

  function buildService() {
    const fakes = buildFakes();
    const service = new AuthService({
      tenantId,
      userRepository: fakes.userRepository,
      roleRepository: fakes.roleRepository,
      sessionRepository: fakes.sessionRepository,
      verificationRepository: fakes.verificationRepository,
      loginHistoryRepository: fakes.loginHistoryRepository,
      auditLogRepository: fakes.auditLogRepository,
      sendEmail: vi.fn(async () => {}),
    });
    return { service, fakes };
  }

  it('rejects login for an unknown email with INVALID_CREDENTIALS (not a 404)', async () => {
    const { service } = buildService();
    await expect(service.login('nobody@example.com', 'whatever', {})).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('rejects login while status is PENDING_VERIFICATION', async () => {
    const { service, fakes } = buildService();
    const passwordHash = await passwordService.hash('Str0ng!Passw0rd');
    fakes.users.set('usr_1', {
      id: 'usr_1', tenantId, name: 'Test', email: 'owner@example.com', phone: null,
      passwordHash, status: 'PENDING_VERIFICATION', mfaEnabled: false,
      createdAt: new Date(), emailVerifiedAt: null, lastLoginAt: null,
    });

    await expect(service.login('owner@example.com', 'Str0ng!Passw0rd', {})).rejects.toMatchObject({
      code: 'EMAIL_NOT_VERIFIED',
    });
  });

  it('logs in successfully once ACTIVE and issues a token pair', async () => {
    const { service, fakes } = buildService();
    const passwordHash = await passwordService.hash('Str0ng!Passw0rd');
    fakes.users.set('usr_1', {
      id: 'usr_1', tenantId, name: 'Test Owner', email: 'owner@example.com', phone: null,
      passwordHash, status: 'ACTIVE', mfaEnabled: false,
      createdAt: new Date(), emailVerifiedAt: null, lastLoginAt: null,
    });

    const result = await service.login('owner@example.com', 'Str0ng!Passw0rd', {});
    expect('accessToken' in result).toBe(true);
    if ('accessToken' in result) {
      expect(result.user.email).toBe('owner@example.com');
      expect(result.accessToken).toBeTypeOf('string');
    }
  });
});
