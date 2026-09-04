import type { Metadata } from 'next';

import { ResetPasswordForm } from '@/features/auth/components/forms/reset-password-form';

export const metadata: Metadata = { title: 'Reset password' };

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

/**
 * Own top-level segment (not under `(auth)`) — same reason as `/login` and
 * `/forgot-password`: `ResetPasswordForm` renders a complete, self-contained
 * page shell (neon background/header/footer) so all three match exactly,
 * rather than the shared `(auth)/layout.tsx` split-screen shell used by
 * every other auth/status route.
 */
export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token = '' } = await searchParams;
  return <ResetPasswordForm token={token} />;
}
