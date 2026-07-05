'use client';

import { useQuery } from '@tanstack/react-query';

import { adminRevenueService } from '../services/revenue.service';

export function useRevenueSummary() {
  return useQuery({ queryKey: ['admin', 'revenue', 'summary'], queryFn: () => adminRevenueService.summary() });
}

export function useRevenueGrowth(days = 30) {
  return useQuery({ queryKey: ['admin', 'revenue', 'growth', days], queryFn: () => adminRevenueService.growth(days) });
}
