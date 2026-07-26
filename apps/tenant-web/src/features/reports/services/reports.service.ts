import { apiClient } from '@/features/auth/services/api-client';
import type {
  BranchComparisonRow,
  CreateScheduledReportPayload,
  DashboardSummary,
  KpiMetrics,
  Paginated,
  RecentActivity,
  ReportFilters,
  RevenueTrendPoint,
  ScheduledReport,
  TrendPoint,
} from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class ReportsService {
  // ── Dashboard ──────────────────────────────────────────────────────────

  async getDashboardSummary(branchId?: string): Promise<DashboardSummary> {
    const res = await apiClient.get<ApiEnvelope<DashboardSummary>>('/reports/dashboard/summary', { params: { branchId } });
    return res.data.data;
  }

  async getKpis(branchId?: string): Promise<KpiMetrics> {
    const res = await apiClient.get<ApiEnvelope<KpiMetrics>>('/reports/dashboard/kpis', { params: { branchId } });
    return res.data.data;
  }

  async getRecentActivities(branchId?: string): Promise<RecentActivity[]> {
    const res = await apiClient.get<ApiEnvelope<RecentActivity[]>>('/reports/dashboard/recent-activities', { params: { branchId } });
    return res.data.data;
  }

  // ── Reports (tabular) ──────────────────────────────────────────────────

  async getReport<T>(reportType: string, filters: ReportFilters): Promise<Paginated<T> | T[]> {
    const res = await apiClient.get<ApiEnvelope<Paginated<T> | T[]>>(`/reports/${reportType}`, { params: filters });
    return res.data.data;
  }

  /** Returns a blob URL — caller revokes after triggering the download. */
  async exportUrl(reportType: string, format: 'csv' | 'xlsx' | 'pdf', filters: ReportFilters): Promise<string> {
    const res = await apiClient.get(`/reports/${reportType}/export`, { params: { ...filters, format }, responseType: 'blob' });
    return URL.createObjectURL(res.data as Blob);
  }

  // ── Analytics ──────────────────────────────────────────────────────────

  async revenueTrends(dateFrom?: string, dateTo?: string, branchId?: string): Promise<RevenueTrendPoint[]> {
    const res = await apiClient.get<ApiEnvelope<RevenueTrendPoint[]>>('/analytics/revenue-trends', { params: { dateFrom, dateTo, branchId } });
    return res.data.data;
  }

  async attendanceTrends(dateFrom?: string, dateTo?: string, branchId?: string): Promise<TrendPoint[]> {
    const res = await apiClient.get<ApiEnvelope<TrendPoint[]>>('/analytics/attendance-trends', { params: { dateFrom, dateTo, branchId } });
    return res.data.data;
  }

  async membershipGrowth(dateFrom?: string, dateTo?: string, branchId?: string): Promise<TrendPoint[]> {
    const res = await apiClient.get<ApiEnvelope<TrendPoint[]>>('/analytics/membership-growth', { params: { dateFrom, dateTo, branchId } });
    return res.data.data;
  }

  async newMemberGrowth(dateFrom?: string, dateTo?: string, branchId?: string): Promise<TrendPoint[]> {
    const res = await apiClient.get<ApiEnvelope<TrendPoint[]>>('/analytics/new-member-growth', { params: { dateFrom, dateTo, branchId } });
    return res.data.data;
  }

  async retention(dateFrom?: string, dateTo?: string, branchId?: string): Promise<TrendPoint[]> {
    const res = await apiClient.get<ApiEnvelope<TrendPoint[]>>('/analytics/retention', { params: { dateFrom, dateTo, branchId } });
    return res.data.data;
  }

  async paymentCollection(dateFrom?: string, dateTo?: string, branchId?: string): Promise<RevenueTrendPoint[]> {
    const res = await apiClient.get<ApiEnvelope<RevenueTrendPoint[]>>('/analytics/payment-collection', { params: { dateFrom, dateTo, branchId } });
    return res.data.data;
  }

  async branchComparison(branchId?: string): Promise<BranchComparisonRow[]> {
    const res = await apiClient.get<ApiEnvelope<BranchComparisonRow[]>>('/analytics/branch-comparison', { params: { branchId } });
    return res.data.data;
  }

  // ── Scheduled reports ────────────────────────────────────────────────

  async listScheduledReports(): Promise<ScheduledReport[]> {
    const res = await apiClient.get<ApiEnvelope<ScheduledReport[]>>('/reports/scheduled');
    return res.data.data;
  }

  async createScheduledReport(payload: CreateScheduledReportPayload): Promise<ScheduledReport> {
    const res = await apiClient.post<ApiEnvelope<ScheduledReport>>('/reports/scheduled', payload);
    return res.data.data;
  }

  async updateScheduledReport(id: string, payload: Partial<CreateScheduledReportPayload>): Promise<ScheduledReport> {
    const res = await apiClient.patch<ApiEnvelope<ScheduledReport>>(`/reports/scheduled/${id}`, payload);
    return res.data.data;
  }

  async deleteScheduledReport(id: string): Promise<void> {
    await apiClient.delete(`/reports/scheduled/${id}`);
  }

  async runScheduledReportNow(id: string): Promise<void> {
    await apiClient.post(`/reports/scheduled/${id}/run-now`);
  }
}

export const reportsService = new ReportsService();
