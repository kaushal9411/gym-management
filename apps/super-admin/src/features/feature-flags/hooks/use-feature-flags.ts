'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminFeatureFlagService } from '../services/feature-flag.service';

export function useFeatureFlags() {
  return useQuery({ queryKey: ['admin', 'feature-flags'], queryFn: () => adminFeatureFlagService.list() });
}

export function useSetFeatureFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) => adminFeatureFlagService.setEnabled(key, enabled),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'feature-flags'] }),
  });
}
