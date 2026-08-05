'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthServiceError } from '@/features/auth/types';
import { classService } from '../services/class.service';
import type { CreateGroupClassPayload, ListGroupClassesParams, ListSessionsParams, ScheduleSlot, UpdateGroupClassPayload } from '../types';

export function toClassError(error: unknown): AuthServiceError {
  if (error instanceof AuthServiceError) return error;
  return new AuthServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

function useInvalidateClasses() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['classes'] });
}

function useInvalidateSessions() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['class-sessions'] });
}

// ── Group classes ────────────────────────────────────────────────────────

export function useClassList(params: ListGroupClassesParams) {
  return useQuery({ queryKey: ['classes', 'list', params], queryFn: () => classService.listClasses(params) });
}

export function useActiveClasses() {
  return useQuery({ queryKey: ['classes', 'active'], queryFn: () => classService.listActiveClasses() });
}

export function useGroupClass(id: string | null) {
  return useQuery({ queryKey: ['classes', 'detail', id], queryFn: () => classService.getClassById(id!), enabled: id !== null });
}

export function useCreateClass() {
  const invalidate = useInvalidateClasses();
  return useMutation({ mutationFn: (payload: CreateGroupClassPayload) => classService.createClass(payload), onSuccess: invalidate });
}

export function useUpdateClass() {
  const invalidate = useInvalidateClasses();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateGroupClassPayload }) => classService.updateClass(id, payload),
    onSuccess: invalidate,
  });
}

export function useSetClassSchedule() {
  const invalidateClasses = useInvalidateClasses();
  const invalidateSessions = useInvalidateSessions();
  return useMutation({
    mutationFn: ({ id, slots }: { id: string; slots: ScheduleSlot[] }) => classService.setSchedule(id, slots),
    onSuccess: () => {
      invalidateClasses();
      invalidateSessions();
    },
  });
}

export function useClassStatusAction() {
  const invalidate = useInvalidateClasses();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'delete' | 'restore' }) => {
      if (action === 'delete') return classService.deleteClass(id);
      await classService.restoreClass(id);
      return undefined;
    },
    onSuccess: invalidate,
  });
}

// ── Sessions ────────────────────────────────────────────────────────────

export function useSessionList(params: ListSessionsParams) {
  return useQuery({ queryKey: ['class-sessions', 'list', params], queryFn: () => classService.listSessions(params) });
}

export function useClassSession(id: string | null) {
  return useQuery({ queryKey: ['class-sessions', 'detail', id], queryFn: () => classService.getSessionById(id!), enabled: id !== null });
}

export function useGenerateSessions() {
  const invalidate = useInvalidateSessions();
  return useMutation({ mutationFn: (daysAhead?: number) => classService.generateSessions(daysAhead), onSuccess: invalidate });
}

// ── Bookings ────────────────────────────────────────────────────────────

export function useBookMember() {
  const invalidate = useInvalidateSessions();
  return useMutation({
    mutationFn: ({ sessionId, memberId }: { sessionId: string; memberId: string }) => classService.bookMember(sessionId, memberId),
    onSuccess: invalidate,
  });
}

export function useCancelBooking() {
  const invalidate = useInvalidateSessions();
  return useMutation({ mutationFn: (bookingId: string) => classService.cancelBooking(bookingId), onSuccess: invalidate });
}
