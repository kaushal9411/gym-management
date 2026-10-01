import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { ListMembersQuery } from '../dto/member.dto';
import {
  decryptMemberContact,
  decryptMemberContactMany,
  decryptMemberField,
  encryptEmail,
  encryptPhone,
  hashEmail,
  hashPhone,
} from '../utils/member-pii.util';

const MEMBER_INCLUDE = {
  branch: { select: { id: true, name: true } },
  trainer: { select: { id: true, name: true } },
  referredByMember: { select: { id: true, memberId: true, firstName: true, lastName: true } },
  credential: { select: { status: true } },
  memberships: {
    orderBy: { createdAt: 'desc' },
    // Selected fields beyond id/name back plan-based enforcement (freeze
    // gating, branch access, guest-pass/PT-session/class quotas) that reads
    // a member's active membership's plan — AttendanceService,
    // MemberService#freeze, and the guest-visit/pt-session/class-booking
    // quota checks all rely on this same include.
    include: {
      plan: {
        select: {
          id: true,
          name: true,
          freezeAllowed: true,
          freezeDaysLimit: true,
          gymAccessAllBranches: true,
          accessBranchIds: true,
          guestPasses: true,
          ptSessionsIncluded: true,
          groupClassesIncluded: true,
        },
      },
    },
  },
  freezes: { orderBy: { frozenAt: 'desc' } },
} satisfies Prisma.MemberInclude;

export type MemberRow = Prisma.MemberGetPayload<{ include: typeof MEMBER_INCLUDE }>;

/**
 * Phone is AES-GCM ciphertext at rest (see `member-pii.util.ts`), so it
 * can't be `contains`-matched in SQL like `firstName`/`lastName`/`memberId`
 * — substring phone search (Prompt 95, user-requested despite the
 * documented Prompt 43 trade-off) instead decrypts every phone in the
 * tenant that matches every OTHER active filter (branch/status/etc, just
 * not `search` itself) and filters in memory on digits-only containment.
 * Deliberately not capped/paginated — a partial match that silently missed
 * rows past some cutoff would be worse than the cost of decrypting a
 * tenant's full member roster per search-with-digits request. Only runs
 * when `search` contains at least one digit, so a pure-name search never
 * pays this cost. Email stays exact-match-only (hash lookup) — not asked
 * for the same treatment here.
 */
async function findPhoneMatchingIds(
  db: TenantScopedPrisma,
  whereWithoutSearch: Prisma.MemberWhereInput,
  search: string,
): Promise<string[]> {
  const digits = search.replace(/\D/g, '');
  if (!digits) return [];
  const candidates = await db.member.findMany({
    where: { ...whereWithoutSearch, phone: { not: null } },
    select: { id: true, phone: true },
  });
  return candidates.filter((c) => c.phone && decryptMemberField(c.phone).replace(/\D/g, '').includes(digits)).map((c) => c.id);
}

/**
 * `restrictToBranchIds` is the actor's OWN branch scope (omitted entirely
 * for `allBranches` staff) — found missing during a QA pass (Prompt 48):
 * without it, a single-branch-scoped Receptionist could list every
 * member in the tenant, not just their own branch's, simply by omitting
 * the `branchId` query filter. An explicit `query.branchId` outside the
 * actor's own scope is intersected down to zero rows, not silently
 * widened to "show everything" or ignored.
 */
function buildWhere(
  tenantId: string,
  query: Partial<ListMembersQuery>,
  restrictToBranchIds?: string[],
  phoneMatchIds?: string[],
): Prisma.MemberWhereInput {
  const where: Prisma.MemberWhereInput = { tenantId };
  if (!query.includeDeleted) where.deletedAt = null;
  if (query.status) where.status = query.status;
  if (query.trainerId) where.trainerId = query.trainerId;
  if (query.membershipStatus) where.memberships = { some: { status: query.membershipStatus } };
  if (query.search) {
    const contains = { contains: query.search, mode: 'insensitive' as const };
    where.AND = [
      {
        OR: [
          { firstName: contains },
          { lastName: contains },
          { memberId: contains },
          ...(phoneMatchIds && phoneMatchIds.length > 0 ? [{ id: { in: phoneMatchIds } }] : []),
        ],
      },
    ];
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
    const phoneMatchIds = query.search
      ? await findPhoneMatchingIds(this.db, buildWhere(tenantId, { ...query, search: undefined }, restrictToBranchIds), query.search)
      : [];
    const where = buildWhere(tenantId, query, restrictToBranchIds, phoneMatchIds);
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
