import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { toDateCol } from '../utils/hr-dates.util';

export const LEAVE_INCLUDE = { leaveType: true } satisfies Prisma.HrLeaveRequestInclude;
export type LeaveRow = Prisma.HrLeaveRequestGetPayload<{ include: typeof LEAVE_INCLUDE }>;
export type BalanceRow = Prisma.HrLeaveBalanceGetPayload<Record<string, never>>;

export interface LeaveListFilter {
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  userId?: string;
  userIds?: string[];
  leaveTypeId?: string;
  from?: string;
  to?: string;
}

function where(tenantId: string, f: LeaveListFilter): Prisma.HrLeaveRequestWhereInput {
  const w: Prisma.HrLeaveRequestWhereInput = { tenantId };
  if (f.status) w.status = f.status;
  if (f.userId) w.userId = f.userId;
  else if (f.userIds) w.userId = { in: f.userIds };
  if (f.leaveTypeId) w.leaveTypeId = f.leaveTypeId;
  if (f.from) w.endDate = { gte: toDateCol(f.from) };
  if (f.to) w.startDate = { lte: toDateCol(f.to) };
  return w;
}

export class HrLeaveRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  // ── requests ────────────────────────────────────────────────────────────
  findById(tenantId: string, id: string): Promise<LeaveRow | null> {
    return this.db.hrLeaveRequest.findFirst({ where: { tenantId, id }, include: LEAVE_INCLUDE });
  }

  async list(tenantId: string, f: LeaveListFilter, skip: number, take: number, pendingFirst: boolean): Promise<{ items: LeaveRow[]; total: number }> {
    const w = where(tenantId, f);
    const [items, total] = await Promise.all([
      this.db.hrLeaveRequest.findMany({
        where: w,
        include: LEAVE_INCLUDE,
        orderBy: pendingFirst ? [{ status: 'asc' }, { createdAt: 'desc' }] : [{ createdAt: 'desc' }],
        skip,
        take,
      }),
      this.db.hrLeaveRequest.count({ where: w }),
    ]);
    return { items, total };
  }

  async countsByStatus(tenantId: string, f: LeaveListFilter): Promise<Record<'pending' | 'approved' | 'rejected' | 'cancelled', number>> {
    const rows = await this.db.hrLeaveRequest.groupBy({ by: ['status'], where: where(tenantId, { ...f, status: undefined }), _count: { _all: true } });
    const get = (s: string) => rows.find((r) => r.status === s)?._count._all ?? 0;
    return { pending: get('PENDING'), approved: get('APPROVED'), rejected: get('REJECTED'), cancelled: get('CANCELLED') };
  }

  /** PENDING/APPROVED requests of a user (or several) whose dates intersect [from, to]. */
  openOverlapping(tenantId: string, userIds: string[], from: string, to: string, exceptId?: string): Promise<LeaveRow[]> {
    return this.db.hrLeaveRequest.findMany({
      where: {
        tenantId,
        userId: { in: userIds },
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: toDateCol(to) },
        endDate: { gte: toDateCol(from) },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      include: LEAVE_INCLUDE,
    });
  }

  upcomingApproved(tenantId: string, from: string, to: string, userIds?: string[]): Promise<LeaveRow[]> {
    return this.db.hrLeaveRequest.findMany({
      where: { tenantId, status: 'APPROVED', startDate: { lte: toDateCol(to) }, endDate: { gte: toDateCol(from) }, ...(userIds ? { userId: { in: userIds } } : {}) },
      include: LEAVE_INCLUDE,
      orderBy: { startDate: 'asc' },
    });
  }

  async create(data: Prisma.HrLeaveRequestUncheckedCreateInput): Promise<LeaveRow> {
    const r = await this.db.hrLeaveRequest.create({ data });
    return (await this.findById(data.tenantId, r.id))!;
  }

  /** Atomic status transition: only succeeds while the request is still in `from` (race-safe approve/reject/cancel). */
  async transition(tenantId: string, id: string, from: Array<'PENDING' | 'APPROVED'>, data: Prisma.HrLeaveRequestUncheckedUpdateManyInput): Promise<boolean> {
    const r = await this.db.hrLeaveRequest.updateMany({ where: { tenantId, id, status: { in: from } }, data });
    return r.count === 1;
  }

  countPending(tenantId: string, userIds?: string[]): Promise<number> {
    return this.db.hrLeaveRequest.count({ where: { tenantId, status: 'PENDING', ...(userIds ? { userId: { in: userIds } } : {}) } });
  }

  async pendingCountsByUser(tenantId: string, userIds: string[]): Promise<Map<string, number>> {
    if (userIds.length === 0) return new Map();
    const rows = await this.db.hrLeaveRequest.groupBy({ by: ['userId'], where: { tenantId, status: 'PENDING', userId: { in: userIds } }, _count: { _all: true } });
    return new Map(rows.map((r) => [r.userId, r._count._all]));
  }

  // ── balances ────────────────────────────────────────────────────────────
  listBalances(tenantId: string, userIds: string[], leaveYear: number): Promise<BalanceRow[]> {
    return this.db.hrLeaveBalance.findMany({ where: { tenantId, userId: { in: userIds }, leaveYear } });
  }

  async createBalances(data: Prisma.HrLeaveBalanceCreateManyInput[]): Promise<void> {
    if (data.length === 0) return;
    await this.db.hrLeaveBalance.createMany({ data, skipDuplicates: true });
  }

  async addAdjustment(id: string, delta: number): Promise<void> {
    await this.db.hrLeaveBalance.update({ where: { id }, data: { adjustment: { increment: delta } } });
  }

  /** Σ days of APPROVED and PENDING requests per (user, type) inside a leave year. */
  async usage(tenantId: string, userIds: string[], leaveYear: number): Promise<Array<{ userId: string; leaveTypeId: string; status: string; days: number }>> {
    if (userIds.length === 0) return [];
    const rows = await this.db.hrLeaveRequest.groupBy({
      by: ['userId', 'leaveTypeId', 'status'],
      where: { tenantId, userId: { in: userIds }, leaveYear, status: { in: ['APPROVED', 'PENDING'] } },
      _sum: { days: true },
    });
    return rows.map((r) => ({ userId: r.userId, leaveTypeId: r.leaveTypeId, status: r.status, days: Number(r._sum.days ?? 0) }));
  }
}
