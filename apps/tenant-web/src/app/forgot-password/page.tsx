import type { Metadata } from 'next';

import { ForgotPasswordForm } from '@/features/auth/components/forms/forgot-password-form';

export const metadata: Metadata = { title: 'Forgot password' };

/**
 * Own top-level segment (not under `(auth)`) — same reason as `/login`:
 * `ForgotPasswordForm` renders a complete, self-contained page shell (neon
 * background/header/footer) so it can match the login page's look exactly,
 * rather than the shared `(auth)/layout.tsx` split-screen shell used by
 * every other auth/status route.
 */
export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
