import type { DeviceTokenPlatform } from '@prisma/client';

import { prisma } from '../../../infrastructure/database/prisma';
import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

export class StaffDeviceTokenRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  /**
   * Raw `prisma`, not the tenant-scoped client — an FCM `token` is unique to
   * one physical app install, not to a tenant, so the SAME token can
   * legitimately move to a different tenant/user over time (e.g. someone
   * uninstalls, or the same device later logs into a different gym's
   * tenant). Under RLS, a tenant-scoped upsert can't SEE a row that
   * currently belongs to another tenant, so it would attempt an INSERT and
   * hit the `token` unique-constraint instead of reassigning it — this is
   * the one write in this module that genuinely needs to see across
   * tenants. `tenantId`/`userId` in `data` are the real enforcement here,
   * not RLS. Same documented pattern as onboarding's duplicate-checks / the
   * broadcast fan-out (dev-superuser-bypasses-RLS caveat applies as usual).
   */
  async upsert(tenantId: string, userId: string, token: string, platform: DeviceTokenPlatform): Promise<void> {
    await prisma.staffDeviceToken.upsert({
      where: { token },
      create: { tenantId, userId, token, platform },
      update: { tenantId, userId, platform, lastSeenAt: new Date() },
    });
  }

  async remove(tenantId: string, token: string): Promise<void> {
    await this.db.staffDeviceToken.deleteMany({ where: { tenantId, token } });
  }

  async removeMany(tenantId: string, tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.db.staffDeviceToken.deleteMany({ where: { tenantId, token: { in: tokens } } });
  }

  /** Every staff device in the tenant — staff notifications/announcements are tenant-wide, not per-user, same v1 simplification as the `TenantNotification` feed itself. */
  async listTokensForTenant(tenantId: string): Promise<string[]> {
    const rows = await this.db.staffDeviceToken.findMany({ where: { tenantId }, select: { token: true } });
    return rows.map((r) => r.token);
  }
}
