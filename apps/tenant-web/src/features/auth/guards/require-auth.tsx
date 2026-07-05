'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Skeleton } from '@/components/ui/skeleton';
import { useAppSelector } from '@/store/hooks';
import { AUTH_ROUTES } from '../constants';
import { selectIsAuthenticated } from '../store/auth-slice';

/**
 * Wrap any private route with this. Redirects unauthenticated visitors to
 * /login — but waits for the initial silent-refresh bootstrap to finish
 * first, so a logged-in user isn't bounced to /login for one frame on
 * every page load (see AuthProvider).
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isBootstrapping = useAppSelector((state) => state.auth.bootstrapping);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  React.useEffect(() => {
    if (!isBootstrapping && !isAuthenticated) {
      router.replace(AUTH_ROUTES.login);
    }
  }, [isBootstrapping, isAuthenticated, router]);

  if (isBootstrapping || !isAuthenticated) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
    );
  }

  return <>{children}</>;
}
