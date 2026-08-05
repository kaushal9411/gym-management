import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

const SESSION_INCLUDE = {
  classSession: {
    include: {
      groupClass: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
      trainer: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.ClassBookingInclude;

export type ClassBookingRow = Prisma.ClassBookingGetPayload<{ include: typeof SESSION_INCLUDE }>;

export class ClassBookingRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async countActive(tenantId: string, classSessionId: string): Promise<number> {
    return this.db.classBooking.count({ where: { tenantId, classSessionId, status: 'BOOKED' } });
  }

  async findActiveByMemberAndSession(tenantId: string, classSessionId: string, memberId: string): Promise<{ id: string; status: string } | null> {
    return this.db.classBooking.findFirst({ where: { tenantId, classSessionId, memberId, status: 'BOOKED' }, select: { id: true, status: true } });
  }

  async findById(tenantId: string, id: string): Promise<ClassBookingRow | null> {
    return this.db.classBooking.findFirst({ where: { tenantId, id }, include: SESSION_INCLUDE });
  }

  async create(data: Prisma.ClassBookingUncheckedCreateInput): Promise<ClassBookingRow> {
    const row = await this.db.classBooking.create({ data });
    return (await this.findById(data.tenantId, row.id))!;
  }

  /**
   * `@@unique([classSessionId, memberId])` means a member can only ever have
   * one `ClassBooking` row per session — cancelling doesn't free the slot for
   * a plain `create()` on a rebook, it would hit the unique constraint. This
   * revives the existing (cancelled) row instead of inserting a new one, the
   * same "supersede via status transition, not a fresh row" spirit as the
   * rest of this codebase's history-tracking models.
   */
  async upsertBooking(data: Prisma.ClassBookingUncheckedCreateInput): Promise<ClassBookingRow> {
    const row = await this.db.classBooking.upsert({
      where: { classSessionId_memberId: { classSessionId: data.classSessionId, memberId: data.memberId } },
      create: data,
      update: {
        status: 'BOOKED',
        bookedByRole: data.bookedByRole,
        bookedByUserId: data.bookedByUserId,
        bookedAt: new Date(),
        cancelledAt: null,
      },
    });
    return (await this.findById(data.tenantId, row.id))!;
  }

  async cancel(id: string): Promise<void> {
    await this.db.classBooking.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
  }

  async listByMember(tenantId: string, memberId: string, opts?: { upcomingOnly?: boolean }): Promise<ClassBookingRow[]> {
    return this.db.classBooking.findMany({
      where: {
        tenantId,
        memberId,
        status: 'BOOKED',
        ...(opts?.upcomingOnly ? { classSession: { sessionDate: { gte: new Date(new Date().toISOString().slice(0, 10)) } } } : {}),
      },
      include: SESSION_INCLUDE,
      orderBy: { classSession: { sessionDate: 'asc' } },
    });
  }
}
