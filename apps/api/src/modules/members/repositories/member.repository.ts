import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { ListMembersQuery } from '../dto/member.dto';
import {
  decryptMemberContact,
  decryptMemberContactMany,
  encryptEmail,
  encryptPhone,
  hashEmail,
  hashPhone,
} from '../utils/member-pii.util';

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

/**
 * `email`/`phone` are excluded from the free-text search — they're AES-GCM
 * ciphertext at rest (see `member-pii.util.ts`), which can't be
 * `contains`-matched in SQL. An exact email/phone still resolves via
 * `findByEmail`/`findByPhone`'s hash lookup; only PARTIAL email/phone
 * matching is gone (name/Member ID search is unaffected). Confirmed
 * trade-off with the user before building field-level encryption.
 */
/**
 * `restrictToBranchIds` is the actor's OWN branch scope (omitted entirely
 * for `allBranches` staff) — found missing during a QA pass (Prompt 48):
 * without it, a single-branch-scoped Receptionist could list every
 * member in the tenant, not just their own branch's, simply by omitting
 * the `branchId` query filter. An explicit `query.branchId` outside the
 * actor's own scope is intersected down to zero rows, not silently
 * widened to "show everything" or ignored.
 */
function buildWhere(tenantId: string, query: Partial<ListMembersQuery>, restrictToBranchIds?: string[]): Prisma.MemberWhereInput {
  const where: Prisma.MemberWhereInput = { tenantId };
  if (!query.includeDeleted) where.deletedAt = null;
  if (query.status) where.status = query.status;
  if (query.trainerId) where.trainerId = query.trainerId;
  if (query.membershipStatus) where.memberships = { some: { status: query.membershipStatus } };
  if (query.search) {
    const contains = { contains: query.search, mode: 'insensitive' as const };
    where.AND = [{ OR: [{ firstName: contains }, { lastName: contains }, { memberId: contains }] }];
  }

  if (restrictToBranchIds) {
    where.branchId = query.branchId
      ? restrictToBranchIds.includes(query.branchId)
        ? query.branchId
        : { in: [] }
      : { in: restrictToBranchIds };
  } else if (query.branchId) {
    where.branchId = query.branchId;
  }
  return where;
}

/**
 * Encrypts `email`/`phone` (+ their blind-index hashes) on the way into a
 * create/update — the one write funnel for `Member` PII. Only plain
 * string/null values are handled (the only form this codebase ever passes
 * for these two fields) — a scalar `{set: ...}` update-operation object is
 * left untouched, since nothing here ever sends one.
 */
function encryptContact(data: Prisma.MemberUncheckedCreateInput): Prisma.MemberUncheckedCreateInput;
function encryptContact(data: Prisma.MemberUncheckedUpdateInput): Prisma.MemberUncheckedUpdateInput;
function encryptContact(
  data: Prisma.MemberUncheckedCreateInput | Prisma.MemberUncheckedUpdateInput,
): Prisma.MemberUncheckedCreateInput | Prisma.MemberUncheckedUpdateInput {
  const out = { ...data };
  if (typeof data.email === 'string') {
    out.email = encryptEmail(data.email);
    out.emailHash = hashEmail(data.email);
  } else if (data.email === null) {
    out.emailHash = null;
  }
  if (typeof data.phone === 'string') {
    out.phone = encryptPhone(data.phone);
    out.phoneHash = hashPhone(data.phone);
  } else if (data.phone === null) {
    out.phoneHash = null;
  }
  return out;
}

export class MemberRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(tenantId: string, query: ListMembersQuery, restrictToBranchIds?: string[]): Promise<{ items: MemberRow[]; total: number }> {
    const where = buildWhere(tenantId, query, restrictToBranchIds);
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
    return { items: decryptMemberContactMany(items), total };
  }

  async findDetail(tenantId: string, id: string, opts?: { includeDeleted?: boolean }): Promise<MemberRow | null> {
    const member = await this.db.member.findFirst({
      where: { tenantId, id, ...(opts?.includeDeleted ? {} : { deletedAt: null }) },
      include: MEMBER_INCLUDE,
    });
    return member ? decryptMemberContact(member) : null;
  }

  /** Exact-match via the blind index — includes soft-deleted rows, since duplicate checks must see them (email stays reserved). Ciphertext can't be equality-matched directly. */
  async findByEmail(tenantId: string, email: string) {
    return this.db.member.findFirst({ where: { tenantId, emailHash: hashEmail(email) } });
  }

  async findByPhone(tenantId: string, phone: string) {
    return this.db.member.findFirst({ where: { tenantId, phoneHash: hashPhone(phone), deletedAt: null } });
  }

  async findByMemberId(tenantId: string, memberId: string) {
    return this.db.member.findFirst({ where: { tenantId, memberId } });
  }

  /** Looks a member up by their opaque QR token — used by the Attendance module's QR check-in flow. */
  async findByQrToken(tenantId: string, qrCodeToken: string): Promise<MemberRow | null> {
    const member = await this.db.member.findFirst({ where: { tenantId, qrCodeToken, deletedAt: null }, include: MEMBER_INCLUDE });
    return member ? decryptMemberContact(member) : null;
  }

  async create(data: Prisma.MemberUncheckedCreateInput): Promise<MemberRow> {
    const member = await this.db.member.create({ data: encryptContact(data) });
    return (await this.findDetail(data.tenantId, member.id, { includeDeleted: true }))!;
  }

  async update(id: string, data: Prisma.MemberUncheckedUpdateInput): Promise<void> {
    await this.db.member.update({ where: { id }, data: encryptContact(data) });
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
  async listForExport(tenantId: string, restrictToBranchIds?: string[], cap = 10_000): Promise<MemberRow[]> {
    const rows = await this.db.member.findMany({
      where: { tenantId, deletedAt: null, ...(restrictToBranchIds ? { branchId: { in: restrictToBranchIds } } : {}) },
      include: MEMBER_INCLUDE,
      orderBy: { createdAt: 'asc' },
      take: cap,
    });
    return decryptMemberContactMany(rows);
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
