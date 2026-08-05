import { randomUUID } from 'node:crypto';

import type { OtpPurpose } from '@prisma/client';
import QRCode from 'qrcode';

import { env } from '../../../config/env';
import { AppError, UnauthenticatedError, ValidationError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { AuthEvents, eventBus } from '../../../core/events/event-bus';
import { authLogger, securityLogger } from '../../../core/logging/logger';
import { decryptSecret, encryptSecret } from '../../../core/security/encryption.util';
import { jwtService } from '../../../core/security/jwt.service';
import { assertPasswordPolicy, passwordService } from '../../../core/security/password.service';
import { generateNumericOtp, generateOpaqueToken, hashToken } from '../../../core/security/token.util';
import { buildOtpAuthUri, generateBackupCodes, generateTotpSecret, normalizeBackupCode, verifyTotpCode } from '../../../core/security/totp.util';
import type {
  AuthSuccessDto,
  LoginResultDto,
  SessionDto,
  TwoFactorConfirmDto,
  TwoFactorSetupDto,
  UserProfileDto,
} from '../dto/auth-response.dto';
import type {
  IAuditLogRepository,
  ILoginHistoryRepository,
  IMfaRepository,
  IRoleRepository,
  ISessionRepository,
  IUserRepository,
  IVerificationRepository,
} from '../interfaces/repositories.interface';
import { SystemRole } from '../types/auth.types';
import type { DeviceInfo, IssuedTokenPair } from '../types/auth.types';

export interface RegisterGymOwnerInput {
  gymName: string;
  slug: string;
  ownerName: string;
  email: string;
  password: string;
}

export interface AuthServiceDeps {
  tenantId: string;
  userRepository: IUserRepository;
  roleRepository: IRoleRepository;
  sessionRepository: ISessionRepository;
  verificationRepository: IVerificationRepository;
  mfaRepository: IMfaRepository;
  loginHistoryRepository: ILoginHistoryRepository;
  auditLogRepository: IAuditLogRepository;
  sendEmail: (to: string, subject: string, html: string) => Promise<void>;
}

const REFRESH_COOKIE_BYTES = 32;
const MFA_SETUP_TOKEN_TTL_MINUTES = 15;
const BACKUP_CODE_COUNT = 10;

export class AuthService {
  constructor(private readonly deps: AuthServiceDeps) {}

  // ── Registration ─────────────────────────────────────────────────────

  /**
   * Creates the tenant itself (bare shell: trial status, default branding)
   * plus its first user (Owner). This is the one auth operation that runs
   * BEFORE any tenant exists — full subscription/billing provisioning
   * (payment methods, plan selection) is out of scope here and belongs to
   * the future Subscriptions module.
   */
  async registerGymOwner(input: RegisterGymOwnerInput): Promise<{ email: string; tenantSlug: string }> {
    // Slug availability is already checked (and the tenant already created)
    // by the controller before this runs — re-checking here would always
    // self-conflict against the tenant that now exists with this exact slug.
    assertPasswordPolicy(input.password);

    const passwordHash = await passwordService.hash(input.password);

    const user = await this.deps.userRepository.create({
      tenantId: this.deps.tenantId,
      name: input.ownerName,
      email: input.email,
      passwordHash,
    });

    await this.deps.roleRepository.assignSystemRole(this.deps.tenantId, user.id, SystemRole.OWNER);

    const verificationToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + env.security.emailVerificationTtlHours * 3600_000);
    await this.deps.verificationRepository.createEmailVerification(
      this.deps.tenantId,
      user.id,
      hashToken(verificationToken),
      expiresAt,
    );

    eventBus.emitEvent(AuthEvents.UserRegistered, {
      tenantId: this.deps.tenantId,
      tenantSlug: input.slug,
      userId: user.id,
      name: user.name,
      email: user.email,
      verificationToken,
    });

    await this.deps.auditLogRepository.record({
      tenantId: this.deps.tenantId,
      actorUserId: user.id,
      actorRole: SystemRole.OWNER,
      action: 'auth.gym_registered',
      entityType: 'tenant',
      entityId: this.deps.tenantId,
    });

    authLogger.info('Gym owner registered', { tenantId: this.deps.tenantId, userId: user.id });
    return { email: user.email, tenantSlug: input.slug };
  }

  // ── Login ────────────────────────────────────────────────────────────

  async login(email: string, password: string, device: DeviceInfo): Promise<LoginResultDto> {
    const tenantId = this.deps.tenantId;
    const user = await this.deps.userRepository.findByEmail(tenantId, email);

    // Constant-shape failure path — verify against a dummy hash when the user
    // doesn't exist so response timing doesn't reveal account existence.
    const passwordToCompare = user?.passwordHash ?? '$2a$12$invalidinvalidinvaliduinvalidinvalidinvalidinvalidin';
    const passwordMatches = await passwordService.verify(password, passwordToCompare);

    if (!user || !passwordMatches) {
      await this.recordLoginFailure(tenantId, user?.id ?? null, email, 'INVALID_CREDENTIALS', device);
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'Incorrect email or password', 401);
    }

    if (user.status === 'LOCKED' && user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      await this.recordLoginFailure(tenantId, user.id, email, 'ACCOUNT_LOCKED', device);
      throw new AppError(
        ErrorCode.ACCOUNT_LOCKED,
        'Too many failed attempts. Your account is temporarily locked.',
        423,
      );
    }

    if (user.status === 'SUSPENDED') {
      await this.recordLoginFailure(tenantId, user.id, email, 'ACCOUNT_SUSPENDED', device);
      throw new AppError(ErrorCode.ACCOUNT_SUSPENDED, 'This account has been suspended.', 403);
    }

    if (user.status === 'PENDING_VERIFICATION') {
      await this.recordLoginFailure(tenantId, user.id, email, 'EMAIL_NOT_VERIFIED', device);
      throw new AppError(ErrorCode.EMAIL_NOT_VERIFIED, 'Please verify your email address first.', 403);
    }

    // Success — clear any lockout state accumulated from prior attempts.
    await this.deps.userRepository.resetFailedLogins(tenantId, user.id);

    if (user.mfaEnabled) {
      // TOTP codes are computed live in the authenticator app, never emailed — nothing to issue here.
      await this.recordLoginFailure(tenantId, user.id, email, undefined, device, true);
      authLogger.info('Login requires 2FA', { tenantId, userId: user.id });
      return { challenge: 'otp_required', email: user.email, purpose: '2fa', expiresInSeconds: 600 };
    }

    // Password correct, 2FA not yet set up — if the account's role requires
    // it (TenantSettings.mfaRequiredRoles), block issuing a real session
    // until setup completes, via a short-lived grace token that proves the
    // password check already passed without granting actual access.
    const roleNames = await this.deps.roleRepository.getRoleNamesForUser(tenantId, user.id);
    const requiredRoles = await this.deps.mfaRepository.getMfaRequiredRoles(tenantId);
    if (requiredRoles.some((r) => roleNames.includes(r))) {
      const setupToken = generateOpaqueToken();
      const expiresAt = new Date(Date.now() + MFA_SETUP_TOKEN_TTL_MINUTES * 60_000);
      await this.deps.mfaRepository.createSetupToken(tenantId, user.id, hashToken(setupToken), expiresAt);
      await this.recordLoginFailure(tenantId, user.id, email, undefined, device, true);
      authLogger.info('Login blocked pending mandatory 2FA setup', { tenantId, userId: user.id });
      return { challenge: 'mfa_setup_required', email: user.email, setupToken, expiresInSeconds: MFA_SETUP_TOKEN_TTL_MINUTES * 60 };
    }

    const tokens = await this.issueSessionTokens(user.id, device);
    await this.deps.userRepository.touchLastLogin(tenantId, user.id);
    await this.recordLoginFailure(tenantId, user.id, email, undefined, device, true);

    eventBus.emitEvent(AuthEvents.LoginSucceeded, { tenantId, userId: user.id });
    authLogger.info('Login succeeded', { tenantId, userId: user.id });

    return { user: await this.toProfileDto(user.id), ...this.toAuthSuccessShape(tokens) };
  }

  async verifyOtpAndCompleteLogin(email: string, code: string, purpose: 'login' | '2fa'): Promise<AuthSuccessDto> {
    const tenantId = this.deps.tenantId;
    const user = await this.deps.userRepository.findByEmail(tenantId, email);
    if (!user) throw new AppError(ErrorCode.OTP_INVALID, 'Incorrect code. Check and try again.', 401);

    if (purpose === '2fa') {
      const verified = await this.verifyTwoFactorCode(user.id, user.mfaSecret, code);
      if (!verified) throw new AppError(ErrorCode.OTP_INVALID, 'Incorrect code. Check and try again.', 401);
    } else {
      const result = await this.deps.verificationRepository.verifyOtp(tenantId, user.id, 'LOGIN_MFA', hashToken(code));
      if (result === 'expired') throw new AppError(ErrorCode.OTP_EXPIRED, 'This code has expired. Request a new one.', 401);
      if (result === 'max_attempts') {
        throw new AppError(ErrorCode.OTP_INVALID, 'Too many incorrect attempts. Request a new code.', 401);
      }
      if (result === 'invalid') throw new AppError(ErrorCode.OTP_INVALID, 'Incorrect code. Check and try again.', 401);
    }

    const tokens = await this.issueSessionTokens(user.id, {});
    await this.deps.userRepository.touchLastLogin(tenantId, user.id);
    authLogger.info('OTP verified, login completed', { tenantId, userId: user.id });

    return { user: await this.toProfileDto(user.id), ...this.toAuthSuccessShape(tokens) };
  }

  async resendOtp(email: string, purpose: 'login' | '2fa'): Promise<void> {
    // 2FA codes are computed live in the authenticator app — there is
    // nothing to resend; a lost device is a backup-code/disable situation,
    // not a resend one. Silently succeed rather than error, matching this
    // endpoint's existing "never reveal account state" contract.
    if (purpose === '2fa') return;

    const user = await this.deps.userRepository.findByEmail(this.deps.tenantId, email);
    if (!user) return; // never reveal account existence

    const lastIssuedAt = await this.deps.verificationRepository.getLatestOtpIssuedAt(this.deps.tenantId, user.id, 'LOGIN_MFA');
    if (lastIssuedAt && Date.now() - lastIssuedAt.getTime() < env.security.otpResendCooldownSeconds * 1000) {
      throw new AppError(ErrorCode.RATE_LIMITED, 'Please wait before requesting another code.', 429);
    }

    await this.issueOtp(user.id, 'LOGIN_MFA');
  }

  // ── Two-factor authentication (TOTP) ────────────────────────────────────

  /**
   * Shared by both entry points: self-service (an already-authenticated
   * user turning 2FA on from Settings) and the mandatory-setup grace flow
   * (a just-password-verified user whose role now requires it). Generates a
   * FRESH secret and stores it encrypted immediately, but does NOT flip
   * `mfaEnabled` until `confirmTwoFactorSetup` verifies a real code — an
   * abandoned setup just leaves a harmless unused secret in place, safely
   * overwritten by the next `beginTwoFactorSetup` call.
   */
  async beginTwoFactorSetup(userId: string): Promise<TwoFactorSetupDto> {
    const tenantId = this.deps.tenantId;
    const user = await this.deps.userRepository.findById(tenantId, userId);
    if (!user) throw new AppError(ErrorCode.NOT_FOUND, 'User not found', 404);

    const secret = generateTotpSecret();
    await this.deps.userRepository.setMfaSecret(tenantId, userId, encryptSecret(secret));

    const otpauthUri = buildOtpAuthUri(secret, user.email);
    const qrDataUrl = await QRCode.toDataURL(otpauthUri, { width: 280, margin: 1 });
    return { secret, otpauthUri, qrDataUrl };
  }

  async confirmTwoFactorSetup(userId: string, code: string): Promise<TwoFactorConfirmDto> {
    const tenantId = this.deps.tenantId;
    const user = await this.deps.userRepository.findById(tenantId, userId);
    if (!user?.mfaSecret) throw new AppError(ErrorCode.VALIDATION_ERROR, 'No 2FA setup is in progress. Start setup again.', 422);
    if (!verifyTotpCode(decryptSecret(user.mfaSecret), code)) {
      throw new AppError(ErrorCode.OTP_INVALID, 'Incorrect code. Check your authenticator app and try again.', 401);
    }

    await this.deps.userRepository.setMfaEnabled(tenantId, userId, true);
    const backupCodes = generateBackupCodes(BACKUP_CODE_COUNT);
    await this.deps.mfaRepository.replaceBackupCodes(tenantId, userId, backupCodes.map((c) => hashToken(normalizeBackupCode(c))));

    await this.deps.auditLogRepository.record({ tenantId, actorUserId: userId, action: 'auth.two_factor_enabled', entityType: 'user', entityId: userId });
    securityLogger.info('Two-factor authentication enabled', { tenantId, userId });
    return { backupCodes };
  }

  async disableTwoFactor(userId: string, password: string): Promise<void> {
    const tenantId = this.deps.tenantId;
    const user = await this.deps.userRepository.findById(tenantId, userId);
    if (!user) throw new AppError(ErrorCode.NOT_FOUND, 'User not found', 404);

    const matches = await passwordService.verify(password, user.passwordHash);
    if (!matches) throw new ValidationError('Password is incorrect', { fields: [{ field: 'password', message: 'Password is incorrect' }] });

    await this.deps.userRepository.setMfaEnabled(tenantId, userId, false);
    await this.deps.userRepository.setMfaSecret(tenantId, userId, null);
    await this.deps.mfaRepository.deleteAllBackupCodes(tenantId, userId);

    await this.deps.auditLogRepository.record({ tenantId, actorUserId: userId, action: 'auth.two_factor_disabled', entityType: 'user', entityId: userId });
    securityLogger.warn('Two-factor authentication disabled', { tenantId, userId });
  }

  async regenerateBackupCodes(userId: string, code: string): Promise<TwoFactorConfirmDto> {
    const tenantId = this.deps.tenantId;
    const user = await this.deps.userRepository.findById(tenantId, userId);
    if (!user?.mfaEnabled || !user.mfaSecret) throw new AppError(ErrorCode.VALIDATION_ERROR, '2FA is not enabled on this account.', 422);
    if (!verifyTotpCode(decryptSecret(user.mfaSecret), code)) {
      throw new AppError(ErrorCode.OTP_INVALID, 'Incorrect code. Check your authenticator app and try again.', 401);
    }

    const backupCodes = generateBackupCodes(BACKUP_CODE_COUNT);
    await this.deps.mfaRepository.replaceBackupCodes(tenantId, userId, backupCodes.map((c) => hashToken(normalizeBackupCode(c))));
    await this.deps.auditLogRepository.record({ tenantId, actorUserId: userId, action: 'auth.two_factor_backup_codes_regenerated', entityType: 'user', entityId: userId });
    return { backupCodes };
  }

  // ── Mandatory-setup grace flow (unauthenticated except for the setup token) ──

  async beginMandatorySetup(setupToken: string): Promise<TwoFactorSetupDto> {
    const resolved = await this.deps.mfaRepository.findValidSetupToken(hashToken(setupToken));
    if (!resolved || resolved.tenantId !== this.deps.tenantId) {
      throw new AppError(ErrorCode.TOKEN_INVALID, 'This setup link has expired. Please log in again.', 401);
    }
    return this.beginTwoFactorSetup(resolved.userId);
  }

  async completeMandatorySetup(setupToken: string, code: string): Promise<AuthSuccessDto & TwoFactorConfirmDto> {
    const tokenHash = hashToken(setupToken);
    const resolved = await this.deps.mfaRepository.findValidSetupToken(tokenHash);
    if (!resolved || resolved.tenantId !== this.deps.tenantId) {
      throw new AppError(ErrorCode.TOKEN_INVALID, 'This setup link has expired. Please log in again.', 401);
    }

    const { backupCodes } = await this.confirmTwoFactorSetup(resolved.userId, code);
    await this.deps.mfaRepository.consumeSetupToken(tokenHash);

    const tokens = await this.issueSessionTokens(resolved.userId, {});
    await this.deps.userRepository.touchLastLogin(this.deps.tenantId, resolved.userId);
    authLogger.info('Mandatory 2FA setup completed, login finished', { tenantId: this.deps.tenantId, userId: resolved.userId });

    return { user: await this.toProfileDto(resolved.userId), ...this.toAuthSuccessShape(tokens), backupCodes };
  }

  /** TOTP first, then falls back to an unused backup code — either path succeeds the same way. */
  private async verifyTwoFactorCode(userId: string, encryptedSecret: string | null, code: string): Promise<boolean> {
    if (!encryptedSecret) return false;
    if (verifyTotpCode(decryptSecret(encryptedSecret), code)) return true;

    const tenantId = this.deps.tenantId;
    const consumed = await this.deps.mfaRepository.consumeBackupCodeIfValid(tenantId, userId, hashToken(normalizeBackupCode(code)));
    if (consumed) securityLogger.warn('Login completed with a 2FA backup code — one recovery code consumed', { tenantId, userId });
    return consumed;
  }

  // ── Tokens ───────────────────────────────────────────────────────────

  async refreshTokens(refreshTokenPlain: string, device: DeviceInfo): Promise<IssuedTokenPair> {
    const tokenHash = hashToken(refreshTokenPlain);
    const existing = await this.deps.sessionRepository.findByTokenHash(tokenHash);

    if (!existing) throw new UnauthenticatedError(ErrorCode.TOKEN_INVALID, 'Refresh token is invalid');

    if (existing.revokedAt) {
      // Reuse of an already-rotated token = theft signal. Nuke the whole family.
      await this.deps.sessionRepository.revokeFamily(existing.family);
      securityLogger.warn('Refresh token reuse detected — session family revoked', {
        tenantId: existing.tenantId,
        userId: existing.userId,
        family: existing.family,
      });
      throw new UnauthenticatedError(ErrorCode.TOKEN_REUSE_DETECTED, 'Session invalidated for security reasons');
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      throw new UnauthenticatedError(ErrorCode.TOKEN_EXPIRED, 'Refresh token has expired');
    }

    const nextPlain = generateOpaqueToken(REFRESH_COOKIE_BYTES);
    const nextExpiresAt = new Date(Date.now() + env.jwt.refreshTtlDays * 86_400_000);

    const rotated = await this.deps.sessionRepository.rotate(tokenHash, {
      tenantId: existing.tenantId,
      userId: existing.userId,
      tokenHash: hashToken(nextPlain),
      family: existing.family,
      expiresAt: nextExpiresAt,
      ipAddress: device.ipAddress,
      userAgent: device.userAgent,
    });

    const [roles, permVer] = await Promise.all([
      this.deps.roleRepository.getRoleNamesForUser(existing.tenantId, existing.userId),
      this.deps.roleRepository.getPermissionVersion(existing.tenantId, existing.userId),
    ]);

    const access = jwtService.signAccessToken({
      userId: existing.userId,
      tenantId: existing.tenantId,
      role: roles[0] ?? SystemRole.MEMBER,
      roles,
      permVer,
      sessionId: rotated.sessionId,
    });

    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken: nextPlain,
      refreshTokenExpiresAt: nextExpiresAt,
      sessionId: rotated.sessionId,
    };
  }

  async logoutCurrentDevice(refreshTokenPlain: string | undefined, sessionId: string | undefined): Promise<void> {
    if (sessionId) {
      await this.deps.sessionRepository.revokeBySessionId(sessionId);
      return;
    }
    if (refreshTokenPlain) {
      const existing = await this.deps.sessionRepository.findByTokenHash(hashToken(refreshTokenPlain));
      if (existing) await this.deps.sessionRepository.revokeBySessionId(existing.sessionId);
    }
  }

  async logoutAllDevices(userId: string): Promise<void> {
    await this.deps.sessionRepository.revokeAllForUser(this.deps.tenantId, userId);
    authLogger.info('All sessions revoked', { tenantId: this.deps.tenantId, userId });
  }

  async listSessions(userId: string, currentSessionId: string | undefined): Promise<SessionDto[]> {
    const sessions = await this.deps.sessionRepository.listActiveForUser(this.deps.tenantId, userId);
    return sessions.map((s) => ({
      id: s.id,
      deviceLabel: s.deviceLabel,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      lastActiveAt: s.lastActiveAt.toISOString(),
      isCurrent: s.id === currentSessionId,
    }));
  }

  async logoutDevice(userId: string, sessionId: string): Promise<void> {
    const sessions = await this.deps.sessionRepository.listActiveForUser(this.deps.tenantId, userId);
    if (!sessions.some((s) => s.id === sessionId)) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Session not found', 404);
    }
    await this.deps.sessionRepository.revokeBySessionId(sessionId);
  }

  // ── Password & email verification ───────────────────────────────────

  async forgotPassword(email: string): Promise<void> {
    const user = await this.deps.userRepository.findByEmail(this.deps.tenantId, email);
    if (!user) return; // never reveal account existence

    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + env.security.passwordResetTtlMinutes * 60_000);
    await this.deps.verificationRepository.createPasswordReset(this.deps.tenantId, user.id, hashToken(token), expiresAt);

    eventBus.emitEvent(AuthEvents.PasswordResetRequested, {
      tenantId: this.deps.tenantId,
      userId: user.id,
      name: user.name,
      email: user.email,
      resetToken: token,
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    assertPasswordPolicy(newPassword);
    const result = await this.deps.verificationRepository.consumePasswordReset(hashToken(token));

    if (result === 'not_found') throw new AppError(ErrorCode.TOKEN_INVALID, 'This reset link is invalid.', 401);
    if (result === 'expired') {
      throw new AppError(ErrorCode.TOKEN_EXPIRED, 'This reset link has expired. Request a new one.', 401);
    }

    const passwordHash = await passwordService.hash(newPassword);
    await this.deps.userRepository.updatePasswordHash(result.tenantId, result.userId, passwordHash);
    await this.deps.sessionRepository.revokeAllForUser(result.tenantId, result.userId);

    const user = await this.deps.userRepository.findById(result.tenantId, result.userId);
    eventBus.emitEvent(AuthEvents.PasswordChanged, {
      tenantId: result.tenantId,
      userId: result.userId,
      name: user?.name ?? '',
      email: user?.email ?? '',
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    assertPasswordPolicy(newPassword);
    const user = await this.deps.userRepository.findById(this.deps.tenantId, userId);
    if (!user) throw new AppError(ErrorCode.NOT_FOUND, 'User not found', 404);

    const matches = await passwordService.verify(currentPassword, user.passwordHash);
    if (!matches) throw new ValidationError('Current password is incorrect', { fields: [{ field: 'currentPassword', message: 'Current password is incorrect' }] });

    const passwordHash = await passwordService.hash(newPassword);
    await this.deps.userRepository.updatePasswordHash(this.deps.tenantId, userId, passwordHash);
    await this.deps.sessionRepository.revokeAllForUser(this.deps.tenantId, userId);

    eventBus.emitEvent(AuthEvents.PasswordChanged, {
      tenantId: this.deps.tenantId,
      userId,
      name: user.name,
      email: user.email,
    });
  }

  async verifyEmail(token: string): Promise<'verified' | 'already_verified'> {
    const result = await this.deps.verificationRepository.consumeEmailVerification(hashToken(token));

    if (result === 'not_found') throw new AppError(ErrorCode.TOKEN_INVALID, 'This verification link is not valid.', 401);
    if (result === 'expired') {
      throw new AppError(ErrorCode.TOKEN_EXPIRED, 'This verification link has expired.', 401);
    }
    if (result === 'already_verified') return 'already_verified';

    await this.deps.userRepository.markEmailVerified(result.tenantId, result.userId);
    eventBus.emitEvent(AuthEvents.EmailVerified, { tenantId: result.tenantId, userId: result.userId });
    return 'verified';
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.deps.userRepository.findByEmail(this.deps.tenantId, email);
    if (!user || user.status !== 'PENDING_VERIFICATION') return; // never reveal account existence/state

    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + env.security.emailVerificationTtlHours * 3600_000);
    await this.deps.verificationRepository.createEmailVerification(this.deps.tenantId, user.id, hashToken(token), expiresAt);

    eventBus.emitEvent(AuthEvents.UserRegistered, {
      tenantId: this.deps.tenantId,
      tenantSlug: '',
      userId: user.id,
      name: user.name,
      email: user.email,
      verificationToken: token,
      isResend: true,
    });
  }

  // ── Profile ──────────────────────────────────────────────────────────

  async getCurrentUser(userId: string): Promise<UserProfileDto> {
    return this.toProfileDto(userId);
  }

  // ── Internals ────────────────────────────────────────────────────────

  private async issueSessionTokens(userId: string, device: DeviceInfo): Promise<IssuedTokenPair> {
    const tenantId = this.deps.tenantId;
    const family = randomUUID();
    const refreshPlain = generateOpaqueToken(REFRESH_COOKIE_BYTES);
    const refreshExpiresAt = new Date(Date.now() + env.jwt.refreshTtlDays * 86_400_000);

    const session = await this.deps.sessionRepository.create({
      tenantId,
      userId,
      tokenHash: hashToken(refreshPlain),
      family,
      expiresAt: refreshExpiresAt,
      ipAddress: device.ipAddress,
      userAgent: device.userAgent,
    });

    const roles = await this.deps.roleRepository.getRoleNamesForUser(tenantId, userId);
    const permVer = await this.deps.roleRepository.getPermissionVersion(tenantId, userId);

    const access = jwtService.signAccessToken({
      userId,
      tenantId,
      role: roles[0] ?? SystemRole.MEMBER,
      roles,
      permVer,
      sessionId: session.sessionId,
    });

    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken: refreshPlain,
      refreshTokenExpiresAt: refreshExpiresAt,
      sessionId: session.sessionId,
    };
  }

  private toAuthSuccessShape(tokens: IssuedTokenPair): Omit<AuthSuccessDto, 'user'> {
    return {
      accessToken: tokens.accessToken,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt.toISOString(),
      refreshToken: tokens.refreshToken,
    };
  }

  private async issueOtp(userId: string, purpose: OtpPurpose): Promise<string> {
    const code = generateNumericOtp(env.security.otpLength);
    const expiresAt = new Date(Date.now() + env.security.otpTtlSeconds * 1000);
    await this.deps.verificationRepository.createOtp(this.deps.tenantId, userId, hashToken(code), purpose, expiresAt);

    const user = await this.deps.userRepository.findById(this.deps.tenantId, userId);
    if (user) {
      eventBus.emitEvent('auth.otp_issued', {
        tenantId: this.deps.tenantId,
        userId,
        name: user.name,
        email: user.email,
        code,
        expiresInMinutes: Math.round(env.security.otpTtlSeconds / 60),
      });
    }
    return code;
  }

  private async recordLoginFailure(
    tenantId: string,
    userId: string | null,
    email: string,
    reason: string | undefined,
    device: DeviceInfo,
    success = false,
  ): Promise<void> {
    await this.deps.loginHistoryRepository.record({
      tenantId,
      userId,
      email,
      success,
      reason,
      ipAddress: device.ipAddress,
      userAgent: device.userAgent,
    });

    if (success || !userId) return;

    const recentFailures = await this.deps.loginHistoryRepository.countRecentFailures(
      tenantId,
      email,
      env.security.loginLockoutMinutes,
    );

    if (recentFailures >= env.security.loginMaxAttempts) {
      const lockedUntil = new Date(Date.now() + env.security.loginLockoutMinutes * 60_000);
      await this.deps.userRepository.recordFailedLogin(tenantId, userId, lockedUntil);
      eventBus.emitEvent(AuthEvents.AccountLocked, { tenantId, userId, lockedUntil });
      securityLogger.warn('Account locked after repeated failed logins', { tenantId, userId });
    } else {
      await this.deps.userRepository.recordFailedLogin(tenantId, userId, null);
    }
  }

  private async toProfileDto(userId: string): Promise<UserProfileDto> {
    const user = await this.deps.userRepository.findById(this.deps.tenantId, userId);
    if (!user) throw new AppError(ErrorCode.NOT_FOUND, 'User not found', 404);
    const [roles, permissions] = await Promise.all([
      this.deps.roleRepository.getRoleNamesForUser(this.deps.tenantId, userId),
      this.deps.roleRepository.getPermissionKeysForUser(this.deps.tenantId, userId),
    ]);

    return {
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      roles,
      permissions,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
