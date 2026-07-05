import { randomUUID } from 'node:crypto';

import { env } from '../../../config/env';
import { AppError, UnauthenticatedError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { authLogger, securityLogger } from '../../../core/logging/logger';
import { adminJwtService } from '../../../core/security/admin-jwt.service';
import { passwordService } from '../../../core/security/password.service';
import { generateOpaqueToken, hashToken } from '../../../core/security/token.util';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';
import { adminRefreshTokenRepository } from '../repositories/admin-refresh-token.repository';
import { adminUserRepository } from '../repositories/admin-user.repository';
import type { AdminAuthSuccess, AdminProfileDto, DeviceInfo } from '../types/admin-auth.types';

const REFRESH_TOKEN_BYTES = 32;

export class AdminAuthService {
  async login(email: string, password: string, device: DeviceInfo): Promise<AdminAuthSuccess> {
    const admin = await adminUserRepository.findByEmailWithRole(email);

    const passwordToCompare = admin?.passwordHash ?? '$2a$12$invalidinvalidinvaliduinvalidinvalidinvalidinvalidin';
    const passwordMatches = await passwordService.verify(password, passwordToCompare);

    if (!admin || !passwordMatches) {
      if (admin) await this.recordFailure(admin.id, admin.failedLoginAttempts);
      await adminAuditLogRepository.record({ adminUserId: admin?.id ?? null, action: 'admin.login_failed', ipAddress: device.ipAddress, userAgent: device.userAgent });
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'Incorrect email or password', 401);
    }

    if (admin.lockedUntil && admin.lockedUntil.getTime() > Date.now()) {
      throw new AppError(ErrorCode.ACCOUNT_LOCKED, 'Too many failed attempts. This account is temporarily locked.', 423);
    }
    if (admin.status === 'SUSPENDED' || admin.status === 'DEACTIVATED') {
      throw new AppError(ErrorCode.ACCOUNT_SUSPENDED, 'This admin account is not active.', 403);
    }

    await adminUserRepository.resetFailedLogins(admin.id);
    await adminUserRepository.touchLastLogin(admin.id);

    const permissions = admin.role.rolePermissions.map((rp) => rp.permission.key);
    const tokens = await this.issueTokens(admin.id, admin.role.name, permissions.length, device);

    await adminAuditLogRepository.record({
      adminUserId: admin.id,
      actorRole: admin.role.name,
      action: 'admin.login_succeeded',
      ipAddress: device.ipAddress,
      userAgent: device.userAgent,
    });
    authLogger.info('Admin login succeeded', { adminUserId: admin.id });

    return {
      admin: this.toProfileDto(admin.id, admin.name, admin.email, admin.role.name, permissions, admin.status, admin.lastLoginAt),
      ...tokens,
    };
  }

  async refreshTokens(refreshTokenPlain: string, device: DeviceInfo) {
    const tokenHash = hashToken(refreshTokenPlain);
    const existing = await adminRefreshTokenRepository.findByTokenHash(tokenHash);
    if (!existing) throw new UnauthenticatedError(ErrorCode.TOKEN_INVALID, 'Refresh token is invalid');

    if (existing.revokedAt) {
      await adminRefreshTokenRepository.revokeFamily(existing.family);
      securityLogger.warn('Admin refresh token reuse detected — session family revoked', { adminUserId: existing.adminUserId, family: existing.family });
      throw new UnauthenticatedError(ErrorCode.TOKEN_REUSE_DETECTED, 'Session invalidated for security reasons');
    }
    if (existing.expiresAt.getTime() < Date.now()) {
      throw new UnauthenticatedError(ErrorCode.TOKEN_EXPIRED, 'Refresh token has expired');
    }

    const admin = await adminUserRepository.findByIdWithRole(existing.adminUserId);
    if (!admin || admin.status !== 'ACTIVE') throw new UnauthenticatedError(ErrorCode.TOKEN_INVALID, 'Admin account is not active');

    const nextPlain = generateOpaqueToken(REFRESH_TOKEN_BYTES);
    await adminRefreshTokenRepository.rotate(tokenHash, {
      adminUserId: existing.adminUserId,
      tokenHash: hashToken(nextPlain),
      family: existing.family,
      expiresAt: new Date(Date.now() + env.jwt.refreshTtlDays * 86_400_000),
      ipAddress: device.ipAddress,
      userAgent: device.userAgent,
    });

    const permissions = admin.role.rolePermissions.map((rp) => rp.permission.key);
    const access = adminJwtService.signAccessToken({ adminUserId: admin.id, role: admin.role.name, permVer: permissions.length });

    return { accessToken: access.token, accessTokenExpiresAt: access.expiresAt.toISOString(), refreshToken: nextPlain };
  }

  async logout(refreshTokenPlain: string): Promise<void> {
    await adminRefreshTokenRepository.revoke(hashToken(refreshTokenPlain));
  }

  async me(adminUserId: string): Promise<AdminProfileDto> {
    const admin = await adminUserRepository.findByIdWithRole(adminUserId);
    if (!admin) throw new AppError(ErrorCode.NOT_FOUND, 'Admin not found', 404);
    const permissions = admin.role.rolePermissions.map((rp) => rp.permission.key);
    return this.toProfileDto(admin.id, admin.name, admin.email, admin.role.name, permissions, admin.status, admin.lastLoginAt);
  }

  private async issueTokens(adminUserId: string, role: string, permVer: number, device: DeviceInfo) {
    const access = adminJwtService.signAccessToken({ adminUserId, role, permVer });
    const refreshPlain = generateOpaqueToken(REFRESH_TOKEN_BYTES);
    await adminRefreshTokenRepository.create({
      adminUserId,
      tokenHash: hashToken(refreshPlain),
      family: randomUUID(),
      expiresAt: new Date(Date.now() + env.jwt.refreshTtlDays * 86_400_000),
      ipAddress: device.ipAddress,
      userAgent: device.userAgent,
    });
    return { accessToken: access.token, accessTokenExpiresAt: access.expiresAt.toISOString(), refreshToken: refreshPlain };
  }

  private async recordFailure(adminUserId: string, currentAttempts: number): Promise<void> {
    const attempts = currentAttempts + 1;
    const lockedUntil = attempts >= env.security.loginMaxAttempts ? new Date(Date.now() + env.security.loginLockoutMinutes * 60_000) : null;
    await adminUserRepository.recordFailedLogin(adminUserId, attempts, lockedUntil);
  }

  private toProfileDto(
    id: string,
    name: string,
    email: string,
    role: string,
    permissions: string[],
    status: string,
    lastLoginAt: Date | null,
  ): AdminProfileDto {
    return { id, name, email, role, permissions, status, lastLoginAt: lastLoginAt ? lastLoginAt.toISOString() : null };
  }
}

export const adminAuthService = new AdminAuthService();
