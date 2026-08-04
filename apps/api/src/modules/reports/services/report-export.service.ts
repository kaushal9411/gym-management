import { ValidationError } from '../../../core/errors/app-error';
import type { ReportFilters, ReportType } from '../dto/reports.dto';

import { AnalyticsService } from './analytics.service';
import type { ExportTable } from './export-render';
import { renderCsv } from './export-render';
import { renderInWorker } from './export-worker-runner';
import { ReportsService } from './reports.service';

export class ReportExportService {
  private readonly reports: ReportsService;
  private readonly analytics: AnalyticsService;

  constructor(private readonly tenantId: string) {
    this.reports = new ReportsService(tenantId);
    this.analytics = new AnalyticsService(tenantId);
  }

  private async buildTable(reportType: ReportType, userId: string, filters: ReportFilters): Promise<ExportTable> {
    const bigLimit = { ...filters, page: 1, limit: 2000 };
    switch (reportType) {
      case 'membership': {
        const { items } = await this.reports.membershipReport(userId, bigLimit);
        return { title: 'Membership Report', columns: ['memberCode', 'name', 'branch', 'plan', 'status', 'startDate', 'endDate'], rows: items };
      }
      case 'attendance': {
        const { items } = await this.reports.attendanceReport(userId, bigLimit);
        return { title: 'Attendance Report', columns: ['date', 'memberCode', 'name', 'branch', 'checkInTime', 'checkOutTime', 'method'], rows: items };
      }
      case 'revenue': {
        const { items } = await this.reports.revenueReport(userId, bigLimit);
        return { title: 'Revenue Report', columns: ['date', 'branch', 'method', 'amount'], rows: items };
      }
      case 'expenses': {
        const { items } = await this.reports.expenseReport(userId, bigLimit);
        return { title: 'Expense Report', columns: ['date', 'branch', 'category', 'amount', 'description'], rows: items.map((r) => ({ ...r, description: r.description ?? '' })) };
      }
      case 'payments': {
        const { items } = await this.reports.paymentReport(userId, bigLimit);
        return { title: 'Payment Report', columns: ['paymentNumber', 'memberCode', 'name', 'branch', 'finalAmount', 'method', 'status', 'paymentDate'], rows: items };
      }
      case 'staff': {
        const { items } = await this.reports.staffReport(userId, bigLimit);
        return { title: 'Staff Report', columns: ['name', 'role', 'branch', 'status', 'joiningDate'], rows: items.map((r) => ({ ...r, branch: r.branch ?? '—', joiningDate: r.joiningDate ?? '—' })) };
      }
      case 'trainer-performance': {
        const rows = await this.reports.trainerPerformanceReport(userId, filters);
        return { title: 'Trainer Performance Report', columns: ['name', 'assignedMembers', 'activeWorkoutPlans', 'activeDietPlans'], rows };
      }
      case 'member-progress': {
        const { items } = await this.reports.memberProgressReport(userId, bigLimit);
        return {
          title: 'Member Progress Report',
          columns: ['memberCode', 'name', 'workoutPlan', 'workoutProgressPercent', 'dietPlan', 'dietProgressPercent'],
          rows: items.map((r) => ({
            ...r,
            workoutPlan: r.workoutPlan ?? '—',
            workoutProgressPercent: r.workoutProgressPercent ?? '—',
            dietPlan: r.dietPlan ?? '—',
            dietProgressPercent: r.dietProgressPercent ?? '—',
          })),
        };
      }
      case 'branch-performance': {
        const rows = await this.reports.branchPerformanceReport(userId, filters);
        return { title: 'Branch Performance Report', columns: ['branch', 'totalMembers', 'activeMembers', 'monthlyRevenue', 'monthlyAttendance', 'staffCount'], rows };
      }
      case 'expiring-memberships': {
        const { items } = await this.reports.expiringMembershipReport(userId, bigLimit);
        return { title: 'Expiring Membership Report', columns: ['memberCode', 'name', 'branch', 'plan', 'endDate', 'daysRemaining'], rows: items };
      }
      case 'active-vs-inactive': {
        const rows = await this.reports.activeVsInactiveReport(userId, filters);
        return { title: 'Active vs Inactive Members Report', columns: ['status', 'count'], rows };
      }
      case 'analytics-revenue-trends': {
        const rows = await this.analytics.revenueTrends(userId, filters.dateFrom, filters.dateTo, filters.branchId);
        return { title: 'Revenue Trends', columns: ['date', 'income', 'expenses'], rows };
      }
      case 'analytics-attendance-trends': {
        const rows = await this.analytics.attendanceTrends(userId, filters.dateFrom, filters.dateTo, filters.branchId);
        return { title: 'Attendance Trends', columns: ['date', 'value'], rows };
      }
      case 'analytics-membership-growth': {
        const rows = await this.analytics.membershipGrowth(userId, filters.dateFrom, filters.dateTo, filters.branchId);
        return { title: 'Membership Growth', columns: ['date', 'value'], rows };
      }
      case 'analytics-new-member-growth': {
        const rows = await this.analytics.newMemberGrowth(userId, filters.dateFrom, filters.dateTo, filters.branchId);
        return { title: 'New Member Growth', columns: ['date', 'value'], rows };
      }
      case 'analytics-retention': {
        const rows = await this.analytics.memberRetention(userId, filters.dateFrom, filters.dateTo, filters.branchId);
        return { title: 'Member Retention', columns: ['date', 'value'], rows };
      }
      case 'analytics-payment-collection': {
        const rows = await this.analytics.paymentCollection(userId, filters.dateFrom, filters.dateTo, filters.branchId);
        return { title: 'Payment Collection', columns: ['date', 'income', 'expenses'], rows };
      }
      case 'analytics-branch-comparison': {
        const rows = await this.analytics.branchComparison(userId, filters.branchId);
        return { title: 'Branch Comparison', columns: ['branch', 'members', 'revenue', 'attendance'], rows };
      }
      default:
        throw new ValidationError(`Unknown report type "${reportType}".`);
    }
  }

  async exportCsv(reportType: ReportType, userId: string, filters: ReportFilters): Promise<{ filename: string; content: string }> {
    const table = await this.buildTable(reportType, userId, filters);
    return { filename: `${reportType}-${new Date().toISOString().slice(0, 10)}.csv`, content: renderCsv(table) };
  }

  async exportExcel(reportType: ReportType, userId: string, filters: ReportFilters): Promise<{ filename: string; content: Buffer }> {
    const table = await this.buildTable(reportType, userId, filters);
    const content = await renderInWorker('excel', table);
    return { filename: `${reportType}-${new Date().toISOString().slice(0, 10)}.xlsx`, content };
  }

  async exportPdf(reportType: ReportType, userId: string, filters: ReportFilters): Promise<{ filename: string; content: Buffer }> {
    const table = await this.buildTable(reportType, userId, filters);
    const content = await renderInWorker('pdf', table);
    return { filename: `${reportType}-${new Date().toISOString().slice(0, 10)}.pdf`, content };
  }
}
