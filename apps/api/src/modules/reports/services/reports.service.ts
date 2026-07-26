import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { STAFF_ROLE_NAMES } from '../../staff/dto/staff.dto';
import type {
  ActiveVsInactiveRow,
  AttendanceReportRow,
  BranchPerformanceRow,
  ExpenseReportRow,
  ExpiringMembershipRow,
  MemberProgressRow,
  MembershipReportRow,
  Paginated,
  PaymentReportRow,
  ReportFilters,
  RevenueReportRow,
  StaffReportRow,
  TrainerPerformanceRow,
} from '../dto/reports.dto';
import { resolveBranchScope } from '../utils/branch-scope.util';
import { addDaysStr, todayStr } from '../utils/date-range.util';

function paginate<T>(items: T[], total: number, page: number, limit: number): Paginated<T> {
  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export class ReportsService {
  private readonly db: TenantScopedPrisma;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
  }

  private async branchScope(userId: string, requestedBranchId?: string) {
    return resolveBranchScope(this.tenantId, userId, requestedBranchId);
  }

  async membershipReport(userId: string, filters: ReportFilters): Promise<Paginated<MembershipReportRow>> {
    const branchId = await this.branchScope(userId, filters.branchId);
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const where = {
      tenantId: this.tenantId,
      deletedAt: null,
      branchId,
      ...(filters.memberStatus ? { status: filters.memberStatus as never } : {}),
    };

    const [members, total] = await Promise.all([
      this.db.member.findMany({
        where,
        include: {
          branch: { select: { name: true } },
          memberships: {
            where: filters.planId ? { planId: filters.planId } : undefined,
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { plan: { select: { name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.member.count({ where }),
    ]);

    const items = members.map((m) => {
      const membership = m.memberships[0];
      return {
        memberId: m.id,
        memberCode: m.memberId,
        name: `${m.firstName} ${m.lastName}`.trim(),
        branch: m.branch.name,
        plan: membership?.plan.name ?? null,
        status: m.status,
        startDate: membership?.startDate.toISOString().slice(0, 10) ?? null,
        endDate: membership?.endDate.toISOString().slice(0, 10) ?? null,
      };
    });
    return paginate(items, total, page, limit);
  }

  async attendanceReport(userId: string, filters: ReportFilters): Promise<Paginated<AttendanceReportRow>> {
    const branchId = await this.branchScope(userId, filters.branchId);
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const { from, to } = { from: filters.dateFrom, to: filters.dateTo };

    const where = {
      tenantId: this.tenantId,
      deletedAt: null,
      branchId,
      ...(from || to
        ? { attendanceDate: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.db.attendance.findMany({
        where,
        include: { member: { select: { memberId: true, firstName: true, lastName: true } }, branch: { select: { name: true } } },
        orderBy: { checkInTime: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.attendance.count({ where }),
    ]);

    const items = rows.map((a) => ({
      date: a.attendanceDate.toISOString().slice(0, 10),
      memberCode: a.member.memberId,
      name: `${a.member.firstName} ${a.member.lastName}`.trim(),
      branch: a.branch.name,
      checkInTime: a.checkInTime.toISOString(),
      checkOutTime: a.checkOutTime?.toISOString() ?? null,
      method: a.method,
    }));
    return paginate(items, total, page, limit);
  }

  async revenueReport(userId: string, filters: ReportFilters): Promise<Paginated<RevenueReportRow> & { total: number; totalAmount: string }> {
    const branchId = await this.branchScope(userId, filters.branchId);
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const { dateFrom: from, dateTo: to } = filters;

    const where = {
      tenantId: this.tenantId,
      branchId,
      status: 'SUCCESS' as const,
      ...(from || to ? { paymentDate: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
    };

    const [rows, total, sum] = await Promise.all([
      this.db.memberPayment.findMany({
        where,
        include: { branch: { select: { name: true } } },
        orderBy: { paymentDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.memberPayment.count({ where }),
      this.db.memberPayment.aggregate({ where, _sum: { finalAmount: true } }),
    ]);

    const items = rows.map((p) => ({
      date: p.paymentDate.toISOString().slice(0, 10),
      branch: p.branch.name,
      method: p.method,
      amount: p.finalAmount.toString(),
    }));
    return { ...paginate(items, total, page, limit), totalAmount: (Number(sum._sum.finalAmount) || 0).toFixed(2) };
  }

  async expenseReport(userId: string, filters: ReportFilters): Promise<Paginated<ExpenseReportRow> & { totalAmount: string }> {
    const branchId = await this.branchScope(userId, filters.branchId);
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const { dateFrom: from, dateTo: to } = filters;

    const where = {
      tenantId: this.tenantId,
      deletedAt: null,
      branchId,
      ...(from || to ? { expenseDate: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
    };

    const [rows, total, sum] = await Promise.all([
      this.db.expense.findMany({
        where,
        include: { branch: { select: { name: true } } },
        orderBy: { expenseDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.expense.count({ where }),
      this.db.expense.aggregate({ where, _sum: { amount: true } }),
    ]);

    const items = rows.map((e) => ({
      date: e.expenseDate.toISOString().slice(0, 10),
      branch: e.branch?.name ?? '—',
      category: e.category,
      amount: e.amount.toString(),
      description: e.description,
    }));
    return { ...paginate(items, total, page, limit), totalAmount: (Number(sum._sum.amount) || 0).toFixed(2) };
  }

  async paymentReport(userId: string, filters: ReportFilters): Promise<Paginated<PaymentReportRow>> {
    const branchId = await this.branchScope(userId, filters.branchId);
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const { dateFrom: from, dateTo: to } = filters;

    const where = {
      tenantId: this.tenantId,
      branchId,
      ...(filters.paymentStatus ? { status: filters.paymentStatus as never } : {}),
      ...(from || to ? { paymentDate: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.db.memberPayment.findMany({
        where,
        include: { member: { select: { memberId: true, firstName: true, lastName: true } }, branch: { select: { name: true } } },
        orderBy: { paymentDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.memberPayment.count({ where }),
    ]);

    const items = rows.map((p) => ({
      paymentNumber: p.paymentNumber,
      memberCode: p.member.memberId,
      name: `${p.member.firstName} ${p.member.lastName}`.trim(),
      branch: p.branch.name,
      finalAmount: p.finalAmount.toString(),
      method: p.method,
      status: p.status,
      paymentDate: p.paymentDate.toISOString().slice(0, 10),
    }));
    return paginate(items, total, page, limit);
  }

  async staffReport(userId: string, filters: ReportFilters): Promise<Paginated<StaffReportRow>> {
    const branchId = await this.branchScope(userId, filters.branchId);
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const where = {
      tenantId: this.tenantId,
      deletedAt: null,
      userRoles: { some: { role: { name: { in: [...STAFF_ROLE_NAMES] } } } },
      ...(branchId ? { userBranches: { some: { branchId } } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.db.user.findMany({
        where,
        include: {
          userRoles: { include: { role: { select: { name: true } } } },
          userBranches: { where: { isPrimary: true }, include: { branch: { select: { name: true } } }, take: 1 },
          staffProfile: { select: { joiningDate: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.user.count({ where }),
    ]);

    const items = rows.map((u) => ({
      name: u.name,
      role: u.userRoles.map((r) => r.role.name).find((n) => (STAFF_ROLE_NAMES as readonly string[]).includes(n)) ?? '—',
      branch: u.userBranches[0]?.branch.name ?? null,
      status: u.status,
      joiningDate: u.staffProfile?.joiningDate?.toISOString().slice(0, 10) ?? null,
    }));
    return paginate(items, total, page, limit);
  }

  async trainerPerformanceReport(userId: string, filters: ReportFilters): Promise<TrainerPerformanceRow[]> {
    const branchId = await this.branchScope(userId, filters.branchId);

    const trainers = await this.db.user.findMany({
      where: {
        tenantId: this.tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        userRoles: { some: { role: { name: 'TRAINER' } } },
        ...(filters.trainerId ? { id: filters.trainerId } : {}),
      },
      select: { id: true, name: true },
    });

    const rows = await Promise.all(
      trainers.map(async (t) => {
        const [assignedMembers, activeWorkoutPlans, activeDietPlans] = await Promise.all([
          this.db.member.count({ where: { tenantId: this.tenantId, deletedAt: null, trainerId: t.id, branchId } }),
          this.db.workoutPlan.count({ where: { tenantId: this.tenantId, deletedAt: null, trainerId: t.id, isActive: true } }),
          this.db.dietPlan.count({ where: { tenantId: this.tenantId, deletedAt: null, trainerId: t.id, isActive: true } }),
        ]);
        return { trainerId: t.id, name: t.name, assignedMembers, activeWorkoutPlans, activeDietPlans };
      }),
    );
    return rows;
  }

  async memberProgressReport(userId: string, filters: ReportFilters): Promise<Paginated<MemberProgressRow>> {
    const branchId = await this.branchScope(userId, filters.branchId);
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const where = { tenantId: this.tenantId, deletedAt: null, branchId };
    const [members, total] = await Promise.all([
      this.db.member.findMany({
        where,
        include: {
          workoutPlans: { where: { status: 'ACTIVE' }, take: 1, include: { workoutPlan: { select: { name: true } }, progress: true } },
          dietPlans: { where: { status: 'ACTIVE' }, take: 1, include: { dietPlan: { select: { name: true } }, dailyLogs: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.member.count({ where }),
    ]);

    const items = members.map((m) => {
      const wp = m.workoutPlans[0];
      const dp = m.dietPlans[0];
      const wpCompleted = wp ? wp.progress.filter((p) => p.status === 'COMPLETED').length : 0;
      const wpTotal = wp ? wp.progress.length : 0;
      return {
        memberCode: m.memberId,
        name: `${m.firstName} ${m.lastName}`.trim(),
        workoutPlan: wp?.workoutPlan.name ?? null,
        workoutProgressPercent: wp ? (wpTotal === 0 ? 0 : Math.round((wpCompleted / wpTotal) * 100)) : null,
        dietPlan: dp?.dietPlan.name ?? null,
        dietProgressPercent: dp ? Math.round((dp.dailyLogs.length > 0 ? 1 : 0) * 100) : null,
      };
    });
    return paginate(items, total, page, limit);
  }

  async branchPerformanceReport(userId: string, filters: ReportFilters): Promise<BranchPerformanceRow[]> {
    const branchScope = await this.branchScope(userId, filters.branchId);
    const branches = await this.db.branch.findMany({
      where: { tenantId: this.tenantId, isActive: true, ...(branchScope ? { id: branchScope } : {}) },
    });

    const todayIso = todayStr();
    const monthStart = new Date(`${todayIso.slice(0, 7)}-01T00:00:00.000Z`);
    const todayEnd = new Date(`${todayIso}T23:59:59.999Z`);

    return Promise.all(
      branches.map(async (b) => {
        const [totalMembers, activeMembers, revenue, attendance, staffCount] = await Promise.all([
          this.db.member.count({ where: { tenantId: this.tenantId, deletedAt: null, branchId: b.id } }),
          this.db.member.count({ where: { tenantId: this.tenantId, deletedAt: null, branchId: b.id, status: 'ACTIVE' } }),
          this.db.income.aggregate({
            where: { tenantId: this.tenantId, deletedAt: null, branchId: b.id, incomeDate: { gte: monthStart, lte: todayEnd } },
            _sum: { amount: true },
          }),
          this.db.attendance.count({
            where: { tenantId: this.tenantId, deletedAt: null, branchId: b.id, attendanceDate: { gte: monthStart, lte: todayEnd } },
          }),
          this.db.user.count({ where: { tenantId: this.tenantId, deletedAt: null, userBranches: { some: { branchId: b.id } } } }),
        ]);
        return {
          branchId: b.id,
          branch: b.name,
          totalMembers,
          activeMembers,
          monthlyRevenue: (Number(revenue._sum.amount) || 0).toFixed(2),
          monthlyAttendance: attendance,
          staffCount,
        };
      }),
    );
  }

  async expiringMembershipReport(userId: string, filters: ReportFilters & { withinDays?: number }): Promise<Paginated<ExpiringMembershipRow>> {
    const branchId = await this.branchScope(userId, filters.branchId);
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const withinDays = filters.withinDays ?? 30;

    const todayIso = todayStr();
    const today = new Date(`${todayIso}T00:00:00.000Z`);
    const windowEnd = new Date(`${addDaysStr(todayIso, withinDays)}T23:59:59.999Z`);

    const where = {
      tenantId: this.tenantId,
      status: 'ACTIVE' as const,
      endDate: { gte: today, lte: windowEnd },
      member: { deletedAt: null, branchId },
    };

    const [rows, total] = await Promise.all([
      this.db.membership.findMany({
        where,
        include: { member: { select: { memberId: true, firstName: true, lastName: true, branch: { select: { name: true } } } }, plan: { select: { name: true } } },
        orderBy: { endDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.membership.count({ where }),
    ]);

    const items = rows.map((m) => ({
      memberCode: m.member.memberId,
      name: `${m.member.firstName} ${m.member.lastName}`.trim(),
      branch: m.member.branch.name,
      plan: m.plan.name,
      endDate: m.endDate.toISOString().slice(0, 10),
      daysRemaining: Math.ceil((m.endDate.getTime() - today.getTime()) / 86_400_000),
    }));
    return paginate(items, total, page, limit);
  }

  async activeVsInactiveReport(userId: string, filters: ReportFilters): Promise<ActiveVsInactiveRow[]> {
    const branchId = await this.branchScope(userId, filters.branchId);
    const rows = await this.db.member.groupBy({
      by: ['status'],
      where: { tenantId: this.tenantId, deletedAt: null, branchId },
      _count: { _all: true },
    });
    return rows.map((r) => ({ status: r.status, count: r._count._all }));
  }
}
