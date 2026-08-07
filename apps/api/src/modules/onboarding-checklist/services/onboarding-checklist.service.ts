import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { STAFF_ROLE_NAMES } from '../../staff/dto/staff.dto';
import type { OnboardingChecklistStatusDto } from '../dto/onboarding-checklist.dto';

/**
 * Dashboard "get your gym set up" widget (audit remediation, Low-priority)
 * — every item is auto-detected from real data (nothing here is a manual
 * checkbox), and deliberately excludes anything already true immediately
 * after signup (a default Branch + the Owner's own User already exist from
 * provisioning — "add a branch"/"create an account" would be trivially
 * complete for every tenant on day one, so they're not on this list).
 */
export class OnboardingChecklistService {
  private readonly db: TenantScopedPrisma;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
  }

  async getStatus(): Promise<OnboardingChecklistStatusDto> {
    const [branding, profile, staffCount, planCount, memberCount, settings] = await Promise.all([
      this.db.tenantBranding.findUnique({ where: { tenantId: this.tenantId }, select: { logoUrl: true } }),
      this.db.tenantProfile.findUnique({ where: { tenantId: this.tenantId }, select: { addressLine: true } }),
      this.db.user.count({
        where: { tenantId: this.tenantId, deletedAt: null, userRoles: { some: { role: { name: { in: [...STAFF_ROLE_NAMES] } } } } },
      }),
      this.db.membershipPlan.count({ where: { tenantId: this.tenantId, deletedAt: null } }),
      this.db.member.count({ where: { tenantId: this.tenantId, deletedAt: null } }),
      this.db.tenantSettings.findUnique({ where: { tenantId: this.tenantId }, select: { onboardingChecklistDismissed: true } }),
    ]);

    const items = [
      { key: 'branding', label: 'Customize your gym branding', completed: !!branding?.logoUrl, actionUrl: '/gym-settings/branding' },
      { key: 'profile', label: 'Complete your gym profile', completed: !!profile?.addressLine, actionUrl: '/gym-settings/profile' },
      { key: 'staff', label: 'Invite your staff', completed: staffCount > 0, actionUrl: '/staff/new' },
      { key: 'membershipPlan', label: 'Create a membership plan', completed: planCount > 0, actionUrl: '/memberships/new' },
      { key: 'member', label: 'Add your first member', completed: memberCount > 0, actionUrl: '/members/new' },
    ];

    return {
      items,
      completedCount: items.filter((i) => i.completed).length,
      totalCount: items.length,
      dismissed: settings?.onboardingChecklistDismissed ?? false,
    };
  }

  /** No `tenantService.invalidateCache` needed — this flag isn't part of the cached `ResolvedTenant` (see the schema doc comment). */
  async dismiss(): Promise<void> {
    await this.db.tenantSettings.update({ where: { tenantId: this.tenantId }, data: { onboardingChecklistDismissed: true } });
  }
}
