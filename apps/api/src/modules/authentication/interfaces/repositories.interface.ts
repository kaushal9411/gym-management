import type { OtpPurpose, User, UserStatus } from '@prisma/client';

export interface CreateUserInput {
  tenantId: string;
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  status?: UserStatus;
}

export interface IUserRepository {
  findByEmail(tenantId: string, email: string): Promise<User | null>;
  findById(tenantId: string, userId: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
  updatePasswordHash(tenantId: string, userId: string, passwordHash: string): Promise<void>;
  markEmailVerified(tenantId: string, userId: string): Promise<void>;
  setStatus(tenantId: string, userId: string, status: UserStatus): Promise<void>;
  recordFailedLogin(tenantId: string, userId: string, lockedUntil: Date | null): Promise<void>;
  resetFailedLogins(tenantId: string, userId: string): Promise<void>;
  touchLastLogin(tenantId: string, userId: string): Promise<void>;
}

export interface IRoleRepository {
  /** Assigns the tenant's copy of a system role (creating the tenant-role link table row). */
  assignSystemRole(tenantId: string, userId: string, roleName: string): Promise<void>;
  /** Union of permission keys across every role the user holds. */
  getPermissionKeysForUser(tenantId: string, userId: string): Promise<string[]>;
  getRoleNamesForUser(tenantId: string, userId: string): Promise<string[]>;
  /** Monotonic version bumped whenever role assignment changes — invalidates the permission cache. */
  getPermissionVersion(tenantId: string, userId: string): Promise<number>;
}

export interface CreateSessionInput {
  tenantId: string;
  userId: string;
  tokenHash: string;
  family: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface SessionWithToken {
  sessionId: string;
  refreshTokenId: string;
  tokenHash: string;
  family: string;
  expiresAt: Date;
  revokedAt: Date | null;
  userId: string;
  tenantId: string;
}

export interface ISessionRepository {
  create(input: CreateSessionInput): Promise<SessionWithToken>;
  findByTokenHash(tokenHash: string): Promise<SessionWithToken | null>;
  rotate(oldTokenHash: string, next: CreateSessionInput): Promise<SessionWithToken>;
  revokeBySessionId(sessionId: string): Promise<void>;
  revokeFamily(family: string): Promise<void>;
  revokeAllForUser(tenantId: string, userId: string): Promise<void>;
  listActiveForUser(tenantId: string, userId: string): Promise<
    Array<{ id: string; deviceLabel: string | null; ipAddress: string | null; userAgent: string | null; lastActiveAt: Date }>
  >;
}

export interface IVerificationRepository {
  createEmailVerification(tenantId: string, userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  consumeEmailVerification(
    tokenHash: string,
  ): Promise<{ tenantId: string; userId: string } | 'expired' | 'not_found' | 'already_verified'>;

  createPasswordReset(tenantId: string, userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  consumePasswordReset(tokenHash: string): Promise<{ tenantId: string; userId: string } | 'expired' | 'not_found'>;

  createOtp(tenantId: string, userId: string, codeHash: string, purpose: OtpPurpose, expiresAt: Date): Promise<void>;
  verifyOtp(
    tenantId: string,
    userId: string,
    purpose: OtpPurpose,
    codeHash: string,
  ): Promise<'valid' | 'invalid' | 'expired' | 'max_attempts'>;
  getLatestOtpIssuedAt(tenantId: string, userId: string, purpose: OtpPurpose): Promise<Date | null>;
}

export interface ILoginHistoryRepository {
  record(input: {
    tenantId: string;
    userId: string | null;
    email: string;
    success: boolean;
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void>;
  countRecentFailures(tenantId: string, email: string, sinceMinutesAgo: number): Promise<number>;
}

export interface IAuditLogRepository {
  record(input: {
    tenantId: string | null;
    actorUserId: string | null;
    actorRole?: string;
    action: string;
    entityType?: string;
    entityId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void>;
}
