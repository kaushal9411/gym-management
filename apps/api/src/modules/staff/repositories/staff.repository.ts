import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { STAFF_ROLE_NAMES, type ListStaffQuery } from '../dto/staff.dto';

const STAFF_INCLUDE = {
  userRoles: { include: { role: true } },
  userBranches: { include: { branch: true } },
  staffProfile: true,
} satisfies Prisma.UserInclude;

export type StaffUserRow = Prisma.UserGetPayload<{ include: typeof STAFF_INCLUDE }>;

function buildWhere(tenantId: string, query: Partial<ListStaffQuery>): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {
    tenantId,
    userRoles: { some: { role: { name: query.role ?? { in: [...STAFF_ROLE_NAMES] } } } },
  };
  if (!query.includeDeleted) where.deletedAt = null;
  if (query.status) where.status = query.status;
  if (query.branchId) where.userBranches = { some: { branchId: query.branchId } };
  if (query.workStatus || query.employmentType) {
    where.staffProfile = {
      ...(query.workStatus ? { workStatus: query.workStatus } : {}),
      ...(query.employmentType ? { employmentType: query.employmentType } : {}),
    };
  }
  if (query.search) {
    const contains = { contains: query.search, mode: 'insensitive' as const };
    where.AND = [
      { OR: [{ name: contains }, { email: contains }, { phone: contains }, { staffProfile: { employeeId: contains } }] },
    ];
  }
  return where;
}

export class StaffRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(tenantId: string, query: ListStaffQuery): Promise<{ items: StaffUserRow[]; total: number }> {
    const where = buildWhere(tenantId, query);
    const orderBy: Prisma.UserOrderByWithRelationInput =
      query.sortBy === 'employeeId'
        ? { staffProfile: { employeeId: query.sortDir } }
        : query.sortBy === 'joiningDate'
          ? { staffProfile: { joiningDate: query.sortDir } }
          : { [query.sortBy]: query.sortDir };
    const [items, total] = await Promise.all([
      this.db.user.findMany({
        where,
        include: STAFF_INCLUDE,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.db.user.count({ where }),
    ]);
    return { items, total };
  }

  async findDetail(tenantId: string, userId: string): Promise<StaffUserRow | null> {
    return this.db.user.findFirst({
      where: { tenantId, id: userId, userRoles: { some: { role: { name: { in: [...STAFF_ROLE_NAMES] } } } } },
      include: STAFF_INCLUDE,
    });
  }

  async countByRole(tenantId: string, role: string): Promise<number> {
    return this.db.user.count({ where: { tenantId, deletedAt: null, userRoles: { some: { role: { name: role } } } } });
  }

  async countTotalStaff(tenantId: string): Promise<number> {
    return this.db.user.count({
      where: { tenantId, deletedAt: null, userRoles: { some: { role: { name: { in: [...STAFF_ROLE_NAMES] } } } } },
    });
  }

  /** Unpaginated projection for CSV export (capped, mirrors the Users module's export). */
  async listForExport(tenantId: string, cap = 10_000): Promise<StaffUserRow[]> {
    return this.db.user.findMany({
      where: { tenantId, deletedAt: null, userRoles: { some: { role: { name: { in: [...STAFF_ROLE_NAMES] } } } } },
      include: STAFF_INCLUDE,
      orderBy: { createdAt: 'asc' },
      take: cap,
    });
  }
}
