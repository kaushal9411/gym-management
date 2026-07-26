import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { ListBranchesQuery } from '../dto/branch.dto';

const BRANCH_INCLUDE = {
  _count: { select: { members: { where: { deletedAt: null } }, userBranches: true } },
} satisfies Prisma.BranchInclude;

export type BranchRow = Prisma.BranchGetPayload<{ include: typeof BRANCH_INCLUDE }>;

function buildWhere(tenantId: string, query: Partial<ListBranchesQuery>): Prisma.BranchWhereInput {
  const where: Prisma.BranchWhereInput = { tenantId };
  if (!query.includeDeleted) where.deletedAt = null;
  if (query.isActive !== undefined) where.isActive = query.isActive;
  if (query.search) {
    const contains = { contains: query.search, mode: 'insensitive' as const };
    where.OR = [{ name: contains }, { branchCode: contains }, { city: contains }, { email: contains }];
  }
  return where;
}

/**
 * Extended in Prompt 22 (Branch Management) from Prompt 10's read-only
 * scaffold — `listAssignable` below preserves that original method's exact
 * behavior/shape (the portal's branch selector and every `BranchSelect`
 * dropdown across the app call it, unchanged) while `list` is the new
 * paginated management view.
 */
export class BranchRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(tenantId: string, query: ListBranchesQuery): Promise<{ items: BranchRow[]; total: number }> {
    const where = buildWhere(tenantId, query);
    const [items, total] = await Promise.all([
      this.db.branch.findMany({
        where,
        include: BRANCH_INCLUDE,
        orderBy: query.sortBy === 'name' ? [{ isDefault: 'desc' }, { name: query.sortDir }] : { [query.sortBy]: query.sortDir },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.db.branch.count({ where }),
    ]);
    return { items, total };
  }

  /** Unfiltered active-branch list — the pre-existing behavior every branch selector/dropdown across the app depends on. Do not add pagination/filters here; use `list` for the management view instead. */
  async listAssignable(tenantId: string) {
    return this.db.branch.findMany({
      where: { tenantId, deletedAt: null, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async findById(tenantId: string, id: string, opts?: { includeDeleted?: boolean }): Promise<BranchRow | null> {
    return this.db.branch.findFirst({
      where: { tenantId, id, ...(opts?.includeDeleted ? {} : { deletedAt: null }) },
      include: BRANCH_INCLUDE,
    });
  }

  async findByName(tenantId: string, name: string) {
    return this.db.branch.findFirst({ where: { tenantId, name: { equals: name, mode: 'insensitive' } } });
  }

  async findByBranchCode(tenantId: string, branchCode: string) {
    return this.db.branch.findFirst({ where: { tenantId, branchCode } });
  }

  async countActive(tenantId: string): Promise<number> {
    return this.db.branch.count({ where: { tenantId, deletedAt: null, isActive: true } });
  }

  async countTotal(tenantId: string): Promise<number> {
    return this.db.branch.count({ where: { tenantId, deletedAt: null } });
  }

  async create(data: Prisma.BranchUncheckedCreateInput): Promise<BranchRow> {
    const branch = await this.db.branch.create({ data });
    return (await this.findById(data.tenantId, branch.id, { includeDeleted: true }))!;
  }

  async update(id: string, data: Omit<Prisma.BranchUncheckedUpdateInput, 'tenantId'>): Promise<void> {
    await this.db.branch.update({ where: { id }, data });
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    await this.db.branch.update({ where: { id }, data: { isActive } });
  }

  /** Clears every other branch's default flag first — only one default per tenant, and the tenant-scoped client can't batch these into one `$transaction`, so this is sequential (small, infrequent operation; branch counts are always small). */
  async clearDefault(tenantId: string): Promise<void> {
    await this.db.branch.updateMany({ where: { tenantId, isDefault: true }, data: { isDefault: false } });
  }

  async setDefault(id: string): Promise<void> {
    await this.db.branch.update({ where: { id }, data: { isDefault: true } });
  }

  async softDelete(id: string): Promise<void> {
    await this.db.branch.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  /** Matches Membership Plan's restore semantics — brings the branch back fully usable in one step, not just un-deleted. */
  async restore(id: string): Promise<void> {
    await this.db.branch.update({ where: { id }, data: { deletedAt: null, isActive: true } });
  }

  /** Count-based sequence — a collision just retries with the next number, same pattern as `MembershipPlanRepository.nextPlanCode`. */
  async nextBranchCode(tenantId: string): Promise<string> {
    const count = await this.db.branch.count({ where: { tenantId } });
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = `BR-${String(count + 1 + attempt).padStart(4, '0')}`;
      const existing = await this.findByBranchCode(tenantId, candidate);
      if (!existing) return candidate;
    }
    return `BR-${Date.now()}`;
  }
}
