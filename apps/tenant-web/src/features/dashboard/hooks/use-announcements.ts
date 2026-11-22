'use client';

import { useQuery } from '@tanstack/react-query';

import { announcementService } from '../services/announcement.service';

/** `/announcements/active` belongs to the `notifications` module, so the query only runs while that module is on. */
export function useAnnouncements(enabled = true) {
  return useQuery({
    queryKey: ['announcements', 'active'],
    queryFn: () => announcementService.listActive(),
    staleTime: 5 * 60_000,
    enabled,
  });
}
