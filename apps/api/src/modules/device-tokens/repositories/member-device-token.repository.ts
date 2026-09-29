import type { DeviceTokenPlatform } from '@prisma/client';

import { prisma } from '../../../infrastructure/database/prisma';
import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

export class MemberDeviceTokenRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  /** Raw `prisma` for the same cross-tenant-reassignment reason as `StaffDeviceTokenRepository#upsert` — see its doc comment. */
  async upsert(tenantId: string, memberId: string, token: string, platform: DeviceTokenPlatform): Promise<void> {
    await prisma.memberDeviceToken.upsert({
      where: { token },
      create: { tenantId, memberId, token, platform },
      update: { tenantId, memberId, platform, lastSeenAt: new Date() },
    });
  }

  async remove(tenantId: string, token: string): Promise<void> {
    await this.db.memberDeviceToken.deleteMany({ where: { tenantId, token } });
  }

  async removeMany(tenantId: string, tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.db.memberDeviceToken.deleteMany({ where: { tenantId, token: { in: tokens } } });
  }

  async listTokensForMember(tenantId: string, memberId: string): Promise<string[]> {
    const rows = await this.db.memberDeviceToken.findMany({ where: { tenantId, memberId }, select: { token: true } });
    return rows.map((r) => r.token);
  }

  /** Used by announcement publish fan-out — `branchId` filters to members of that branch when the announcement targets one, otherwise every member in the tenant. */
  async listTokensForTenant(tenantId: string, branchId?: string): Promise<string[]> {
    const rows = await this.db.memberDeviceToken.findMany({
      where: { tenantId, ...(branchId ? { member: { branchId } } : {}) },
      select: { token: true },
    });
    return rows.map((r) => r.token);
  }
}
