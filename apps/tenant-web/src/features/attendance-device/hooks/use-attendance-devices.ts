'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthServiceError } from '@/features/auth/types';
import { attendanceDeviceService } from '../services/attendance-device.service';
import type { CreateAttendanceDeviceInput, ListAttendanceDevicesParams, UpdateAttendanceDeviceInput } from '../types';

export function toAttendanceDeviceError(error: unknown): AuthServiceError {
  if (error instanceof AuthServiceError) return error;
  return new AuthServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

export function useAttendanceDevices(params: ListAttendanceDevicesParams = {}) {
  return useQuery({ queryKey: ['attendance-devices', 'list', params], queryFn: () => attendanceDeviceService.list(params) });
}

function useInvalidateAttendanceDevices() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['attendance-devices'] });
}

export function useCreateAttendanceDevice() {
  const invalidate = useInvalidateAttendanceDevices();
  return useMutation({
    mutationFn: (input: CreateAttendanceDeviceInput) => attendanceDeviceService.create(input),
    onSuccess: () => void invalidate(),
  });
}

export function useUpdateAttendanceDevice() {
  const invalidate = useInvalidateAttendanceDevices();
  return useMutation({
    mutationFn: ({ deviceId, input }: { deviceId: string; input: UpdateAttendanceDeviceInput }) => attendanceDeviceService.update(deviceId, input),
    onSuccess: () => void invalidate(),
  });
}

export function useRegenerateAttendanceDeviceKey() {
  const invalidate = useInvalidateAttendanceDevices();
  return useMutation({
    mutationFn: (deviceId: string) => attendanceDeviceService.regenerateKey(deviceId),
    onSuccess: () => void invalidate(),
  });
}

export function useDeleteAttendanceDevice() {
  const invalidate = useInvalidateAttendanceDevices();
  return useMutation({
    mutationFn: (deviceId: string) => attendanceDeviceService.remove(deviceId),
    onSuccess: () => void invalidate(),
  });
}
