'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2 } from 'lucide-react';

import { StatusScreen } from '@/features/auth/components/status-screen';
import { POST_LOGIN_REDIRECT } from '@/features/auth/constants';
import { authService } from '@/features/auth/services/auth.service';
import { sessionEstablished, signedOut, tokensRefreshed } from '@/features/auth/store/auth-slice';
import { AuthServiceError } from '@/features/auth/types';
import { useAppDispatch } from '@/store/hooks';

/**
 * Landing target for the onboarding wizard's cross-origin handoff (see
 * utils/portal-url.ts). Reads the one-time tokens out of the URL fragment,
 * exchanges them for a real session on THIS origin, then scrubs the
 * fragment from history before routing to the dashboard — the fragment
 * must never linger in browser history longer than this one render.
 */
export function OnboardingHandoff() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [error, setError] = React.useState<string | null>(null);
  const ranRef = React.useRef(false);

  React.useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const accessToken = params.get('at');
    const refreshToken = params.get('rt');
    const accessTokenExpiresAt = params.get('exp');

    // Scrub immediately — regardless of outcome, tokens must not sit in the URL.
    window.history.replaceState(null, '', window.location.pathname);

    if (!accessToken || !refreshToken || !accessTokenExpiresAt) {
      setError('This setup link is invalid or has expired. Please sign in with your new account.');
      return;
    }

    dispatch(tokensRefreshed({ accessToken, refreshToken, accessTokenExpiresAt }));

    authService
      .fetchCurrentUser()
      .then(({ user, permissions }) => {
        dispatch(sessionEstablished({ user, permissions, tokens: { accessToken, refreshToken, accessTokenExpiresAt } }));
        router.replace(POST_LOGIN_REDIRECT);
      })
      .catch((err: unknown) => {
        dispatch(signedOut());
        const message = err instanceof AuthServiceError ? err.message : 'Could not complete sign-in. Please log in manually.';
        setError(message);
      });
    // Runs once on mount only — this page exists solely to consume a one-time fragment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <StatusScreen icon={AlertTriangle} tone="destructive" title="Couldn't finish signing you in" description={error}>
        <a href="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Go to sign in
        </a>
      </StatusScreen>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
      <p className="text-sm text-muted-foreground">Signing you in to your new gym portal…</p>
    </div>
  );
}
