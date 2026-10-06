'use client';

import * as React from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAppDispatch } from '@/store/hooks';
import { notificationService } from '../services/notification.service';
import { unreadCountSet } from '../store/notification-slice';
import type { CreateNotificationInput, MessageLogListParams, NotificationListParams, NotificationStatsParams, NotificationTemplateType, UpdateNotificationTemplateInput } from '../types';

export function useNotifications(params: NotificationListParams = {}) {
  const dispatch = useAppDispatch();
  const query = useQuery({
    queryKey: ['notifications', params],
    queryFn: () => notificationService.list(params),
    refetchInterval: 60_000,
    // Server-side category/search/unread filters change the key; keep the old rows on screen meanwhile.
    placeholderData: keepPreviousData,
  });

  React.useEffect(() => {
    if (query.data) dispatch(unreadCountSet(query.data.unreadCount));
  }, [query.data, dispatch]);

  return query;
}

/** Period stats for the /notifications dashboard. Key sits under ['notifications'] so mark-read / realtime invalidations refresh it. */
export function useNotificationStats(params: NotificationStatsParams, enabled = true) {
  return useQuery({
    queryKey: ['notifications', 'stats', params],
    queryFn: () => notificationService.stats(params),
    enabled,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useNotificationDetails(notificationId: string | null) {
  return useQuery({
    queryKey: ['notifications', 'detail', notificationId],
    queryFn: () => notificationService.getById(notificationId!),
    enabled: !!notificationId,
  });
}

export function useCreateNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateNotificationInput) => notificationService.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => notificationService.remove(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => notificationService.markRead(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useNotificationTemplates(enabled = true) {
  return useQuery({
    queryKey: ['notifications', 'templates'],
    queryFn: () => notificationService.listTemplates(),
    enabled,
  });
}

export function useUpdateNotificationTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ type, input }: { type: NotificationTemplateType; input: UpdateNotificationTemplateInput }) =>
      notificationService.updateTemplate(type, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'templates'] });
    },
  });
}

export function useMessageLog(params: MessageLogListParams = {}) {
  return useQuery({
    queryKey: ['notifications', 'message-log', params],
    queryFn: () => notificationService.listMessageLog(params),
    placeholderData: keepPreviousData,
  });
}
