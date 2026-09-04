import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

const WITH_RECORDER = { recordedByUser: { select: { id: true, name: true } } } as const;

export class MeasurementRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(tenantId: string, memberId: string) {
    return this.db.bodyMeasurement.findMany({
      where: { tenantId, memberId },
      // `recordedAt` is user-editable and only ever carries date precision
      // (the form sends `YYYY-MM-DD` → midnight UTC) — same-day entries tie
      // there, so `createdAt` (full timestamp, server-stamped, never
      // user-edited) breaks the tie deterministically: whichever was
      // actually logged most recently sorts first.
      orderBy: [{ recordedAt: 'desc' }, { createdAt: 'desc' }],
      include: WITH_RECORDER,
    });
  }

  /**
   * One row per member who has at least one entry, each paired with their
   * most recent measurement and a total count. No `groupBy` here — Prisma's
   * `groupBy` only returns aggregated scalar fields, not the full row of
   * whichever measurement is newest, so this fetches every row (ordered
   * newest-first) and dedupes by `memberId` in application code, keeping the
   * first occurrence per member. Fine at this table's expected scale (a
   * gym's total measurement log, not a paginated-in-the-millions table);
   * revisit with a real `DISTINCT ON` raw query if that stops being true.
   */
  async listMembersWithLatest(tenantId: string) {
    const rows = await this.db.bodyMeasurement.findMany({
      where: { tenantId },
      orderBy: [{ recordedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        ...WITH_RECORDER,
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            memberId: true,
            profilePhotoUrl: true,
            branch: { select: { id: true, name: true } },
            trainer: { select: { id: true, name: true } },
          },
        },
      },
    });

    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.memberId, (counts.get(row.memberId) ?? 0) + 1);

    const seen = new Set<string>();
    const latestByMember: Array<{ row: (typeof rows)[number]; count: number }> = [];
    for (const row of rows) {
      if (seen.has(row.memberId)) continue;
      seen.add(row.memberId);
      latestByMember.push({ row, count: counts.get(row.memberId)! });
    }
    return latestByMember;
  }

  async findById(tenantId: string, id: string) {
    return this.db.bodyMeasurement.findFirst({ where: { tenantId, id }, include: WITH_RECORDER });
  }

  async create(data: Prisma.BodyMeasurementUncheckedCreateInput) {
    return this.db.bodyMeasurement.create({ data, include: WITH_RECORDER });
  }

  async update(id: string, data: Prisma.BodyMeasurementUncheckedUpdateInput) {
    return this.db.bodyMeasurement.update({ where: { id }, data, include: WITH_RECORDER });
  }

  async delete(id: string): Promise<void> {
    await this.db.bodyMeasurement.delete({ where: { id } });
  }
}

export type MeasurementRow = NonNullable<Awaited<ReturnType<MeasurementRepository['findById']>>>;
