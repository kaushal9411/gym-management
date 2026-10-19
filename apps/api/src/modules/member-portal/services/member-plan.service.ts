import { NotFoundError } from '../../../core/errors/app-error';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { dateInTimezone } from '../../attendance/utils/timezone.util';
import type { MemberPlanDto } from '../dto/member-portal.dto';
import { MemberPlanRepository } from '../repositories/member-plan.repository';
import { membershipCountdown } from '../utils/member-overview.util';
import {
  buildPlanBenefits,
  parseAccessBranchIds,
  pickCurrentMembership,
  planDurationLabel,
} from '../utils/member-plan-benefits.util';

const nonEmpty = (v: string | null | undefined): string | null => (v && v.trim() ? v.trim() : null);

/**
 * `GET /portal/plan` — the member's CURRENT plan and everything it includes. The member id comes only from the token
 * (`req.memberAuth.sub`); every query is filtered to it (the filter IS the authorization).
 */
export class MemberPlanService {
  private readonly repo: MemberPlanRepository;

  constructor(private readonly tenantId: string) {
    this.repo = new MemberPlanRepository(getTenantScopedClient(tenantId));
  }

  /** `null` when the member has never had a membership (nothing to show). */
  async getPlan(memberId: string, now: Date = new Date()): Promise<MemberPlanDto | null> {
    const t = this.tenantId;
    const [member, candidates] = await Promise.all([
      this.repo.memberTimezone(t, memberId),
      this.repo.listCandidateMemberships(t, memberId),
    ]);
    if (!member) throw new NotFoundError('Member not found.');
    const membership = pickCurrentMembership(candidates);
    if (!membership) return null;

    const plan = membership.plan;
    const today = dateInTimezone(member.branch.timezone || 'UTC', now);
    const endDate = membership.endDate.toISOString().slice(0, 10);
    const { daysLeft, expired } = membershipCountdown(endDate, today);

    const [guestPasses, ptSessions, groupClasses, freezeDays, branchNames] = await Promise.all([
      plan.guestPasses > 0 ? this.repo.guestVisits(t, membership.id) : Promise.resolve(0),
      plan.ptSessionsIncluded > 0 ? this.repo.ptSessions(t, membership.id) : Promise.resolve(0),
      plan.groupClassesIncluded > 0
        ? this.repo.groupClasses(t, memberId, membership)
        : Promise.resolve(0),
      plan.freezeAllowed && plan.freezeDaysLimit !== null
        ? this.repo.freezeDays(t, membership.id)
        : Promise.resolve(0),
      plan.gymAccessAllBranches
        ? Promise.resolve([])
        : this.repo.branchNames(t, parseAccessBranchIds(plan.accessBranchIds)),
    ]);

    return {
      name: plan.name,
      code: plan.planCode,
      category: nonEmpty(plan.category),
      description: nonEmpty(plan.description),
      durationLabel: planDurationLabel(plan.durationValue, plan.durationType),
      status: membership.status,
      startDate: membership.startDate.toISOString().slice(0, 10),
      endDate,
      daysLeft,
      expired,
      totalDays: membership.durationDays,
      benefits: buildPlanBenefits({
        plan,
        usage: { ptSessions, groupClasses, guestPasses, freezeDays },
        branchNames,
      }),
    };
  }
}
