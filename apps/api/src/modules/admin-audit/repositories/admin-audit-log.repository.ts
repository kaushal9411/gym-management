import { prisma } from '../../../infrastructure/database/prisma';

export interface RecordAdminAuditInput {
  adminUserId: string | null;
  actorRole?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Shared by every admin module (tenants, plans, coupons, settings, ...) —
 * the "Track: Login, Logout, Tenant Changes, Subscription Changes, Payment
 * Changes, System Settings Changes, Admin Activity" requirement is one
 * write path, not one per module.
 */
export class AdminAuditLogRepository {
  async record(input: RecordAdminAuditInput): Promise<void> {
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: input.adminUserId,
        actorRole: input.actorRole,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        before: input.before as object | undefined,
        after: input.after as object | undefined,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }

  async list(params: { action?: string; skip: number; take: number }) {
    const where = params.action ? { action: params.action } : {};
    const [total, items] = await Promise.all([
      prisma.adminAuditLog.count({ where }),
      prisma.adminAuditLog.findMany({
        where,
        include: { adminUser: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
    ]);
    return { total, items };
  }
}

export const adminAuditLogRepository = new AdminAuditLogRepository();
