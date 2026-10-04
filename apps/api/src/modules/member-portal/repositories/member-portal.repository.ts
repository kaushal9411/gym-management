import { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { DayCount } from '../utils/member-overview.util';

/** Settled money definition shared with invoice detail / analytics (see finance/utils/invoice-analytics.util.ts). */
const SETTLED_SQL = Prisma.sql`p.status::text IN ('SUCCESS', 'PARTIALLY_REFUNDED')`;

const MEMBERSHIP_PICK_STATUSES = ['ACTIVE', 'PENDING', 'EXPIRED'] as const;

/**
 * Read-only aggregates behind `GET /portal/overview` and friends. EVERY query takes the authenticated member's id
 * and puts it in the WHERE — nothing here accepts a caller-supplied owner id.
 */
export class MemberPortalRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  /** Raw SQL must set the RLS tenant variable itself — the scoped client only wraps model operations. */
  private async rawScoped<T>(tenantId: string, query: Prisma.Sql): Promise<T[]> {
    const [, rows] = await this.db.$transaction([
      this.db.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
      this.db.$queryRaw<T[]>(query),
    ]);
    return rows as T[];
  }

  findMember(tenantId: string, memberId: string) {
    return this.db.member.findFirst({
      where: { tenantId, id: memberId, deletedAt: null },
      select: {
        id: true,
        memberId: true,
        firstName: true,
        lastName: true,
        profilePhotoUrl: true,
        joiningDate: true,
        branch: { select: { id: true, name: true } },
        trainer: { select: { id: true, name: true } },
      },
    });
  }

  /** ACTIVE first, else the soonest PENDING, else the most recently ended EXPIRED one. */
  async findCurrentMembership(tenantId: string, memberId: string) {
    const rows = await this.db.membership.findMany({
      where: { tenantId, memberId, status: { in: [...MEMBERSHIP_PICK_STATUSES] } },
      include: {
        plan: {
          select: { name: true, price: true, discountPercentage: true, taxPercentage: true },
        },
      },
      orderBy: { endDate: 'desc' },
      take: 10,
    });
    const active = rows.find((r) => r.status === 'ACTIVE');
    if (active) return active;
    const pending = rows
      .filter((r) => r.status === 'PENDING')
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0];
    return pending ?? rows[0] ?? null;
  }

  /** Settled payments linked to the membership directly OR through an invoice raised for it (a row is counted once). */
  async membershipAmountPaid(
    tenantId: string,
    memberId: string,
    membershipId: string,
  ): Promise<number> {
    const rows = await this.rawScoped<{ paid: Prisma.Decimal }>(
      tenantId,
      Prisma.sql`SELECT COALESCE(SUM(p.final_amount), 0) AS paid FROM member_payments p
        WHERE p.tenant_id = ${tenantId}::uuid AND p.member_id = ${memberId}::uuid AND ${SETTLED_SQL}
          AND (p.membership_id = ${membershipId}::uuid
            OR p.invoice_id IN (SELECT i.id FROM member_invoices i WHERE i.tenant_id = ${tenantId}::uuid AND i.member_id = ${memberId}::uuid AND i.membership_id = ${membershipId}::uuid))`,
    );
    return Number(rows[0]?.paid ?? 0);
  }

  /** One row per distinct visit day (all time) — bounded by days-since-joining, not by visit count. */
  async visitDays(tenantId: string, memberId: string): Promise<DayCount[]> {
    const rows = await this.rawScoped<{ d: string; c: bigint }>(
      tenantId,
      Prisma.sql`SELECT to_char(a.attendance_date, 'YYYY-MM-DD') AS d, COUNT(*) AS c FROM attendance_records a
        WHERE a.tenant_id = ${tenantId}::uuid AND a.member_id = ${memberId}::uuid AND a.deleted_at IS NULL
        GROUP BY a.attendance_date ORDER BY a.attendance_date`,
    );
    return rows.map((r) => ({ date: r.d, visits: Number(r.c) }));
  }

  /** Last check-in (all time) + average completed-visit length in minutes since `sinceDate` (1 min..12 h sanity band). */
  async visitStats(tenantId: string, memberId: string, sinceDate: string) {
    const rows = await this.rawScoped<{
      last_visit: Date | null;
      avg_minutes: Prisma.Decimal | null;
    }>(
      tenantId,
      Prisma.sql`SELECT MAX(a.check_in_time) AS last_visit,
          AVG(EXTRACT(EPOCH FROM (a.check_out_time - a.check_in_time)) / 60.0)
            FILTER (WHERE a.check_out_time IS NOT NULL AND a.attendance_date >= ${sinceDate}::date
              AND a.check_out_time - a.check_in_time BETWEEN interval '1 minute' AND interval '12 hours') AS avg_minutes
        FROM attendance_records a
        WHERE a.tenant_id = ${tenantId}::uuid AND a.member_id = ${memberId}::uuid AND a.deleted_at IS NULL`,
    );
    const r = rows[0];
    return {
      lastVisitAt: r?.last_visit ?? null,
      avgMinutes: r?.avg_minutes != null ? Number(r.avg_minutes) : null,
    };
  }

  /** Open invoices (UNPAID/PARTIALLY_PAID/OVERDUE) with a positive balance = total - settled payments, plus the earliest due date. */
  async outstandingInvoices(tenantId: string, memberId: string) {
    const rows = await this.rawScoped<{
      value: Prisma.Decimal;
      cnt: bigint;
      next_due: string | null;
    }>(
      tenantId,
      Prisma.sql`SELECT COALESCE(SUM(x.bal), 0) AS value, COUNT(*) AS cnt, to_char(MIN(x.due_date), 'YYYY-MM-DD') AS next_due FROM (
          SELECT i.due_date,
            GREATEST(i.total_amount - COALESCE((SELECT SUM(p.final_amount) FROM member_payments p WHERE p.tenant_id = i.tenant_id AND p.invoice_id = i.id AND ${SETTLED_SQL}), 0), 0) AS bal
          FROM member_invoices i
          WHERE i.tenant_id = ${tenantId}::uuid AND i.member_id = ${memberId}::uuid AND i.status::text IN ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE')
        ) x WHERE x.bal > 0`,
    );
    const r = rows[0];
    return {
      value: Number(r?.value ?? 0),
      count: Number(r?.cnt ?? 0),
      nextDueDate: r?.next_due ?? null,
    };
  }

  async paidSince(tenantId: string, memberId: string, sinceDate: string) {
    const rows = await this.rawScoped<{ value: Prisma.Decimal; cnt: bigint }>(
      tenantId,
      Prisma.sql`SELECT COALESCE(SUM(p.final_amount), 0) AS value, COUNT(*) AS cnt FROM member_payments p
        WHERE p.tenant_id = ${tenantId}::uuid AND p.member_id = ${memberId}::uuid AND ${SETTLED_SQL} AND p.payment_date >= ${sinceDate}::date`,
    );
    return { value: Number(rows[0]?.value ?? 0), count: Number(rows[0]?.cnt ?? 0) };
  }

  upcomingBookings(tenantId: string, memberId: string, today: string, take: number) {
    return this.db.classBooking.findMany({
      where: {
        tenantId,
        memberId,
        status: 'BOOKED',
        classSession: {
          status: 'SCHEDULED',
          sessionDate: { gte: new Date(`${today}T00:00:00.000Z`) },
        },
      },
      include: {
        classSession: {
          include: { groupClass: { select: { name: true } }, trainer: { select: { name: true } } },
        },
      },
      orderBy: [{ classSession: { sessionDate: 'asc' } }, { classSession: { startTime: 'asc' } }],
      take,
    });
  }

  latestBodyWeight(tenantId: string, memberId: string) {
    return this.db.bodyMeasurement.findFirst({
      where: { tenantId, memberId, weightKg: { not: null } },
      orderBy: [{ recordedAt: 'desc' }, { createdAt: 'desc' }],
      select: { weightKg: true, recordedAt: true },
    });
  }

  unreadNotifications(tenantId: string, memberId: string): Promise<number> {
    return this.db.memberNotification.count({ where: { tenantId, memberId, readAt: null } });
  }

  async listPayments(tenantId: string, memberId: string, page: number, limit: number) {
    const where = { tenantId, memberId };
    const [items, total] = await Promise.all([
      this.db.memberPayment.findMany({
        where,
        include: { invoice: { select: { id: true, invoiceNumber: true } } },
        orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.memberPayment.count({ where }),
    ]);
    // One grouped query for the whole page (not per row).
    const refunds = items.length
      ? await this.db.memberPaymentRefund.groupBy({
          by: ['paymentId'],
          where: { tenantId, paymentId: { in: items.map((p) => p.id) } },
          _sum: { amount: true },
        })
      : [];
    return {
      items,
      total,
      refunded: new Map(refunds.map((r) => [r.paymentId, Number(r._sum.amount ?? 0)])),
    };
  }

  findProfile(tenantId: string) {
    return this.db.tenantProfile.findUnique({
      where: { tenantId },
      select: {
        phone: true,
        email: true,
        website: true,
        addressLine: true,
        city: true,
        state: true,
        country: true,
        postalCode: true,
        businessHours: true,
        socialLinks: true,
      },
    });
  }

  findBranch(tenantId: string, branchId: string) {
    return this.db.branch.findFirst({
      where: { tenantId, id: branchId, deletedAt: null },
      select: {
        name: true,
        phone: true,
        email: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        country: true,
        postalCode: true,
        operatingHours: true,
      },
    });
  }
}
