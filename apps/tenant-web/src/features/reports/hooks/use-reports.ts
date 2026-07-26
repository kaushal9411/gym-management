'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthServiceError } from '@/features/auth/types';
import { reportsService } from '../services/reports.service';
import type { CreateScheduledReportPayload, Paginated, ReportFilters } from '../types';

export function toReportError(error: unknown): AuthServiceError {
  if (error instanceof AuthServiceError) return error;
  return new AuthServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

export function useDashboardSummary(branchId?: string) {
  return useQuery({ queryKey: ['reports', 'dashboard', 'summary', branchId ?? null], queryFn: () => reportsService.getDashboardSummary(branchId) });
}

export function useKpis(branchId?: string) {
  return useQuery({ queryKey: ['reports', 'dashboard', 'kpis', branchId ?? null], queryFn: () => reportsService.getKpis(branchId) });
}

export function useRecentActivities(branchId?: string) {
  return useQuery({ queryKey: ['reports', 'dashboard', 'recent-activities', branchId ?? null], queryFn: () => reportsService.getRecentActivities(branchId) });
}

export function useReportData<T>(reportType: string, filters: ReportFilters) {
  return useQuery({
    queryKey: ['reports', 'report', reportType, filters],
    queryFn: () => reportsService.getReport<T>(reportType, filters),
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

export function useBranchComparison(branchId?: string) {
  return useQuery({ queryKey: ['reports', 'analytics', 'branch-comparison', branchId ?? null], queryFn: () => reportsService.branchComparison(branchId) });
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
