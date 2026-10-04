'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { dashboardService } from '../services/dashboard.service';
import type { OverviewRange } from '../types';

export const OVERVIEW_POLL_MS = 45_000;
export const OVERVIEW_QUERY_KEY = ['admin', 'dashboard', 'overview'] as const;

export function useDashboardStats(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['admin', 'dashboard', 'stats'],
    queryFn: () => dashboardService.getStats(),
    staleTime: 60_000,
    enabled: options?.enabled ?? true,
  });
}

/** Live dashboard feed. Polls every 45s (TanStack pauses interval refetches while the tab is hidden — `refetchIntervalInBackground` stays false). */
export function useDashboardOverview(range: OverviewRange) {
  return useQuery({
    queryKey: [...OVERVIEW_QUERY_KEY, range],
    queryFn: () => dashboardService.getOverview(range),
    placeholderData: keepPreviousData,
    refetchInterval: OVERVIEW_POLL_MS,
    refetchIntervalInBackground: false,
    retry: false,
    staleTime: 15_000,
  });
}

/** Passive overview for the shell (nav badges, environment badge). Same cache key as the dashboard's 30d view, no polling. */
export function useShellOverview(enabled: boolean) {
  return useQuery({
    queryKey: [...OVERVIEW_QUERY_KEY, '30d'],
    queryFn: () => dashboardService.getOverview('30d'),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}
