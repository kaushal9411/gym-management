import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { EmployeeRefDto } from '../dto/hr.dto';

export const EMPLOYEE_INCLUDE = {
  staffProfile: { include: { hrShift: true } },
  userRoles: { include: { role: { select: { name: true, priority: true } } } },
  userBranches: { select: { branchId: true, branch: { select: { id: true, name: true } } } },
} satisfies Prisma.UserInclude;

export type EmployeeRow = Prisma.UserGetPayload<{ include: typeof EMPLOYEE_INCLUDE }> & {
  staffProfile: NonNullable<Prisma.UserGetPayload<{ include: { staffProfile: true } }>['staffProfile']>;
};

export interface EmployeeFilter {
  search?: string;
  status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | 'PENDING_VERIFICATION' | 'LOCKED';
  branchId?: string;
  userIds?: string[];
  /** Branch-restricted actors only see employees sharing one of these branches. */
  restrictToBranchIds?: string[];
}

function where(tenantId: string, f: EmployeeFilter = {}): Prisma.UserWhereInput {
  const w: Prisma.UserWhereInput = {
    tenantId,
    deletedAt: null,
    staffProfile: { is: { workStatus: { not: 'TERMINATED' } } },
  };
  if (f.status) w.status = f.status;
  const and: Prisma.UserWhereInput[] = [];
  if (f.branchId) and.push({ userBranches: { some: { branchId: f.branchId } } });
  if (f.restrictToBranchIds) and.push({ userBranches: { some: { branchId: { in: f.restrictToBranchIds } } } });
  if (f.userIds) w.id = { in: f.userIds };
  if (f.search) {
    const contains = { contains: f.search, mode: 'insensitive' as const };
    and.push({ OR: [{ name: contains }, { email: contains }, { staffProfile: { is: { employeeId: contains } } }] });
  }
  if (and.length) w.AND = and;
  return w;
}

const ROLE_ORDER = ['OWNER', 'MANAGER', 'TRAINER', 'RECEPTIONIST'];

/** The role shown for an employee: highest-priority known staff role. */
export function primaryRole(e: { userRoles: Array<{ role: { name: string; priority: number } }> }): string {
  const roles = [...e.userRoles].sort((a, b) => b.role.priority - a.role.priority).map((x) => x.role.name);
  return roles.find((x) => ROLE_ORDER.includes(x)) ?? roles[0] ?? 'STAFF';
}

/** Employees = non-deleted users that own a StaffProfile (not TERMINATED). */
export class HrEmployeeRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(tenantId: string, f: EmployeeFilter, skip?: number, take?: number): Promise<{ items: EmployeeRow[]; total: number }> {
    const w = where(tenantId, f);
    const [items, total] = await Promise.all([
      this.db.user.findMany({ where: w, include: EMPLOYEE_INCLUDE, orderBy: [{ staffProfile: { employeeId: 'asc' } }], skip, take }),
      this.db.user.count({ where: w }),
    ]);
    return { items: items as EmployeeRow[], total };
  }

  async findOne(tenantId: string, userId: string, restrictToBranchIds?: string[]): Promise<EmployeeRow | null> {
    const row = await this.db.user.findFirst({ where: where(tenantId, { userIds: [userId], restrictToBranchIds }), include: EMPLOYEE_INCLUDE });
    return row as EmployeeRow | null;
  }

  async findMany(tenantId: string, userIds: string[], restrictToBranchIds?: string[]): Promise<EmployeeRow[]> {
    if (userIds.length === 0) return [];
    return (await this.db.user.findMany({ where: where(tenantId, { userIds, restrictToBranchIds }), include: EMPLOYEE_INCLUDE })) as EmployeeRow[];
  }

  /** EmployeeRef lookup that also covers terminated/deleted staff (history rows must keep their names). */
  async refsFor(tenantId: string, userIds: string[]): Promise<Map<string, EmployeeRefDto>> {
    const ids = [...new Set(userIds)];
    if (ids.length === 0) return new Map();
    const rows = await this.db.user.findMany({
      where: { tenantId, id: { in: ids } },
      select: { id: true, name: true, avatarUrl: true, staffProfile: { select: { employeeId: true } }, userRoles: { select: { role: { select: { name: true, priority: true } } } } },
    });
    return new Map(rows.map((u) => [u.id, { userId: u.id, employeeId: u.staffProfile?.employeeId ?? '', name: u.name, avatarUrl: u.avatarUrl, role: primaryRole(u) }]));
  }

  /** Name lookup for actor columns (decided_by, marked_by, ...) — includes non-employees (the owner). */
  async namesFor(tenantId: string, userIds: Array<string | null | undefined>): Promise<Map<string, string>> {
    const ids = [...new Set(userIds.filter((v): v is string => Boolean(v)))];
    if (ids.length === 0) return new Map();
    const rows = await this.db.user.findMany({ where: { tenantId, id: { in: ids } }, select: { id: true, name: true } });
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  /** Users holding `permissionKey` (via role OR a user GRANT, minus user DENY) — the approver set for leave notifications. */
  async userIdsWithPermission(tenantId: string, permissionKey: string): Promise<string[]> {
    const viaRole = await this.db.user.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        userRoles: { some: { role: { rolePermissions: { some: { permission: { key: permissionKey } } } } } },
      },
      select: { id: true },
    });
    const viaGrant = await this.db.user.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE', userPermissions: { some: { mode: 'GRANT', permission: { key: permissionKey } } } },
      select: { id: true },
    });
    const denied = await this.db.userPermission.findMany({
      where: { tenantId, mode: 'DENY', permission: { key: permissionKey } },
      select: { userId: true },
    });
    const deniedSet = new Set(denied.map((d) => d.userId));
    return [...new Set([...viaRole, ...viaGrant].map((u) => u.id))].filter((id) => !deniedSet.has(id));
  }

  async setShift(userId: string, shiftId: string | null, shiftName: string | null): Promise<void> {
    await this.db.staffProfile.update({ where: { userId }, data: { shiftId, shift: shiftName } });
  }

  async setWeeklyOff(userId: string, weeklyOff: string | null): Promise<void> {
    await this.db.staffProfile.update({ where: { userId }, data: { weeklyOff } });
  }

  async setSalary(userId: string, salaryAmount: number): Promise<void> {
    await this.db.staffProfile.update({ where: { userId }, data: { salaryAmount } });
  }

  async countByShift(tenantId: string): Promise<Map<string, number>> {
    const rows = await this.db.staffProfile.groupBy({ by: ['shiftId'], where: { tenantId, shiftId: { not: null } }, _count: { _all: true } });
    return new Map(rows.map((r) => [r.shiftId as string, r._count._all]));
  }

  // ── pay components ─────────────────────────────────────────────────────
  async listComponents(tenantId: string, userIds: string[]) {
    return this.db.hrPayComponent.findMany({ where: { tenantId, userId: { in: userIds } }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  }

  async replaceComponents(tenantId: string, userId: string, components: Array<{ name: string; type: 'ALLOWANCE' | 'DEDUCTION'; amount: number; isActive: boolean }>): Promise<void> {
    await this.db.hrPayComponent.deleteMany({ where: { tenantId, userId } });
    if (components.length === 0) return;
    await this.db.hrPayComponent.createMany({
      data: components.map((c, i) => ({ tenantId, userId, name: c.name, type: c.type, amount: c.amount, isActive: c.isActive, sortOrder: i })),
    });
  }
}
