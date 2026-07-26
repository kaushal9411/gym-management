'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthServiceError } from '@/features/auth/types';
import { announcementService } from '../services/announcement.service';
import type { AnnouncementStatus, CreateAnnouncementInput, ScheduleAnnouncementInput, UpdateAnnouncementInput } from '../types';

export function toAnnouncementError(error: unknown): AuthServiceError {
  if (error instanceof AuthServiceError) return error;
  return new AuthServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

export function useAnnouncements(params: { status?: AnnouncementStatus; page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['tenant-announcements', params],
    queryFn: () => announcementService.list(params),
  });
}

function useInvalidateAnnouncements() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['tenant-announcements'] });
}

export function useCreateAnnouncement() {
  const invalidate = useInvalidateAnnouncements();
  return useMutation({
    mutationFn: (input: CreateAnnouncementInput) => announcementService.create(input),
    onSuccess: () => void invalidate(),
  });
}

export function useUpdateAnnouncement() {
  const invalidate = useInvalidateAnnouncements();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAnnouncementInput }) => announcementService.update(id, input),
    onSuccess: () => void invalidate(),
  });
}

export function useDeleteAnnouncement() {
  const invalidate = useInvalidateAnnouncements();
  return useMutation({
    mutationFn: (id: string) => announcementService.remove(id),
    onSuccess: () => void invalidate(),
  });
}

export function usePublishAnnouncement() {
  const invalidate = useInvalidateAnnouncements();
  return useMutation({
    mutationFn: (id: string) => announcementService.publish(id),
    onSuccess: () => void invalidate(),
  });
}

export function useScheduleAnnouncement() {
  const invalidate = useInvalidateAnnouncements();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ScheduleAnnouncementInput }) => announcementService.schedule(id, input),
    onSuccess: () => void invalidate(),
  });
}
