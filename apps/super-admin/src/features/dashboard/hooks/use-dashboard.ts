'use client';

import { useQuery } from '@tanstack/react-query';

import { dashboardService } from '../services/dashboard.service';

export function useDashboardStats() {
  return useQuery({ queryKey: ['admin', 'dashboard', 'stats'], queryFn: () => dashboardService.getStats(), staleTime: 60_000 });
}
