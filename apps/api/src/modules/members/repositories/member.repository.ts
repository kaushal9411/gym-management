import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { ListMembersQuery } from '../dto/member.dto';

const MEMBER_INCLUDE = {
  branch: { select: { id: true, name: true } },
  trainer: { select: { id: true, name: true } },
  memberships: {
    orderBy: { createdAt: 'desc' },
    include: { plan: { select: { id: true, name: true } } },
  },
  freezes: { orderBy: { frozenAt: 'desc' } },
} satisfies Prisma.MemberInclude;

export type MemberRow = Prisma.MemberGetPayload<{ include: typeof MEMBER_INCLUDE }>;

function buildWhere(tenantId: string, query: Partial<ListMembersQuery>): Prisma.MemberWhereInput {
  const where: Prisma.MemberWhereInput = { tenantId };
  if (!query.includeDeleted) where.deletedAt = null;
  if (query.status) where.status = query.status;
  if (query.branchId) where.branchId = query.branchId;
  if (query.trainerId) where.trainerId = query.trainerId;
  if (query.membershipStatus) where.memberships = { some: { status: query.membershipStatus } };
  if (query.search) {
    const contains = { contains: query.search, mode: 'insensitive' as const };
    where.AND = [
      { OR: [{ firstName: contains }, { lastName: contains }, { email: contains }, { phone: contains }, { memberId: contains }] },
    ];
  }
  return where;
}

export class MemberRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(tenantId: string, query: ListMembersQuery): Promise<{ items: MemberRow[]; total: number }> {
    const where = buildWhere(tenantId, query);
    const orderBy: Prisma.MemberOrderByWithRelationInput =
      query.sortBy === 'name'
        ? { firstName: query.sortDir }
        : query.sortBy === 'memberId'
          ? { memberId: query.sortDir }
          : { [query.sortBy]: query.sortDir };
    const [items, total] = await Promise.all([
      this.db.member.findMany({
        where,
        include: MEMBER_INCLUDE,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.db.member.count({ where }),
    ]);
    return { items, total };
  }

  async findDetail(tenantId: string, id: string, opts?: { includeDeleted?: boolean }): Promise<MemberRow | null> {
    return this.db.member.findFirst({
      where: { tenantId, id, ...(opts?.includeDeleted ? {} : { deletedAt: null }) },
      include: MEMBER_INCLUDE,
    });
  }

  /** Includes soft-deleted rows — duplicate checks must see them (email/memberId stay reserved). */
  async findByEmail(tenantId: string, email: string) {
    return this.db.member.findFirst({ where: { tenantId, email } });
  }

  async findByPhone(tenantId: string, phone: string) {
    return this.db.member.findFirst({ where: { tenantId, phone, deletedAt: null } });
  }

  async findByMemberId(tenantId: string, memberId: string) {
    return this.db.member.findFirst({ where: { tenantId, memberId } });
  }

  /** Looks a member up by their opaque QR token — used by the Attendance module's QR check-in flow. */
  async findByQrToken(tenantId: string, qrCodeToken: string): Promise<MemberRow | null> {
    return this.db.member.findFirst({ where: { tenantId, qrCodeToken, deletedAt: null }, include: MEMBER_INCLUDE });
  }

  async create(data: Prisma.MemberUncheckedCreateInput): Promise<MemberRow> {
    const member = await this.db.member.create({ data });
    return (await this.findDetail(data.tenantId, member.id, { includeDeleted: true }))!;
  }

  async update(id: string, data: Prisma.MemberUncheckedUpdateInput): Promise<void> {
    await this.db.member.update({ where: { id }, data });
  }

  async setStatus(id: string, status: 'ACTIVE' | 'INACTIVE' | 'FROZEN'): Promise<void> {
    await this.db.member.update({ where: { id }, data: { status } });
  }

  async softDelete(id: string): Promise<void> {
    await this.db.member.update({ where: { id }, data: { deletedAt: new Date(), status: 'INACTIVE' } });
  }

  async restore(id: string): Promise<void> {
    await this.db.member.update({ where: { id }, data: { deletedAt: null, status: 'ACTIVE' } });
  }

  async countTotal(tenantId: string): Promise<number> {
    return this.db.member.count({ where: { tenantId, deletedAt: null } });
  }

  /** Unpaginated projection for CSV export (capped). */
  async listForExport(tenantId: string, cap = 10_000): Promise<MemberRow[]> {
    return this.db.member.findMany({
      where: { tenantId, deletedAt: null },
      include: MEMBER_INCLUDE,
      orderBy: { createdAt: 'asc' },
      take: cap,
    });
  }

  /** Count-based sequence — a collision just retries with the next number. */
  async nextMemberCode(tenantId: string): Promise<string> {
    const count = await this.db.member.count({ where: { tenantId } });
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = `MEM-${String(count + 1 + attempt).padStart(4, '0')}`;
      const existing = await this.findByMemberId(tenantId, candidate);
      if (!existing) return candidate;
    }
    return `MEM-${Date.now()}`;
  }
}
