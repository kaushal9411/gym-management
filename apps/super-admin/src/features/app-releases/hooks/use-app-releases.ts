'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminAppReleaseService } from '../services/app-release.service';
import type { CreateAppReleasePayload } from '../types';

export function useAppReleases() {
  return useQuery({ queryKey: ['admin', 'app-releases'], queryFn: () => adminAppReleaseService.list() });
}

export function useCreateAppRelease() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, onProgress }: { payload: CreateAppReleasePayload; onProgress?: (percent: number) => void }) =>
      adminAppReleaseService.create(payload, onProgress),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'app-releases'] }),
  });
}

export function useActivateAppRelease() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminAppReleaseService.activate(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'app-releases'] }),
  });
}

export function useDeleteAppRelease() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminAppReleaseService.remove(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'app-releases'] }),
  });
}
