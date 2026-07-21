'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthServiceError } from '@/features/auth/types';
import { attendanceService } from '../services/attendance.service';
import type { CheckInPayload, CheckOutPayload, ListAttendanceParams, UpdateAttendancePayload } from '../types';

export function toAttendanceError(error: unknown): AuthServiceError {
  if (error instanceof AuthServiceError) return error;
  return new AuthServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

function useInvalidateAttendance() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['attendance'] });
}

export function useAttendanceList(params: ListAttendanceParams) {
  return useQuery({ queryKey: ['attendance', 'list', params], queryFn: () => attendanceService.list(params) });
}

export function useTodayAttendance(branchId?: string) {
  return useQuery({ queryKey: ['attendance', 'today', branchId ?? null], queryFn: () => attendanceService.getToday(branchId) });
}

export function useAttendanceSummary(params: { branchId?: string; dateFrom?: string; dateTo?: string }) {
  return useQuery({ queryKey: ['attendance', 'summary', params], queryFn: () => attendanceService.getSummary(params) });
}

export function useMemberAttendance(memberId: string | null, page: number, limit: number) {
  return useQuery({
    queryKey: ['attendance', 'member', memberId, page, limit],
    queryFn: () => attendanceService.getMemberAttendance(memberId!, page, limit),
    enabled: memberId !== null,
  });
}

export function useBranchAttendance(branchId: string | null, params: Omit<ListAttendanceParams, 'branchId'>) {
  return useQuery({
    queryKey: ['attendance', 'branch', branchId, params],
    queryFn: () => attendanceService.getBranchAttendance(branchId!, params),
    enabled: branchId !== null,
  });
}

export function useCheckIn() {
  const invalidate = useInvalidateAttendance();
  return useMutation({ mutationFn: (payload: CheckInPayload) => attendanceService.checkIn(payload), onSuccess: invalidate });
}

export function useCheckOut() {
  const invalidate = useInvalidateAttendance();
  return useMutation({ mutationFn: (payload: CheckOutPayload) => attendanceService.checkOut(payload), onSuccess: invalidate });
}

export function useManualCheckIn() {
  const invalidate = useInvalidateAttendance();
  return useMutation({ mutationFn: (payload: CheckInPayload) => attendanceService.manualCheckIn(payload), onSuccess: invalidate });
}

export function useManualCheckOut() {
  const invalidate = useInvalidateAttendance();
  return useMutation({ mutationFn: (payload: CheckOutPayload) => attendanceService.manualCheckOut(payload), onSuccess: invalidate });
}

export function useValidateQrCode() {
  return useMutation({ mutationFn: (qrCodeToken: string) => attendanceService.validateQrCode(qrCodeToken) });
}

export function useUpdateAttendance() {
  const invalidate = useInvalidateAttendance();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateAttendancePayload }) => attendanceService.update(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteAttendance() {
  const invalidate = useInvalidateAttendance();
  return useMutation({ mutationFn: (id: string) => attendanceService.softDelete(id), onSuccess: invalidate });
}
