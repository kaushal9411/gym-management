import type { Metadata } from 'next';

import { LoginForm } from '@/features/auth/components/forms/login-form';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * Own top-level segment (not under `(auth)`) — `LoginForm` renders a
 * complete, self-contained page shell (neon background/header/footer), so
 * nesting it inside the shared `(auth)/layout.tsx` left that layout's own
 * background/chrome still mounted (just visually covered), which caused a
 * flash of the old design on load and stray old content reachable by
 * scrolling. Every other `(auth)` route is unaffected — same pattern
 * `/register` already uses for the same reason.
 */
export default function LoginPage() {
  return <LoginForm />;
}
