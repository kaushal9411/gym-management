'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Skeleton } from '@/components/ui/skeleton';
import { useMemberAuth } from '../hooks/use-member-auth';
import { MEMBER_PORTAL_ROUTES } from '../constants';

/** Mirrors the staff plane's `RequireAuth` — waits for the bootstrap silent-refresh before deciding to redirect, so a returning member isn't bounced to /portal/login for one frame. */
export function RequireMemberAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isBootstrapping } = useMemberAuth();

  React.useEffect(() => {
    if (!isBootstrapping && !isAuthenticated) {
      router.replace(MEMBER_PORTAL_ROUTES.login);
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
