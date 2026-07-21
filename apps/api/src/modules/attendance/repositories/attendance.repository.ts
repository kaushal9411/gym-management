import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { ListAttendanceQuery } from '../dto/attendance.dto';

const ATTENDANCE_INCLUDE = {
  member: {
    select: { id: true, memberId: true, firstName: true, lastName: true, profilePhotoUrl: true, branchId: true, status: true },
  },
  branch: { select: { id: true, name: true, timezone: true } },
  checkedInByUser: { select: { id: true, name: true } },
  checkedOutByUser: { select: { id: true, name: true } },
} satisfies Prisma.AttendanceInclude;

export type AttendanceRow = Prisma.AttendanceGetPayload<{ include: typeof ATTENDANCE_INCLUDE }>;

function buildWhere(tenantId: string, query: Partial<ListAttendanceQuery>): Prisma.AttendanceWhereInput {
  const where: Prisma.AttendanceWhereInput = { tenantId };
  if (!query.includeDeleted) where.deletedAt = null;
  if (query.branchId) where.branchId = query.branchId;
  if (query.memberId) where.memberId = query.memberId;
  if (query.status) where.status = query.status;
  if (query.method) where.method = query.method;
  if (query.dateFrom || query.dateTo) {
    where.attendanceDate = {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
    };
  }
  if (query.search) {
    const contains = { contains: query.search, mode: 'insensitive' as const };
    where.member = { OR: [{ firstName: contains }, { lastName: contains }, { memberId: contains }] };
  }
  return where;
}

export class AttendanceRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(tenantId: string, query: ListAttendanceQuery): Promise<{ items: AttendanceRow[]; total: number }> {
    const where = buildWhere(tenantId, query);
    const [items, total] = await Promise.all([
      this.db.attendance.findMany({
        where,
        include: ATTENDANCE_INCLUDE,
        orderBy: { [query.sortBy]: query.sortDir },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.db.attendance.count({ where }),
    ]);
    return { items, total };
  }

  async findById(tenantId: string, id: string, opts?: { includeDeleted?: boolean }): Promise<AttendanceRow | null> {
    return this.db.attendance.findFirst({
      where: { tenantId, id, ...(opts?.includeDeleted ? {} : { deletedAt: null }) },
      include: ATTENDANCE_INCLUDE,
    });
  }

  /** The member's currently-open (not checked out) record, if any — backs the "one active check-in per member" rule. */
  async findOpenByMember(tenantId: string, memberId: string): Promise<AttendanceRow | null> {
    return this.db.attendance.findFirst({
      where: { tenantId, memberId, checkOutTime: null, deletedAt: null },
      include: ATTENDANCE_INCLUDE,
    });
  }

  async create(data: Prisma.AttendanceUncheckedCreateInput): Promise<AttendanceRow> {
    const record = await this.db.attendance.create({ data });
    return (await this.findById(data.tenantId, record.id, { includeDeleted: true }))!;
  }

  async update(id: string, data: Omit<Prisma.AttendanceUncheckedUpdateInput, 'tenantId'>): Promise<void> {
    await this.db.attendance.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<void> {
    await this.db.attendance.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async findByMember(
    tenantId: string,
    memberId: string,
    pagination: { page: number; limit: number },
  ): Promise<{ items: AttendanceRow[]; total: number }> {
    const where: Prisma.AttendanceWhereInput = { tenantId, memberId, deletedAt: null };
    const [items, total] = await Promise.all([
      this.db.attendance.findMany({
        where,
        include: ATTENDANCE_INCLUDE,
        orderBy: { checkInTime: 'desc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.db.attendance.count({ where }),
    ]);
    return { items, total };
  }

  async countForDate(tenantId: string, dateStr: string, branchId?: string): Promise<{ checkIns: number; checkOuts: number; currentlyInside: number }> {
    const date = new Date(dateStr);
    const branchFilter = branchId ? { branchId } : {};
    const [checkIns, checkOuts, currentlyInside] = await Promise.all([
      this.db.attendance.count({ where: { tenantId, attendanceDate: date, deletedAt: null, ...branchFilter } }),
      this.db.attendance.count({ where: { tenantId, attendanceDate: date, checkOutTime: { not: null }, deletedAt: null, ...branchFilter } }),
      this.db.attendance.count({ where: { tenantId, checkOutTime: null, deletedAt: null, ...branchFilter } }),
    ]);
    return { checkIns, checkOuts, currentlyInside };
  }

  /** All check-in timestamps for one date — small per-day cardinality, used to bucket the "peak check-in hour" stat. */
  async listCheckInTimesForDate(tenantId: string, dateStr: string, branchId?: string): Promise<Date[]> {
    const rows = await this.db.attendance.findMany({
      where: { tenantId, attendanceDate: new Date(dateStr), deletedAt: null, ...(branchId ? { branchId } : {}) },
      select: { checkInTime: true },
    });
    return rows.map((r) => r.checkInTime);
  }

  /** Daily check-in counts between two dates (inclusive) — backs the Attendance Trend chart. */
  async trendBetween(tenantId: string, fromStr: string, toStr: string, branchId?: string): Promise<Array<{ date: string; count: number }>> {
    const rows = await this.db.attendance.groupBy({
      by: ['attendanceDate'],
      where: { tenantId, attendanceDate: { gte: new Date(fromStr), lte: new Date(toStr) }, deletedAt: null, ...(branchId ? { branchId } : {}) },
      _count: { _all: true },
      orderBy: { attendanceDate: 'asc' },
    });
    return rows.map((r) => ({ date: r.attendanceDate.toISOString().slice(0, 10), count: r._count._all }));
  }

  async listForExport(tenantId: string, query: Partial<ListAttendanceQuery>): Promise<AttendanceRow[]> {
    const where = buildWhere(tenantId, query);
    return this.db.attendance.findMany({ where, include: ATTENDANCE_INCLUDE, orderBy: { checkInTime: 'desc' } });
  }
}
