'use client';

import { useQuery } from '@tanstack/react-query';

import { announcementService } from '../services/announcement.service';

export function useAnnouncements() {
  return useQuery({
    queryKey: ['announcements', 'active'],
    queryFn: () => announcementService.listActive(),
    staleTime: 5 * 60_000,
  });
}
