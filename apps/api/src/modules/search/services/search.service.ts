import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { BranchRepository } from '../../branches/repositories/branch.repository';
import { MemberRepository } from '../../members/repositories/member.repository';
import { permissionEngine } from '../../permissions/services/permission-engine.service';
import { StaffRepository } from '../../staff/repositories/staff.repository';
import type { GlobalSearchResultDto, GlobalSearchResultItem } from '../dto/search.dto';

const RESULTS_PER_CATEGORY = 5;
const EMPTY: GlobalSearchResultDto = { members: [], staff: [], branches: [] };

/**
 * Cross-module lookup for the header search bar — deliberately scoped to
 * the three "look someone/somewhere up by name" entities (Members, Staff,
 * Branches), not every searchable list in the app (Payments, Workout Plans,
 * etc. already have their own in-page search). Each category re-uses that
 * module's OWN repository `list()` method (same `search` param its full
 * list page already uses) rather than duplicating query logic — so a
 * Member/Staff/Branch found here always matches what that module's own
 * search would find.
 *
 * Permission-filtered per category rather than gated by a single
 * `requirePermission` on the route: `requirePermission` only expresses "has
 * this ONE key," and a search bar spanning three independently-permissioned
 * entity types needs "include each category only if the caller can view
 * it" — so the route stays authenticated-only and this service checks
 * `members:view`/`staff:view`/`branches:view` itself via one
 * `getEffectivePermissions` call (cached).
 */
export class GlobalSearchService {
  private readonly db: TenantScopedPrisma;
  private readonly members: MemberRepository;
  private readonly staff: StaffRepository;
  private readonly branches: BranchRepository;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.members = new MemberRepository(this.db);
    this.staff = new StaffRepository(this.db);
    this.branches = new BranchRepository(this.db);
  }

  async search(rawQuery: string, userId: string): Promise<GlobalSearchResultDto> {
    const query = rawQuery.trim();
    if (query.length < 2) return EMPTY;

    const permissions = await permissionEngine.getEffectivePermissions(this.tenantId, userId);

    const [members, staff, branches] = await Promise.all([
      permissions.includes('members:view') ? this.searchMembers(query) : Promise.resolve([]),
      permissions.includes('staff:view') ? this.searchStaff(query) : Promise.resolve([]),
      permissions.includes('branches:view') ? this.searchBranches(query) : Promise.resolve([]),
    ]);

    return { members, staff, branches };
  }

  private async searchMembers(query: string): Promise<GlobalSearchResultItem[]> {
    const { items } = await this.members.list(this.tenantId, {
      page: 1,
      limit: RESULTS_PER_CATEGORY,
      search: query,
      sortBy: 'name',
      sortDir: 'asc',
    });
    return items.map((m) => ({
      id: m.id,
      title: `${m.firstName} ${m.lastName}`.trim(),
      subtitle: m.memberId,
      url: `/members/${m.id}`,
    }));
  }

  private async searchStaff(query: string): Promise<GlobalSearchResultItem[]> {
    const { items } = await this.staff.list(this.tenantId, {
      page: 1,
      limit: RESULTS_PER_CATEGORY,
      search: query,
      sortBy: 'name',
      sortDir: 'asc',
    });
    return items.map((s) => ({
      id: s.id,
      title: s.name,
      subtitle: s.staffProfile?.employeeId ?? '',
      url: `/staff/${s.id}`,
    }));
  }

  private async searchBranches(query: string): Promise<GlobalSearchResultItem[]> {
    const { items } = await this.branches.list(this.tenantId, {
      page: 1,
      limit: RESULTS_PER_CATEGORY,
      search: query,
      includeDeleted: false,
      sortBy: 'name',
      sortDir: 'asc',
    });
    return items.map((b) => ({
      id: b.id,
      title: b.name,
      subtitle: b.branchCode,
      url: `/branches/${b.id}`,
    }));
  }
}
