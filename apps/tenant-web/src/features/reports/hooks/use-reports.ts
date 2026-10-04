'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthServiceError } from '@/features/auth/types';
import { reportsService } from '../services/reports.service';
import type { CreateScheduledReportPayload, Paginated, ReportFilters, ReportsOverviewParams } from '../types';

export function toReportError(error: unknown): AuthServiceError {
  if (error instanceof AuthServiceError) return error;
  return new AuthServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

// Dashboard data is frequently accessed (every portal session lands here)
// but changes on a human timescale, not a per-second one — a 1-minute
// staleTime (Prompt 23: Global Loading & Performance Optimization) avoids
// a refetch on every dashboard revisit within that window while still
// staying reasonably fresh. Existing mutation-driven `invalidateQueries`
// calls elsewhere still force an immediate refetch after any real change.
const DASHBOARD_STALE_TIME_MS = 60_000;

export function useDashboardSummary(branchId?: string) {
  return useQuery({
    queryKey: ['reports', 'dashboard', 'summary', branchId ?? null],
    queryFn: () => reportsService.getDashboardSummary(branchId),
    staleTime: DASHBOARD_STALE_TIME_MS,
  });
}

export function useKpis(branchId?: string) {
  return useQuery({
    queryKey: ['reports', 'dashboard', 'kpis', branchId ?? null],
    queryFn: () => reportsService.getKpis(branchId),
    staleTime: DASHBOARD_STALE_TIME_MS,
  });
}

export function useRecentActivities(branchId?: string) {
  return useQuery({
    queryKey: ['reports', 'dashboard', 'recent-activities', branchId ?? null],
    queryFn: () => reportsService.getRecentActivities(branchId),
    staleTime: DASHBOARD_STALE_TIME_MS,
  });
}

export function useReportData<T>(reportType: string, filters: ReportFilters) {
  return useQuery({
    queryKey: ['reports', 'report', reportType, filters],
    queryFn: () => reportsService.getReport<T>(reportType, filters),
  });
}

/** Redesigned overview dashboard data; `enabled` lets pages wait for a valid custom range. */
export function useReportsOverview(params: ReportsOverviewParams, enabled = true) {
  return useQuery({
    queryKey: ['reports', 'overview', params],
    queryFn: () => reportsService.getOverview(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** KPI/breakdown/series summary for one tabular report type (same filters as the list, no paging). */
export function useReportSummary(type: string, params: ReportFilters, enabled = true) {
  return useQuery({
    queryKey: ['reports', 'summary', type, params],
    queryFn: () => reportsService.getReportSummary(type, params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function isPaginated<T>(data: Paginated<T> | T[] | undefined): data is Paginated<T> {
  return !!data && !Array.isArray(data);
}

export function useRevenueTrends(dateFrom?: string, dateTo?: string, branchId?: string) {
  return useQuery({ queryKey: ['reports', 'analytics', 'revenue-trends', dateFrom, dateTo, branchId], queryFn: () => reportsService.revenueTrends(dateFrom, dateTo, branchId) });
}

export function useAttendanceTrends(dateFrom?: string, dateTo?: string, branchId?: string) {
  return useQuery({ queryKey: ['reports', 'analytics', 'attendance-trends', dateFrom, dateTo, branchId], queryFn: () => reportsService.attendanceTrends(dateFrom, dateTo, branchId) });
}

export function useMembershipGrowth(dateFrom?: string, dateTo?: string, branchId?: string) {
  return useQuery({ queryKey: ['reports', 'analytics', 'membership-growth', dateFrom, dateTo, branchId], queryFn: () => reportsService.membershipGrowth(dateFrom, dateTo, branchId) });
}

export function useNewMemberGrowth(dateFrom?: string, dateTo?: string, branchId?: string) {
  return useQuery({ queryKey: ['reports', 'analytics', 'new-member-growth', dateFrom, dateTo, branchId], queryFn: () => reportsService.newMemberGrowth(dateFrom, dateTo, branchId) });
}

export function useRetention(dateFrom?: string, dateTo?: string, branchId?: string) {
  return useQuery({ queryKey: ['reports', 'analytics', 'retention', dateFrom, dateTo, branchId], queryFn: () => reportsService.retention(dateFrom, dateTo, branchId) });
}

export function usePaymentCollection(dateFrom?: string, dateTo?: string, branchId?: string) {
  return useQuery({ queryKey: ['reports', 'analytics', 'payment-collection', dateFrom, dateTo, branchId], queryFn: () => reportsService.paymentCollection(dateFrom, dateTo, branchId) });
}

export function useBranchComparison(branchId?: string, dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['reports', 'analytics', 'branch-comparison', branchId ?? null, dateFrom ?? null, dateTo ?? null],
    queryFn: () => reportsService.branchComparison(branchId, dateFrom, dateTo),
    placeholderData: keepPreviousData,
  });
}

// ── Scheduled reports ──────────────────────────────────────────────────

function useInvalidateScheduledReports() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['reports', 'scheduled'] });
}

export function useScheduledReports() {
  return useQuery({ queryKey: ['reports', 'scheduled', 'list'], queryFn: () => reportsService.listScheduledReports() });
}

export function useCreateScheduledReport() {
  const invalidate = useInvalidateScheduledReports();
  return useMutation({ mutationFn: (payload: CreateScheduledReportPayload) => reportsService.createScheduledReport(payload), onSuccess: invalidate });
}

export function useDeleteScheduledReport() {
  const invalidate = useInvalidateScheduledReports();
  return useMutation({ mutationFn: (id: string) => reportsService.deleteScheduledReport(id), onSuccess: invalidate });
}

export function useToggleScheduledReport() {
  const invalidate = useInvalidateScheduledReports();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => reportsService.updateScheduledReport(id, { isActive }),
    onSuccess: invalidate,
  });
}

export function useRunScheduledReportNow() {
  const invalidate = useInvalidateScheduledReports();
  return useMutation({ mutationFn: (id: string) => reportsService.runScheduledReportNow(id), onSuccess: invalidate });
}
