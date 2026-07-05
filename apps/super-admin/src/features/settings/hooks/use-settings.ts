'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AdminServiceError } from '@/features/auth/types';
import { adminSettingsService } from '../services/settings.service';

export function toSettingsError(error: unknown): AdminServiceError {
  if (error instanceof AdminServiceError) return error;
  return new AdminServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

export function useSettings() {
  return useQuery({ queryKey: ['admin', 'settings'], queryFn: () => adminSettingsService.list() });
}

export function useUpsertSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, category, value }: { key: string; category: string; value: unknown }) => adminSettingsService.upsert(key, category, value),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] }),
  });
}
