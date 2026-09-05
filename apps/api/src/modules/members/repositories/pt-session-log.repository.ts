import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

const PT_SESSION_INCLUDE = { trainer: { select: { id: true, name: true } } } satisfies Prisma.PtSessionLogInclude;

export type PtSessionLogRow = Prisma.PtSessionLogGetPayload<{ include: typeof PT_SESSION_INCLUDE }>;

export class PtSessionLogRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async countForMembership(tenantId: string, membershipId: string): Promise<number> {
    return this.db.ptSessionLog.count({ where: { tenantId, membershipId } });
  }

  async create(data: Prisma.PtSessionLogUncheckedCreateInput): Promise<PtSessionLogRow> {
    return this.db.ptSessionLog.create({ data, include: PT_SESSION_INCLUDE });
  }

  async listByMember(tenantId: string, memberId: string): Promise<PtSessionLogRow[]> {
    return this.db.ptSessionLog.findMany({ where: { tenantId, memberId }, include: PT_SESSION_INCLUDE, orderBy: { sessionDate: 'desc' } });
  }
}
