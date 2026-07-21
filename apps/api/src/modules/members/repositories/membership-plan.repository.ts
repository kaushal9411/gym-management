import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { ListMembershipPlansQuery } from '../dto/member.dto';

const PLAN_INCLUDE = {
  _count: { select: { memberships: { where: { status: 'ACTIVE' } } } },
} satisfies Prisma.MembershipPlanInclude;

export type MembershipPlanRow = Prisma.MembershipPlanGetPayload<{ include: typeof PLAN_INCLUDE }>;

function buildWhere(tenantId: string, query: Partial<ListMembershipPlansQuery>): Prisma.MembershipPlanWhereInput {
  const where: Prisma.MembershipPlanWhereInput = { tenantId };
  if (!query.includeDeleted) where.deletedAt = null;
  if (query.isActive !== undefined) where.isActive = query.isActive;
  if (query.category) where.category = { equals: query.category, mode: 'insensitive' };
  if (query.search) {
    const contains = { contains: query.search, mode: 'insensitive' as const };
    where.OR = [{ name: contains }, { planCode: contains }, { description: contains }];
  }
  return where;
}

export class MembershipPlanRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(tenantId: string, query: ListMembershipPlansQuery): Promise<{ items: MembershipPlanRow[]; total: number }> {
    const where = buildWhere(tenantId, query);
    const [items, total] = await Promise.all([
      this.db.membershipPlan.findMany({
        where,
        include: PLAN_INCLUDE,
        orderBy: { [query.sortBy]: query.sortDir },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.db.membershipPlan.count({ where }),
    ]);
    return { items, total };
  }

  /** Unfiltered, active-only convenience list — used by Assign/Renew/Upgrade dropdowns. */
  async listAssignable(tenantId: string): Promise<MembershipPlanRow[]> {
    return this.db.membershipPlan.findMany({
      where: { tenantId, deletedAt: null, isActive: true },
      include: PLAN_INCLUDE,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findById(tenantId: string, id: string, opts?: { includeDeleted?: boolean }): Promise<MembershipPlanRow | null> {
    return this.db.membershipPlan.findFirst({
      where: { tenantId, id, ...(opts?.includeDeleted ? {} : { deletedAt: null }) },
      include: PLAN_INCLUDE,
    });
  }

  async findByName(tenantId: string, name: string) {
    return this.db.membershipPlan.findFirst({ where: { tenantId, name: { equals: name, mode: 'insensitive' }, deletedAt: null } });
  }

  async findByPlanCode(tenantId: string, planCode: string) {
    return this.db.membershipPlan.findFirst({ where: { tenantId, planCode } });
  }

  async create(data: Prisma.MembershipPlanUncheckedCreateInput): Promise<MembershipPlanRow> {
    const plan = await this.db.membershipPlan.create({ data });
    return (await this.findById(data.tenantId, plan.id, { includeDeleted: true }))!;
  }

  async update(id: string, data: Omit<Prisma.MembershipPlanUncheckedUpdateInput, 'tenantId'>): Promise<void> {
    await this.db.membershipPlan.update({ where: { id }, data });
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    await this.db.membershipPlan.update({ where: { id }, data: { isActive } });
  }

  async softDelete(id: string): Promise<void> {
    await this.db.membershipPlan.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  /** Matches Member/Staff restore semantics — brings the plan back fully usable in one step, not just un-deleted. */
  async restore(id: string): Promise<void> {
    await this.db.membershipPlan.update({ where: { id }, data: { deletedAt: null, isActive: true } });
  }

  /** Count-based sequence — a collision just retries with the next number. */
  async nextPlanCode(tenantId: string): Promise<string> {
    const count = await this.db.membershipPlan.count({ where: { tenantId } });
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = `PLAN-${String(count + 1 + attempt).padStart(4, '0')}`;
      const existing = await this.findByPlanCode(tenantId, candidate);
      if (!existing) return candidate;
    }
    return `PLAN-${Date.now()}`;
  }
}
