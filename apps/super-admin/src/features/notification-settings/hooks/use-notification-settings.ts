'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notificationSettingsService } from '../services/notification-settings.service';
import type { UpdatePlatformNotificationCredentialsInput } from '../types';

const KEY = ['admin', 'notification-settings'] as const;

export function usePlatformNotificationCredentials() {
  return useQuery({ queryKey: KEY, queryFn: () => notificationSettingsService.getCredentials() });
}

export function useUpdatePlatformNotificationCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePlatformNotificationCredentialsInput) => notificationSettingsService.updateCredentials(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
