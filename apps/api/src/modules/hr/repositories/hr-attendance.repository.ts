import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { toDateCol } from '../utils/hr-dates.util';

export const ATTENDANCE_ROW_INCLUDE = { leaveRequest: { include: { leaveType: true } } } satisfies Prisma.HrStaffAttendanceInclude;
export type AttendanceRow = Prisma.HrStaffAttendanceGetPayload<{ include: typeof ATTENDANCE_ROW_INCLUDE }>;

export class HrAttendanceRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  findRow(tenantId: string, userId: string, date: string): Promise<AttendanceRow | null> {
    return this.db.hrStaffAttendance.findUnique({ where: { tenantId_userId_date: { tenantId, userId, date: toDateCol(date) } }, include: ATTENDANCE_ROW_INCLUDE });
  }

  rowsForRange(tenantId: string, from: string, to: string, userIds?: string[]): Promise<AttendanceRow[]> {
    return this.db.hrStaffAttendance.findMany({
      where: { tenantId, date: { gte: toDateCol(from), lte: toDateCol(to) }, ...(userIds ? { userId: { in: userIds } } : {}) },
      include: ATTENDANCE_ROW_INCLUDE,
      orderBy: { date: 'asc' },
    });
  }

  async upsertRow(tenantId: string, userId: string, date: string, data: Omit<Prisma.HrStaffAttendanceUncheckedCreateInput, 'tenantId' | 'userId' | 'date'>): Promise<AttendanceRow> {
    await this.db.hrStaffAttendance.upsert({
      where: { tenantId_userId_date: { tenantId, userId, date: toDateCol(date) } },
      create: { tenantId, userId, date: toDateCol(date), ...data },
      update: data,
    });
    return (await this.findRow(tenantId, userId, date))!;
  }

  async deleteRow(tenantId: string, userId: string, date: string): Promise<void> {
    await this.db.hrStaffAttendance.deleteMany({ where: { tenantId, userId, date: toDateCol(date) } });
  }

  async deleteByLeave(tenantId: string, leaveRequestId: string): Promise<number> {
    const r = await this.db.hrStaffAttendance.deleteMany({ where: { tenantId, leaveRequestId } });
    return r.count;
  }
}
