import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

import { ValidationError } from '../../../core/errors/app-error';
import type { ReportFilters, ReportType } from '../dto/reports.dto';

import { AnalyticsService } from './analytics.service';
import { ReportsService } from './reports.service';

/**
 * `rows` deliberately stays `unknown[]` — the report/analytics DTOs are
 * concrete interfaces without an index signature (by design, for type
 * safety everywhere else they're used), so building a generic export table
 * out of any of them needs a cast at the call site rather than widening
 * every DTO. `asRecord` narrows just at the point of use.
 */
interface ExportTable {
  title: string;
  columns: string[];
  rows: unknown[];
}

function asRecord(row: unknown): Record<string, unknown> {
  return row as Record<string, unknown>;
}

function escapeCsv(value: unknown): string {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(table: ExportTable): string {
  const lines = [table.columns.join(',')];
  for (const row of table.rows) {
    lines.push(table.columns.map((c) => escapeCsv(asRecord(row)[c])).join(','));
  }
  return lines.join('\n');
}

async function toExcel(table: ExportTable): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(table.title.slice(0, 31));
  sheet.columns = table.columns.map((c) => ({ header: c, key: c, width: Math.max(14, c.length + 2) }));
  sheet.getRow(1).font = { bold: true };
  for (const row of table.rows) sheet.addRow(asRecord(row));
  return workbook.xlsx.writeBuffer();
}

function toPdf(table: ExportTable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: table.columns.length > 5 ? 'landscape' : 'portrait' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text(table.title);
    doc.moveDown();

    const colWidth = (doc.page.width - 80) / table.columns.length;
    let y = doc.y;
    doc.fontSize(8).font('Helvetica-Bold');
    table.columns.forEach((c, i) => doc.text(c, 40 + i * colWidth, y, { width: colWidth }));
    y += 16;
    doc.moveTo(40, y).lineTo(doc.page.width - 40, y).stroke();
    y += 4;
    doc.font('Helvetica');

    for (const row of table.rows) {
      if (y > doc.page.height - 60) {
        doc.addPage();
        y = 40;
      }
      table.columns.forEach((c, i) => doc.text(String(asRecord(row)[c] ?? ''), 40 + i * colWidth, y, { width: colWidth }));
      y += 14;
    }
    doc.end();
  });
}

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
    return { filename: `${reportType}-${new Date().toISOString().slice(0, 10)}.csv`, content: toCsv(table) };
  }

  async exportExcel(reportType: ReportType, userId: string, filters: ReportFilters): Promise<{ filename: string; content: ExcelJS.Buffer }> {
    const table = await this.buildTable(reportType, userId, filters);
    return { filename: `${reportType}-${new Date().toISOString().slice(0, 10)}.xlsx`, content: await toExcel(table) };
  }

  async exportPdf(reportType: ReportType, userId: string, filters: ReportFilters): Promise<{ filename: string; content: Buffer }> {
    const table = await this.buildTable(reportType, userId, filters);
    return { filename: `${reportType}-${new Date().toISOString().slice(0, 10)}.pdf`, content: await toPdf(table) };
  }
}
