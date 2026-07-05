'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAppDispatch } from '@/store/hooks';
import { unreadCountSet } from '../store/notification-slice';
import { notificationService } from '../services/notification.service';

export function useNotifications(params: { unreadOnly?: boolean; page?: number; limit?: number } = {}) {
  const dispatch = useAppDispatch();
  const query = useQuery({
    queryKey: ['notifications', params],
    queryFn: () => notificationService.list(params),
    refetchInterval: 60_000,
  });

  React.useEffect(() => {
    if (query.data) dispatch(unreadCountSet(query.data.unreadCount));
  }, [query.data, dispatch]);

  return query;
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
