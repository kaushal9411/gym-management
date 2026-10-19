import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

const PICK_STATUSES = ['ACTIVE', 'PENDING', 'EXPIRED'] as const;

/**
 * Read-only queries behind `GET /portal/plan`. Every query takes the AUTHENTICATED member's id (or ids derived
 * from that member's own membership) in its WHERE — nothing accepts a caller-supplied owner id.
 *
 * Usage counting mirrors `MemberService#buildPlanUsage` (staff side) — kept here, not imported, so the
 * member-portal module does not reach into members' private service.
 */
export class MemberPlanRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  /** The member's candidate memberships with the full plan feature set; the caller picks the current one. */
  listCandidateMemberships(tenantId: string, memberId: string) {
    return this.db.membership.findMany({
      where: { tenantId, memberId, status: { in: [...PICK_STATUSES] } },
      include: {
        plan: {
          select: {
            name: true,
            planCode: true,
            category: true,
            description: true,
            durationValue: true,
            durationType: true,
            gymAccessAllBranches: true,
            accessBranchIds: true,
            ptSessionsIncluded: true,
            groupClassesIncluded: true,
            dietConsultationIncluded: true,
            lockerAccess: true,
            guestPasses: true,
            freezeAllowed: true,
            freezeDaysLimit: true,
          },
        },
      },
      orderBy: { endDate: 'desc' },
      take: 10,
    });
  }

  memberTimezone(
    tenantId: string,
    memberId: string,
  ): Promise<{ branch: { timezone: string | null } } | null> {
    return this.db.member.findFirst({
      where: { tenantId, id: memberId, deletedAt: null },
      select: { branch: { select: { timezone: true } } },
    });
  }

  async branchNames(tenantId: string, ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.branch.findMany({
      where: { tenantId, id: { in: ids }, deletedAt: null },
      select: { name: true },
    });
    return rows.map((r) => r.name);
  }

  guestVisits(tenantId: string, membershipId: string): Promise<number> {
    return this.db.guestVisit.count({ where: { tenantId, membershipId } });
  }

  ptSessions(tenantId: string, membershipId: string): Promise<number> {
    return this.db.ptSessionLog.count({ where: { tenantId, membershipId } });
  }

  /** Non-cancelled bookings for sessions inside the membership period (same query `ClassBookingService#book` enforces). */
  groupClasses(
    tenantId: string,
    memberId: string,
    period: { startDate: Date; endDate: Date },
  ): Promise<number> {
    return this.db.classBooking.count({
      where: {
        tenantId,
        memberId,
        status: { not: 'CANCELLED' },
        classSession: { sessionDate: { gte: period.startDate, lte: period.endDate } },
      },
    });
  }

  /** Closed freezes only, each rounded up to at least 1 day (same as `MembershipRepository#sumFreezeDays`). */
  async freezeDays(tenantId: string, membershipId: string): Promise<number> {
    const freezes = await this.db.membershipFreeze.findMany({
      where: { tenantId, membershipId, unfrozenAt: { not: null } },
      select: { frozenAt: true, unfrozenAt: true },
    });
    return freezes.reduce(
      (total, f) =>
        total + Math.max(1, Math.ceil((f.unfrozenAt!.getTime() - f.frozenAt.getTime()) / 86_400_000)),
      0,
    );
  }
}
