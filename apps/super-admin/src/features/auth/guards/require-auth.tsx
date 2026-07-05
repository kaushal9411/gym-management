'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '../hooks/use-auth';

/** Mirrors tenant-web's RequireAuth — gates on `isAuthenticated` (derived from `admin !== null`), never on `status`. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isBootstrapping } = useAuth();

  React.useEffect(() => {
    if (!isBootstrapping && !isAuthenticated) router.replace('/login');
  }, [isBootstrapping, isAuthenticated, router]);

  if (isBootstrapping) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner label="Loading" />
      </div>
    );
  }
  if (!isAuthenticated) return null;

  return <>{children}</>;
}
