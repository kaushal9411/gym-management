import { redirect } from 'next/navigation';

import { AUTH_ROUTES } from '@/features/auth/constants';

/**
 * This used to be a separate, un-themed member-only forgot-password page
 * (plain Card, no neon shell — visibly inconsistent with `/login`'s design
 * and every other auth screen). `/forgot-password` is now the one shared
 * screen for both staff and members (same "Email or Member ID" + `@`
 * detection precedent as the unified `/login` page) — this route survives
 * only as a redirect, for anyone with the old URL bookmarked.
 */
export default function MemberForgotPasswordRedirect() {
  redirect(AUTH_ROUTES.forgotPassword);
}
