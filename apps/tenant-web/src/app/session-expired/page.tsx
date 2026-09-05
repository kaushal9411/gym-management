import type { Metadata } from 'next';

import { SessionExpiredView } from '@/features/auth/components/status/session-expired-view';

export const metadata: Metadata = { title: 'Session expired' };

/**
 * Own top-level segment (not under `(auth)`) — same reason as `/login` and
 * `/forgot-password`: `SessionExpiredView` renders a complete, self-contained
 * page shell (neon background/header/footer) to match their look exactly,
 * rather than the shared `(auth)/layout.tsx` split-screen shell every other
 * status route still uses.
 */
export default function SessionExpiredPage() {
  return <SessionExpiredView />;
}
