'use client';

import { useQuery } from '@tanstack/react-query';

import { searchService } from '../services/search.service';

const MIN_QUERY_LENGTH = 2;

/** Cross-module lookup (Members/Staff/Branches) — caller is responsible for debouncing `query`. */
export function useGlobalSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['search', trimmed],
    queryFn: () => searchService.search(trimmed),
    enabled: trimmed.length >= MIN_QUERY_LENGTH,
    staleTime: 30_000,
  });
}
