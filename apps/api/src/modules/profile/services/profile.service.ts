import { NotFoundError } from '../../../core/errors/app-error';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { IamActor } from '../../authentication/utils/actor.util';

export interface ProfileDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  roles: string[];
  emergencyContact: { name: string | null; phone: string | null; relation: string | null };
  notificationPreferences: Record<string, boolean>;
  branchAccess: {
    allBranches: boolean;
    branches: Array<{ branchId: string; branchName: string; isPrimary: boolean; expiresAt: string | null }>;
  };
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface UpdateProfileInput {
  name?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  notificationPreferences?: Record<string, boolean>;
}

/** Which notification toggles exist today — unknown keys are dropped, absent keys default on. */
export const NOTIFICATION_PREFERENCE_KEYS = ['email_billing', 'email_announcements', 'inapp_system'] as const;

/**
 * Self-service profile — everything here is the CURRENT user acting on
 * themselves (contrast with the users module, where managers act on
 * others). Email changes are deliberately NOT self-service: they re-anchor
 * the account's identity, so only users:manage holders can do that.
 */
export class ProfileService {
  private readonly db: TenantScopedPrisma;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.auditLog = new AuditLogRepository(this.db);
  }

  async get(userId: string): Promise<ProfileDto> {
    const user = await this.db.user.findFirst({
      where: { tenantId: this.tenantId, id: userId, deletedAt: null },
      include: {
        userRoles: { include: { role: true } },
        userBranches: { include: { branch: true } },
      },
    });
    if (!user) throw new NotFoundError('Profile not found.');

    const prefs = (user.notificationPreferences as Record<string, boolean> | null) ?? {};
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      roles: user.userRoles
        .sort((a, b) => b.role.priority - a.role.priority)
        .map((ur) => ur.role.name),
      emergencyContact: {
        name: user.emergencyContactName,
        phone: user.emergencyContactPhone,
        relation: user.emergencyContactRelation,
      },
      notificationPreferences: Object.fromEntries(
        NOTIFICATION_PREFERENCE_KEYS.map((key) => [key, prefs[key] ?? true]),
      ),
      branchAccess: {
        allBranches: user.allBranches,
        branches: user.userBranches.map((ub) => ({
          branchId: ub.branchId,
          branchName: ub.branch.name,
          isPrimary: ub.isPrimary,
          expiresAt: ub.expiresAt?.toISOString() ?? null,
        })),
      },
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async update(userId: string, input: UpdateProfileInput, actor: IamActor): Promise<ProfileDto> {
    await this.get(userId); // 404 guard

    const notificationPreferences = input.notificationPreferences
      ? Object.fromEntries(
          Object.entries(input.notificationPreferences).filter(([key]) =>
            (NOTIFICATION_PREFERENCE_KEYS as readonly string[]).includes(key),
          ),
        )
      : undefined;

    await this.db.user.update({
      where: { id: userId },
      data: {
        name: input.name,
        phone: input.phone,
        avatarUrl: input.avatarUrl,
        emergencyContactName: input.emergencyContactName,
        emergencyContactPhone: input.emergencyContactPhone,
        emergencyContactRelation: input.emergencyContactRelation,
        notificationPreferences,
      },
    });

    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'iam.profile_updated',
      entityType: 'user',
      entityId: userId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
    return this.get(userId);
  }
}
