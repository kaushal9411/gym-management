'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AdminServiceError } from '@/features/auth/types';
import { adminNotificationService } from '../services/notification.service';
import type { CreateAnnouncementInput, CreateNotificationInput } from '../types';

export function toNotificationError(error: unknown): AdminServiceError {
  if (error instanceof AdminServiceError) return error;
  return new AdminServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

export function useAnnouncements() {
  return useQuery({ queryKey: ['admin', 'announcements'], queryFn: () => adminNotificationService.listAnnouncements() });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAnnouncementInput) => adminNotificationService.createAnnouncement(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] }),
  });
}

export function useSetAnnouncementActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => adminNotificationService.setAnnouncementActive(id, isActive),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] }),
  });
}

export function useNotifications() {
  return useQuery({ queryKey: ['admin', 'notifications'], queryFn: () => adminNotificationService.listNotifications() });
}

export function useCreateNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateNotificationInput) => adminNotificationService.createNotification(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] }),
  });
}

export function useSendNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminNotificationService.send(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] }),
  });
}
