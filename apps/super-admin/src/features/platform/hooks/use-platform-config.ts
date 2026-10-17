'use client';

import { useQuery } from '@tanstack/react-query';

import { platformConfigService } from '../services/platform-config.service';

export const DEFAULT_PLATFORM_NAME = 'FitCloud';

/**
 * The super-admin-configured platform/app name. Works pre-auth (the login
 * screen renders under the same `QueryClientProvider`) and post-auth —
 * this is server data, not session state, so no Redux slice needed.
 * Falls back to the static default while loading or on any failure.
 */
export function usePlatformName(): string {
  const { data } = useQuery({ queryKey: ['platform-config'], queryFn: () => platformConfigService.get(), staleTime: 60_000 });
  return data?.appName || DEFAULT_PLATFORM_NAME;
}
