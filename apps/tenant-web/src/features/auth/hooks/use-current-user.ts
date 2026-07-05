'use client';

import { useAppSelector } from '@/store/hooks';

/** Thin accessor for the current session's profile — null when signed out. */
export function useCurrentUser() {
  return useAppSelector((state) => state.auth.user);
}
