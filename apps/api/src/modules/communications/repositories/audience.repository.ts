import type { Prisma, TenantNotificationChannel } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { decryptMemberField, hashEmail, hashPhone } from '../../members/utils/member-pii.util';

/** Everything the sender needs about one member - contact values are DECRYPTED, never log or return them. */
export interface MemberProfile {
  id: string;
  memberCode: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  branchId: string;
  branchName: string;
  timezone: string;
  planName: string | null;
  endDate: Date | null;
  amountDue: number;
  deviceTokens: string[];
  optedOut: Set<TenantNotificationChannel>;
  /** False for deleted / INACTIVE members - automations skip them. */
  messageable: boolean;
}

const OPEN_INVOICE = ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] as const;
const CHUNK = 500;

function safeDecrypt(value: string | null): string | null {
  if (!value) return null;
  try {
    return decryptMemberField(value);
  } catch {
    return null;
  }
}

export class AudienceRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async countMembers(where: Prisma.MemberWhereInput): Promise<number> {
    return this.db.member.count({ where });
  }

  /** Up to `take` member ids (callers ask for cap + 1 to detect an oversized audience). */
  async findMemberIds(where: Prisma.MemberWhereInput, take?: number): Promise<string[]> {
    const rows = await this.db.member.findMany({ where, select: { id: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], ...(take ? { take } : {}) });
    return rows.map((r) => r.id);
  }

  async sample(where: Prisma.MemberWhereInput, take: number) {
    return this.db.member.findMany({ where, select: { id: true, memberId: true, firstName: true, lastName: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take });
  }

  /** Members with a date of birth - the birthday filter is evaluated in JS (`isBirthdayWithin`). */
  async birthdayCandidates(tenantId: string, scopeBranchIds: string[] | null) {
    return this.db.member.findMany({
      where: { tenantId, deletedAt: null, status: { in: ['ACTIVE', 'FROZEN'] }, dateOfBirth: { not: null }, ...(scopeBranchIds ? { branchId: { in: scopeBranchIds } } : {}) },
      select: { id: true, dateOfBirth: true },
    });
  }

  /** The picked ids that exist in this tenant (any status), with what the scope check needs. */
  async findPicked(tenantId: string, ids: string[]) {
    const out: Array<{ id: string; branchId: string; status: string; firstName: string; lastName: string }> = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      // eslint-disable-next-line no-await-in-loop -- bounded chunks
      const rows = await this.db.member.findMany({
        where: { tenantId, deletedAt: null, id: { in: ids.slice(i, i + CHUNK) } },
        select: { id: true, branchId: true, status: true, firstName: true, lastName: true },
      });
      out.push(...rows);
    }
    return out;
  }

  /** Counts for the preview: members matching `where` that also satisfy `extra`. */
  async countWith(where: Prisma.MemberWhereInput, extra: Prisma.MemberWhereInput): Promise<number> {
    return this.db.member.count({ where: { AND: [where, extra] } });
  }

  async searchMembers(params: {
    tenantId: string;
    scopeBranchIds: string[] | null;
    search?: string;
    branchId?: string;
    skip: number;
    take: number;
  }) {
    const and: Prisma.MemberWhereInput[] = [
      { tenantId: params.tenantId, deletedAt: null, status: { in: ['ACTIVE', 'FROZEN'] } },
      ...(params.scopeBranchIds ? [{ branchId: { in: params.scopeBranchIds } }] : []),
      ...(params.branchId ? [{ branchId: params.branchId }] : []),
    ];
    if (params.search) {
      const q = params.search;
      // Email/phone are encrypted at rest: only an exact value matches, through the blind index.
      const exact: Prisma.MemberWhereInput[] = [];
      if (q.includes('@')) exact.push({ emailHash: hashEmail(q) });
      else if (/^\+?[0-9\s-]{7,15}$/.test(q)) exact.push({ phoneHash: hashPhone(q) });
      and.push({
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { memberId: { contains: q, mode: 'insensitive' } },
          ...exact,
        ],
      });
    }
    const where: Prisma.MemberWhereInput = { AND: and };
    const [total, rows] = await Promise.all([
      this.db.member.count({ where }),
      this.db.member.findMany({
        where,
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }, { id: 'asc' }],
        skip: params.skip,
        take: params.take,
        select: {
          id: true,
          memberId: true,
          firstName: true,
          lastName: true,
          status: true,
          email: true,
          phone: true,
          branchId: true,
          branch: { select: { name: true } },
          memberships: { where: { status: { in: ['ACTIVE', 'PENDING', 'EXPIRED'] } }, orderBy: { endDate: 'desc' }, take: 1, select: { status: true, plan: { select: { name: true } } } },
          _count: { select: { deviceTokens: true, memberships: true } },
        },
      }),
    ]);
    return { total, rows };
  }

  /** Loads decrypted contact data + placeholder inputs for a set of members, in bounded chunks. */
  async loadProfiles(tenantId: string, ids: string[]): Promise<Map<string, MemberProfile>> {
    const out = new Map<string, MemberProfile>();
    for (let i = 0; i < ids.length; i += CHUNK) {
      // eslint-disable-next-line no-await-in-loop -- bounded chunks
      const rows = await this.db.member.findMany({
        where: { tenantId, id: { in: ids.slice(i, i + CHUNK) } },
        select: {
          id: true,
          memberId: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          branchId: true,
          status: true,
          deletedAt: true,
          branch: { select: { name: true, timezone: true } },
          memberships: { where: { status: { in: ['ACTIVE', 'PENDING', 'EXPIRED'] } }, orderBy: { endDate: 'desc' }, take: 1, select: { endDate: true, plan: { select: { name: true } } } },
          invoices: {
            where: { status: { in: [...OPEN_INVOICE] } },
            select: { totalAmount: true, payments: { where: { status: { in: ['SUCCESS', 'PARTIALLY_REFUNDED'] } }, select: { finalAmount: true } } },
          },
          deviceTokens: { select: { token: true }, take: 10 },
          channelPreferences: { where: { promotionalOptOut: true }, select: { channel: true } },
        },
      });
      for (const r of rows) {
        const latest = r.memberships[0] ?? null;
        const amountDue = r.invoices.reduce((sum, inv) => {
          const settled = inv.payments.reduce((s, p) => s + Number(p.finalAmount), 0);
          return sum + Math.max(Number(inv.totalAmount) - settled, 0);
        }, 0);
        out.set(r.id, {
          id: r.id,
          memberCode: r.memberId,
          firstName: r.firstName,
          lastName: r.lastName,
          email: safeDecrypt(r.email),
          phone: safeDecrypt(r.phone),
          branchId: r.branchId,
          branchName: r.branch.name,
          timezone: r.branch.timezone || 'UTC',
          planName: latest?.plan.name ?? null,
          endDate: latest?.endDate ?? null,
          amountDue,
          deviceTokens: r.deviceTokens.map((d) => d.token),
          optedOut: new Set(r.channelPreferences.map((p) => p.channel)),
          messageable: r.deletedAt === null && r.status !== 'INACTIVE',
        });
      }
    }
    return out;
  }
}
