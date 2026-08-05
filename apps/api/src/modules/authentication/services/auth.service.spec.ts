import { generateSync } from 'otplib';
import { describe, expect, it, vi } from 'vitest';

import { encryptSecret } from '../../../core/security/encryption.util';
import { passwordService } from '../../../core/security/password.service';
import { hashToken } from '../../../core/security/token.util';
import { generateTotpSecret, normalizeBackupCode } from '../../../core/security/totp.util';
import type {
  IAuditLogRepository,
  ILoginHistoryRepository,
  IMfaRepository,
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
  mfaSecret: string | null;
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
        mfaSecret: null,
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
    async setMfaSecret(_t, userId, encryptedSecret) {
      users.get(userId)!.mfaSecret = encryptedSecret;
    },
    async setMfaEnabled(_t, userId, enabled) {
      users.get(userId)!.mfaEnabled = enabled;
    },
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
    async bumpPermissionVersion() {},
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

  const backupCodes = new Map<string, Set<string>>(); // userId -> unused code hashes
  const setupTokens = new Map<string, { tenantId: string; userId: string; consumed: boolean }>();
  const mfaRepository: IMfaRepository = {
    async getMfaRequiredRoles() {
      return [];
    },
    async createSetupToken(tenantIdArg, userId, tokenHash) {
      setupTokens.set(tokenHash, { tenantId: tenantIdArg, userId, consumed: false });
    },
    async findValidSetupToken(tokenHash) {
      const record = setupTokens.get(tokenHash);
      if (!record || record.consumed) return null;
      return { tenantId: record.tenantId, userId: record.userId };
    },
    async consumeSetupToken(tokenHash) {
      const record = setupTokens.get(tokenHash);
      if (record) record.consumed = true;
    },
    async replaceBackupCodes(_t, userId, codeHashes) {
      backupCodes.set(userId, new Set(codeHashes));
    },
    async consumeBackupCodeIfValid(_t, userId, codeHash) {
      const codes = backupCodes.get(userId);
      if (!codes?.has(codeHash)) return false;
      codes.delete(codeHash);
      return true;
    },
    async deleteAllBackupCodes(_t, userId) {
      backupCodes.delete(userId);
    },
  };

  return { users, userRepository, roleRepository, sessionRepository, verificationRepository, mfaRepository, loginHistoryRepository, auditLogRepository };
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
      mfaRepository: fakes.mfaRepository,
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
      passwordHash, status: 'PENDING_VERIFICATION', mfaEnabled: false, mfaSecret: null,
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
      passwordHash, status: 'ACTIVE', mfaEnabled: false, mfaSecret: null,
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

describe('AuthService — mandatory 2FA (unit, mocked repositories)', () => {
  const tenantId = 'tnt_test';

  function buildService(requiredRoles: string[] = []) {
    const fakes = buildFakes();
    fakes.mfaRepository.getMfaRequiredRoles = async () => requiredRoles;
    const service = new AuthService({
      tenantId,
      userRepository: fakes.userRepository,
      roleRepository: fakes.roleRepository,
      sessionRepository: fakes.sessionRepository,
      verificationRepository: fakes.verificationRepository,
      mfaRepository: fakes.mfaRepository,
      loginHistoryRepository: fakes.loginHistoryRepository,
      auditLogRepository: fakes.auditLogRepository,
      sendEmail: vi.fn(async () => {}),
    });
    return { service, fakes };
  }

  async function seedActiveUser(fakes: ReturnType<typeof buildFakes>, overrides: Partial<{ mfaEnabled: boolean; mfaSecret: string | null }> = {}) {
    const passwordHash = await passwordService.hash('Str0ng!Passw0rd');
    fakes.users.set('usr_1', {
      id: 'usr_1', tenantId, name: 'Test Owner', email: 'owner@example.com', phone: null,
      passwordHash, status: 'ACTIVE', mfaEnabled: false, mfaSecret: null,
      createdAt: new Date(), emailVerifiedAt: null, lastLoginAt: null,
      ...overrides,
    });
  }

  it('blocks login with a setup-required challenge when the role requires 2FA and it is not set up yet', async () => {
    const { service, fakes } = buildService(['OWNER']);
    await seedActiveUser(fakes);

    const result = await service.login('owner@example.com', 'Str0ng!Passw0rd', {});
    expect(result).toMatchObject({ challenge: 'mfa_setup_required', email: 'owner@example.com' });
  });

  it('does not block login when the user role is not in the required-roles policy', async () => {
    const { service, fakes } = buildService(['MANAGER']); // user's role is OWNER (see fake roleRepository)
    await seedActiveUser(fakes);

    const result = await service.login('owner@example.com', 'Str0ng!Passw0rd', {});
    expect('accessToken' in result).toBe(true);
  });

  it('full mandatory-setup grace flow: begin → confirm with a real TOTP code → issues a real session + backup codes', async () => {
    const { service, fakes } = buildService(['OWNER']);
    await seedActiveUser(fakes);

    const challenge = await service.login('owner@example.com', 'Str0ng!Passw0rd', {});
    if (!('challenge' in challenge) || challenge.challenge !== 'mfa_setup_required') throw new Error('expected mfa_setup_required');

    const setup = await service.beginMandatorySetup(challenge.setupToken);
    expect(setup.secret).toBeTypeOf('string');
    expect(setup.otpauthUri).toContain('otpauth://totp/');

    const code = generateSync({ secret: setup.secret });

    const completed = await service.completeMandatorySetup(challenge.setupToken, code);
    expect(completed.accessToken).toBeTypeOf('string');
    expect(completed.backupCodes).toHaveLength(10);
    expect(fakes.users.get('usr_1')!.mfaEnabled).toBe(true);

    // The grace token is single-use.
    await expect(service.completeMandatorySetup(challenge.setupToken, code)).rejects.toMatchObject({ code: 'TOKEN_INVALID' });
  });

  it('login with mfaEnabled=true issues an otp_required(2fa) challenge, and a real TOTP code completes it', async () => {
    const { service, fakes } = buildService();
    const secret = generateTotpSecret();
    await seedActiveUser(fakes, { mfaEnabled: true, mfaSecret: encryptSecret(secret) });

    const challenge = await service.login('owner@example.com', 'Str0ng!Passw0rd', {});
    expect(challenge).toMatchObject({ challenge: 'otp_required', purpose: '2fa' });

    const code = generateSync({ secret });
    const result = await service.verifyOtpAndCompleteLogin('owner@example.com', code, '2fa');
    expect(result.accessToken).toBeTypeOf('string');
  });

  it('a backup code completes the 2fa challenge and is single-use', async () => {
    const { service, fakes } = buildService();
    const secret = generateTotpSecret();
    await seedActiveUser(fakes, { mfaEnabled: true, mfaSecret: encryptSecret(secret) });
    await fakes.mfaRepository.replaceBackupCodes(tenantId, 'usr_1', [hashToken(normalizeBackupCode('ABCD-123456'))]);

    const result = await service.verifyOtpAndCompleteLogin('owner@example.com', 'abcd-123456', '2fa');
    expect(result.accessToken).toBeTypeOf('string');

    await expect(service.verifyOtpAndCompleteLogin('owner@example.com', 'abcd-123456', '2fa')).rejects.toMatchObject({ code: 'OTP_INVALID' });
  });

  it('disableTwoFactor requires the correct current password', async () => {
    const { service, fakes } = buildService();
    await seedActiveUser(fakes, { mfaEnabled: true, mfaSecret: encryptSecret(generateTotpSecret()) });

    await expect(service.disableTwoFactor('usr_1', 'wrong-password')).rejects.toBeTruthy();
    await service.disableTwoFactor('usr_1', 'Str0ng!Passw0rd');
    expect(fakes.users.get('usr_1')!.mfaEnabled).toBe(false);
    expect(fakes.users.get('usr_1')!.mfaSecret).toBeNull();
  });
});
