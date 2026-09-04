import type { Metadata } from 'next';

import { StaffActivationView } from '@/features/staff/components/staff-activation-view';

export const metadata: Metadata = { title: 'Activate your account' };

interface StaffActivationPageProps {
  params: Promise<{ token: string }>;
}

/**
 * Own top-level segment (not under `(auth)`) — same reason as `/login`,
 * `/forgot-password`, `/reset-password`: `StaffActivationView` renders a
 * complete, self-contained page shell (neon background/header/footer) so
 * all four match exactly, rather than the shared `(auth)/layout.tsx`
 * split-screen shell used by every other auth/status route.
 */
export default async function StaffActivationPage({ params }: StaffActivationPageProps) {
  const { token } = await params;
  return <StaffActivationView token={token} />;
}
