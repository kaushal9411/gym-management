import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

export class GuestVisitRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async countForMembership(tenantId: string, membershipId: string): Promise<number> {
    return this.db.guestVisit.count({ where: { tenantId, membershipId } });
  }

  async create(data: Prisma.GuestVisitUncheckedCreateInput) {
    return this.db.guestVisit.create({ data });
  }

  async listByMember(tenantId: string, memberId: string) {
    return this.db.guestVisit.findMany({ where: { tenantId, memberId }, orderBy: { visitedAt: 'desc' } });
  }
}
