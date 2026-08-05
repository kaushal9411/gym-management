import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

const LIST_INCLUDE = {
  groupClass: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
  trainer: { select: { id: true, name: true } },
  _count: { select: { bookings: { where: { status: 'BOOKED' } } } },
} satisfies Prisma.ClassSessionInclude;

const DETAIL_INCLUDE = {
  ...LIST_INCLUDE,
  bookings: {
    where: { status: { in: ['BOOKED', 'ATTENDED', 'NO_SHOW'] } },
    include: { member: { select: { id: true, memberId: true, firstName: true, lastName: true } } },
    orderBy: { bookedAt: 'asc' },
  },
} satisfies Prisma.ClassSessionInclude;

export type ClassSessionRow = Prisma.ClassSessionGetPayload<{ include: typeof LIST_INCLUDE }>;
export type ClassSessionDetailRow = Prisma.ClassSessionGetPayload<{ include: typeof DETAIL_INCLUDE }>;

export class ClassSessionRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async listByRange(tenantId: string, filters: { branchId?: string; groupClassId?: string; dateFrom: Date; dateTo: Date }): Promise<ClassSessionRow[]> {
    return this.db.classSession.findMany({
      where: {
        tenantId,
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
        ...(filters.groupClassId ? { groupClassId: filters.groupClassId } : {}),
        sessionDate: { gte: filters.dateFrom, lte: filters.dateTo },
      },
      include: LIST_INCLUDE,
      orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }],
    });
  }

  async findById(tenantId: string, id: string): Promise<ClassSessionDetailRow | null> {
    return this.db.classSession.findFirst({ where: { tenantId, id }, include: DETAIL_INCLUDE });
  }

  async findExisting(tenantId: string, groupClassId: string, sessionDate: Date, startTime: string): Promise<{ id: string } | null> {
    return this.db.classSession.findFirst({ where: { tenantId, groupClassId, sessionDate, startTime }, select: { id: true } });
  }

  async create(data: Prisma.ClassSessionUncheckedCreateInput): Promise<{ id: string }> {
    return this.db.classSession.create({ data, select: { id: true } });
  }
}
