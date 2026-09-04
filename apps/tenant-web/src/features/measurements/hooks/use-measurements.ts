'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthServiceError } from '@/features/auth/types';
import { measurementService } from '../services/measurement.service';
import type { CreateBodyMeasurementPayload, UpdateBodyMeasurementPayload } from '../types';

export function toMeasurementError(error: unknown): AuthServiceError {
  if (error instanceof AuthServiceError) return error;
  return new AuthServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

function useInvalidateMeasurements(memberId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['measurements', memberId] });
    // The list page's "who has measurements + latest reading + count" view
    // changes on every create/update/delete for any member, not just this one.
    void queryClient.invalidateQueries({ queryKey: ['measurements', 'members'] });
  };
}

/** Only members with at least one entry — backs the Body Measurements list page. */
export function useMeasuredMembers() {
  return useQuery({ queryKey: ['measurements', 'members'], queryFn: () => measurementService.listMembers() });
}

export function useMemberMeasurements(memberId: string | null) {
  return useQuery({
    queryKey: ['measurements', memberId],
    queryFn: () => measurementService.listForMember(memberId!),
    enabled: memberId !== null,
  });
}

export function useCreateMeasurement(memberId: string) {
  const invalidate = useInvalidateMeasurements(memberId);
  return useMutation({
    mutationFn: (payload: CreateBodyMeasurementPayload) => measurementService.create(memberId, payload),
    onSuccess: invalidate,
  });
}

export function useUpdateMeasurement(memberId: string) {
  const invalidate = useInvalidateMeasurements(memberId);
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateBodyMeasurementPayload }) => measurementService.update(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteMeasurement(memberId: string) {
  const invalidate = useInvalidateMeasurements(memberId);
  return useMutation({
    mutationFn: (id: string) => measurementService.remove(id),
    onSuccess: invalidate,
  });
}
