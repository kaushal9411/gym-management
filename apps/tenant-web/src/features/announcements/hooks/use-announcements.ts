'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthServiceError } from '@/features/auth/types';
import { announcementService } from '../services/announcement.service';
import type { AnnouncementListParams, AnnouncementStatsParams, CreateAnnouncementInput, ScheduleAnnouncementInput, UpdateAnnouncementInput } from '../types';

export function toAnnouncementError(error: unknown): AuthServiceError {
  if (error instanceof AuthServiceError) return error;
  return new AuthServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

export function useAnnouncements(params: AnnouncementListParams = {}) {
  return useQuery({
    queryKey: ['tenant-announcements', params],
    queryFn: () => announcementService.list(params),
    placeholderData: keepPreviousData,
  });
}

/** Analytics for the Announcements page; gate with `enabled` (permission + valid range). Invalidated with the list by every mutation. */
export function useAnnouncementStats(params: AnnouncementStatsParams, enabled = true) {
  return useQuery({
    queryKey: ['tenant-announcements', 'stats', params],
    queryFn: () => announcementService.getStats(params),
    enabled,
    placeholderData: keepPreviousData,
    retry: false,
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
