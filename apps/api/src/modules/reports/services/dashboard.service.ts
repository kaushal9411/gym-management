import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { STAFF_ROLE_NAMES } from '../../staff/dto/staff.dto';
import type { DashboardSummaryDto, KpiMetricsDto, RecentActivityDto } from '../dto/reports.dto';
import { resolveBranchScope } from '../utils/branch-scope.util';
import { addDaysStr, todayStr } from '../utils/date-range.util';

export class DashboardService {
  private readonly db: TenantScopedPrisma;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
  }

  async getKpis(userId: string, requestedBranchId?: string): Promise<KpiMetricsDto> {
    const branchId = await resolveBranchScope(this.tenantId, userId, requestedBranchId);

    const todayIso = todayStr();
    const today = new Date(`${todayIso}T00:00:00.000Z`);
    const todayEnd = new Date(`${todayIso}T23:59:59.999Z`);
    const monthStart = new Date(`${todayIso.slice(0, 7)}-01T00:00:00.000Z`);
    const expiringWindowEnd = new Date(`${addDaysStr(todayIso, 30)}T23:59:59.999Z`);

    const [
      totalMembers,
      activeMembers,
      inactiveMembers,
      newMembersThisMonth,
      expiringMemberships,
      todaysAttendance,
      monthlyRevenue,
      monthlyExpenses,
      outstandingInvoices,
      totalStaff,
      activeTrainers,
      activeBranches,
    ] = await Promise.all([
      this.db.member.count({ where: { tenantId: this.tenantId, deletedAt: null, branchId } }),
      this.db.member.count({ where: { tenantId: this.tenantId, deletedAt: null, branchId, status: 'ACTIVE' } }),
      this.db.member.count({ where: { tenantId: this.tenantId, deletedAt: null, branchId, status: 'INACTIVE' } }),
      this.db.member.count({ where: { tenantId: this.tenantId, deletedAt: null, branchId, createdAt: { gte: monthStart } } }),
      this.db.membership.count({
        where: { tenantId: this.tenantId, status: 'ACTIVE', endDate: { gte: today, lte: expiringWindowEnd }, member: { branchId } },
      }),
      this.db.attendance.count({ where: { tenantId: this.tenantId, deletedAt: null, branchId, attendanceDate: today } }),
      this.db.income.aggregate({ where: { tenantId: this.tenantId, deletedAt: null, branchId, incomeDate: { gte: monthStart, lte: todayEnd } }, _sum: { amount: true } }),
      this.db.expense.aggregate({ where: { tenantId: this.tenantId, deletedAt: null, branchId, expenseDate: { gte: monthStart, lte: todayEnd } }, _sum: { amount: true } }),
      this.db.memberInvoice.aggregate({
        where: { tenantId: this.tenantId, branchId, status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } },
        _sum: { totalAmount: true },
      }),
      this.db.user.count({ where: { tenantId: this.tenantId, deletedAt: null, userRoles: { some: { role: { name: { in: [...STAFF_ROLE_NAMES] } } } } } }),
      this.db.user.count({
        where: { tenantId: this.tenantId, deletedAt: null, status: 'ACTIVE', userRoles: { some: { role: { name: 'TRAINER' } } } },
      }),
      this.db.branch.count({ where: { tenantId: this.tenantId, isActive: true } }),
    ]);

    return {
      totalMembers,
      activeMembers,
      inactiveMembers,
      newMembersThisMonth,
      expiringMemberships,
      todaysAttendance,
      monthlyRevenue: (Number(monthlyRevenue._sum.amount) || 0).toFixed(2),
      monthlyExpenses: (Number(monthlyExpenses._sum.amount) || 0).toFixed(2),
      outstandingPayments: (Number(outstandingInvoices._sum.totalAmount) || 0).toFixed(2),
      totalStaff,
      activeTrainers,
      activeBranches,
    };
  }

  async getRecentActivities(userId: string, requestedBranchId?: string, limit = 10): Promise<RecentActivityDto[]> {
    const branchId = await resolveBranchScope(this.tenantId, userId, requestedBranchId);

    const [payments, checkIns, newMembers] = await Promise.all([
      this.db.memberPayment.findMany({
        where: { tenantId: this.tenantId, branchId },
        include: { member: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.db.attendance.findMany({
        where: { tenantId: this.tenantId, deletedAt: null, branchId },
        include: { member: { select: { firstName: true, lastName: true } } },
        orderBy: { checkInTime: 'desc' },
        take: limit,
      }),
      this.db.member.findMany({
        where: { tenantId: this.tenantId, deletedAt: null, branchId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    const activities: RecentActivityDto[] = [
      ...payments.map((p) => ({
        type: 'PAYMENT' as const,
        id: p.id,
        label: `${p.member.firstName} ${p.member.lastName}`.trim(),
        detail: `${p.status === 'SUCCESS' ? 'Paid' : p.status} $${p.finalAmount.toString()} (${p.paymentNumber})`,
        occurredAt: p.createdAt.toISOString(),
      })),
      ...checkIns.map((a) => ({
        type: 'CHECK_IN' as const,
        id: a.id,
        label: `${a.member.firstName} ${a.member.lastName}`.trim(),
        detail: `Checked in via ${a.method}`,
        occurredAt: a.checkInTime.toISOString(),
      })),
      ...newMembers.map((m) => ({
        type: 'NEW_MEMBER' as const,
        id: m.id,
        label: `${m.firstName} ${m.lastName}`.trim(),
        detail: 'Joined as a new member',
        occurredAt: m.createdAt.toISOString(),
      })),
    ];

    return activities.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, limit);
  }

  async getSummary(userId: string, branchId?: string): Promise<DashboardSummaryDto> {
    const [kpis, recentActivities] = await Promise.all([this.getKpis(userId, branchId), this.getRecentActivities(userId, branchId, 10)]);
    return { kpis, recentActivities };
  }
}
