import { randomUUID } from 'node:crypto';

import { env } from '../../../config/env';
import { AppError, UnauthenticatedError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { eventBus } from '../../../core/events/event-bus';
import { authLogger, securityLogger } from '../../../core/logging/logger';
import { memberJwtService } from '../../../core/security/member-jwt.service';
import { assertPasswordPolicy, passwordService } from '../../../core/security/password.service';
import { generateOpaqueToken, hashToken } from '../../../core/security/token.util';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import { decryptMemberContactNullable } from '../../members/utils/member-pii.util';
import { MemberCredentialRepository } from '../repositories/member-credential.repository';
import { MemberSessionRepository } from '../repositories/member-session.repository';
import { MemberVerificationRepository } from '../repositories/member-verification.repository';
import type { DeviceInfo, MemberAuthSuccess, MemberProfileDto } from '../types/member-auth.types';

const REFRESH_TOKEN_BYTES = 32;
const ACTIVATION_TTL_HOURS = 72;
const PASSWORD_RESET_TTL_MINUTES = 30;

export const MemberAuthEvents = {
  ActivationRequested: 'member_auth.activation_requested',
  PasswordResetRequested: 'member_auth.password_reset_requested',
} as const;

/**
 * Login identifier is the member's own `memberId` code (e.g. "MEM-0007"),
 * not email — `Member.email` is optional and NOT unique per tenant (no
 * `@@unique([tenantId, email])`, confirmed in schema), so it can't safely
 * resolve to exactly one row. `memberId` already carries `@@unique([tenantId,
 * memberId])` and is what members already see on their own QR/ID, making it
 * a natural login handle without touching the pre-existing `Member` schema.
 */
export class MemberAuthService {
  private readonly db: TenantScopedPrisma;
  private readonly credentials: MemberCredentialRepository;
  private readonly sessions: MemberSessionRepository;
  private readonly verifications: MemberVerificationRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.credentials = new MemberCredentialRepository(this.db);
    this.sessions = new MemberSessionRepository(this.db);
    this.verifications = new MemberVerificationRepository(this.db);
    this.auditLog = new AuditLogRepository(this.db);
  }

  async login(memberCode: string, password: string, device: DeviceInfo): Promise<MemberAuthSuccess> {
    const member = decryptMemberContactNullable(await this.db.member.findFirst({ where: { tenantId: this.tenantId, memberId: memberCode, deletedAt: null } }));
    const credential = member ? await this.credentials.findByMemberId(this.tenantId, member.id) : null;

    const passwordToCompare = credential?.passwordHash ?? '$2a$12$invalidinvalidinvaliduinvalidinvalidinvalidinvalidin';
    const passwordMatches = await passwordService.verify(password, passwordToCompare);

    if (!member || !credential || !passwordMatches) {
      if (credential) await this.recordFailure(credential.id, credential.failedLoginAttempts);
      await this.auditLog.record({ tenantId: this.tenantId, actorUserId: null, actorRole: 'MEMBER', action: 'member_auth.login_failed', ipAddress: device.ipAddress, userAgent: device.userAgent });
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'Incorrect member ID or password', 401);
    }

    if (credential.lockedUntil && credential.lockedUntil.getTime() > Date.now()) {
      throw new AppError(ErrorCode.ACCOUNT_LOCKED, 'Too many failed attempts. This account is temporarily locked.', 423);
    }
    if (credential.status !== 'ACTIVE') {
      throw new AppError(ErrorCode.ACCOUNT_SUSPENDED, 'Portal access is not active for this account.', 403);
    }

    await this.credentials.resetFailedLogins(credential.id);
    await this.credentials.touchLastLogin(credential.id);

    const tokens = await this.issueTokens(member.id, device);

    await this.auditLog.record({ tenantId: this.tenantId, actorUserId: null, actorRole: 'MEMBER', action: 'member_auth.login_succeeded', entityType: 'member', entityId: member.id, ipAddress: device.ipAddress, userAgent: device.userAgent });
    authLogger.info('Member portal login succeeded', { memberId: member.id });

    return { member: this.toProfileDto(member), ...tokens };
  }

  async refreshTokens(refreshTokenPlain: string, device: DeviceInfo): Promise<Omit<MemberAuthSuccess, 'member'>> {
    const tokenHash = hashToken(refreshTokenPlain);
    const existing = await this.sessions.findByTokenHash(tokenHash);
    if (!existing) throw new UnauthenticatedError(ErrorCode.TOKEN_INVALID, 'Refresh token is invalid');

    if (existing.revokedAt) {
      await this.sessions.revokeFamily(existing.family);
      securityLogger.warn('Member refresh token reuse detected — session family revoked', { memberId: existing.memberId, family: existing.family });
      throw new UnauthenticatedError(ErrorCode.TOKEN_REUSE_DETECTED, 'Session invalidated for security reasons');
    }
    if (existing.expiresAt.getTime() < Date.now()) {
      throw new UnauthenticatedError(ErrorCode.TOKEN_EXPIRED, 'Refresh token has expired');
    }

    const credential = await this.credentials.findByMemberId(this.tenantId, existing.memberId);
    if (!credential || credential.status !== 'ACTIVE') throw new UnauthenticatedError(ErrorCode.TOKEN_INVALID, 'Portal access is not active');

    const nextPlain = generateOpaqueToken(REFRESH_TOKEN_BYTES);
    const nextSession = await this.sessions.rotate(tokenHash, {
      tenantId: this.tenantId,
      memberId: existing.memberId,
      tokenHash: hashToken(nextPlain),
      family: existing.family,
      expiresAt: new Date(Date.now() + env.jwt.refreshTtlDays * 86_400_000),
      ipAddress: device.ipAddress,
      userAgent: device.userAgent,
    });

    const access = memberJwtService.signAccessToken({ memberId: existing.memberId, tenantId: this.tenantId, sid: nextSession.id });
    return { accessToken: access.token, accessTokenExpiresAt: access.expiresAt.toISOString(), refreshToken: nextPlain };
  }

  async logout(refreshTokenPlain: string): Promise<void> {
    await this.sessions.revoke(hashToken(refreshTokenPlain));
  }

  /**
   * Called by `MemberService#sendPortalInvite` (members module) — creates
   * the auth-capable row (first invite) or just re-issues a fresh token
   * (resend, e.g. the original email never arrived) and emails an
   * activation link. Rejects if the member already activated — resending
   * is only meaningful while still PENDING_ACTIVATION.
   */
  async createOrResendInvite(memberId: string, memberName: string, email: string): Promise<void> {
    let credential = await this.credentials.findByMemberId(this.tenantId, memberId);
    if (credential && credential.status !== 'PENDING_ACTIVATION') {
      throw new AppError(ErrorCode.CONFLICT, 'This member has already activated portal access.', 409);
    }
    if (!credential) {
      credential = await this.credentials.create({ tenantId: this.tenantId, memberId, passwordHash: await passwordService.hash(generateOpaqueToken(24)), status: 'PENDING_ACTIVATION' });
    }

    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + ACTIVATION_TTL_HOURS * 3600_000);
    await this.verifications.create({ tenantId: this.tenantId, memberId, purpose: 'ACTIVATION', tokenHash: hashToken(token), expiresAt });
    eventBus.emitEvent(MemberAuthEvents.ActivationRequested, { tenantId: this.tenantId, email, name: memberName, token });
    authLogger.info('Member portal invite created/resent', { memberId, credentialId: credential.id });
  }

  async lookupVerification(token: string, purpose: 'ACTIVATION' | 'PASSWORD_RESET'): Promise<{ memberName: string; expiresAt: string }> {
    const verification = await this.mustFindVerification(token, purpose);
    const member = await this.db.member.findFirst({ where: { tenantId: this.tenantId, id: verification.memberId } });
    if (!member) throw new AppError(ErrorCode.NOT_FOUND, 'Member not found.', 404);
    return { memberName: `${member.firstName} ${member.lastName}`.trim(), expiresAt: verification.expiresAt.toISOString() };
  }

  async acceptActivation(token: string, password: string): Promise<void> {
    assertPasswordPolicy(password);
    const verification = await this.mustFindVerification(token, 'ACTIVATION');
    const credential = await this.credentials.findByMemberId(this.tenantId, verification.memberId);
    if (!credential) throw new AppError(ErrorCode.NOT_FOUND, 'Portal access is not set up for this member.', 404);

    await this.credentials.setPassword(credential.id, await passwordService.hash(password));
    await this.verifications.consume(verification.id);
    await this.auditLog.record({ tenantId: this.tenantId, actorUserId: null, actorRole: 'MEMBER', action: 'member_auth.activated', entityType: 'member', entityId: verification.memberId });
  }

  async forgotPassword(memberCode: string): Promise<void> {
    const member = decryptMemberContactNullable(await this.db.member.findFirst({ where: { tenantId: this.tenantId, memberId: memberCode, deletedAt: null } }));
    if (!member || !member.email) return; // don't reveal whether a member/portal account exists
    const credential = await this.credentials.findByMemberId(this.tenantId, member.id);
    if (!credential || credential.status !== 'ACTIVE') return;

    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60_000);
    await this.verifications.create({ tenantId: this.tenantId, memberId: member.id, purpose: 'PASSWORD_RESET', tokenHash: hashToken(token), expiresAt });
    eventBus.emitEvent(MemberAuthEvents.PasswordResetRequested, { tenantId: this.tenantId, email: member.email, name: `${member.firstName} ${member.lastName}`.trim(), token });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    assertPasswordPolicy(password);
    const verification = await this.mustFindVerification(token, 'PASSWORD_RESET');
    const credential = await this.credentials.findByMemberId(this.tenantId, verification.memberId);
    if (!credential) throw new AppError(ErrorCode.NOT_FOUND, 'Portal access is not set up for this member.', 404);

    await this.credentials.setPassword(credential.id, await passwordService.hash(password));
    await this.verifications.consume(verification.id);
    // A password reset should invalidate every existing session — resetting
    // the password is exactly the moment a compromised session needs to die.
    await this.sessions.revokeAllForMember(this.tenantId, verification.memberId);
  }

  // ── internals ───────────────────────────────────────────────────────────

  private async issueTokens(memberId: string, device: DeviceInfo) {
    const refreshPlain = generateOpaqueToken(REFRESH_TOKEN_BYTES);
    const session = await this.sessions.create({
      tenantId: this.tenantId,
      memberId,
      tokenHash: hashToken(refreshPlain),
      family: randomUUID(),
      expiresAt: new Date(Date.now() + env.jwt.refreshTtlDays * 86_400_000),
      ipAddress: device.ipAddress,
      userAgent: device.userAgent,
    });
    const access = memberJwtService.signAccessToken({ memberId, tenantId: this.tenantId, sid: session.id });
    return { accessToken: access.token, accessTokenExpiresAt: access.expiresAt.toISOString(), refreshToken: refreshPlain };
  }

  private async recordFailure(credentialId: string, currentAttempts: number): Promise<void> {
    const attempts = currentAttempts + 1;
    const lockedUntil = attempts >= env.security.loginMaxAttempts ? new Date(Date.now() + env.security.loginLockoutMinutes * 60_000) : null;
    await this.credentials.recordFailedLogin(credentialId, attempts, lockedUntil);
  }

  private async mustFindVerification(token: string, purpose: 'ACTIVATION' | 'PASSWORD_RESET') {
    const verification = await this.verifications.findByTokenHash(hashToken(token));
    if (!verification || verification.purpose !== purpose || verification.consumedAt) {
      throw new AppError(ErrorCode.TOKEN_INVALID, 'This link is invalid or has already been used.', 400);
    }
    if (verification.expiresAt.getTime() < Date.now()) {
      throw new AppError(ErrorCode.TOKEN_EXPIRED, 'This link has expired.', 400);
    }
    return verification;
  }

  private toProfileDto(member: { id: string; memberId: string; firstName: string; lastName: string; email: string | null; status: string }): MemberProfileDto {
    return { id: member.id, memberId: member.memberId, name: `${member.firstName} ${member.lastName}`.trim(), email: member.email, status: member.status };
  }
}

export const buildMemberAuthService = (tenantId: string): MemberAuthService => new MemberAuthService(tenantId);
