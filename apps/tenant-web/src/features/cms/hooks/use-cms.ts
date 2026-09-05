'use client';

import { useQuery } from '@tanstack/react-query';

import { cmsService } from '../services/cms.service';
import type { CmsPageType } from '../types';

/** Public, unauthenticated content — long staleTime, it changes on an admin's schedule, not a per-session one. */
export function usePublishedCmsPages(type: CmsPageType) {
  return useQuery({
    queryKey: ['cms', 'published', type],
    queryFn: () => cmsService.listPublished(type),
    staleTime: 5 * 60_000,
  });
}
