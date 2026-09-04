'use client';

import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/features/auth/services/api-client';

export interface LatestAppRelease {
  version: string;
  releaseNotes: string | null;
  fileUrl: string;
  fileSizeBytes: string;
}

interface Envelope<T> {
  success: boolean;
  data: T;
}

/**
 * `/public/app-releases/latest` needs no auth (any user — staff, member, or
 * a visitor with neither — can download the app), so this deliberately
 * calls the plain staff `apiClient` instance just for its base URL/retry
 * config, not for the Authorization header it happens to attach when a
 * staff session exists; the endpoint ignores auth entirely either way. Same
 * hook works from the member-portal shell (`memberApiClient` would work
 * identically here, but reusing one client avoids a second near-identical
 * hook for a single GET). Returns `null`, not an error, when nothing has
 * been published yet — the button/link should just not render, not surface
 * a 404 as if something broke.
 */
export function useLatestAppRelease() {
  return useQuery({
    queryKey: ['app-releases', 'latest'],
    queryFn: async (): Promise<LatestAppRelease | null> => {
      try {
        const res = await apiClient.get<Envelope<LatestAppRelease>>('/public/app-releases/latest');
        return res.data.data;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60_000,
  });
}
