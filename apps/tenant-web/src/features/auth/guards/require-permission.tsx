'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { usePermissions } from '../hooks/use-permissions';
import { AUTH_ROUTES } from '../constants';

/** PBAC gate — renders children only if the current user holds `permission`. */
export function RequirePermission({ permission, children }: { permission: string; children: React.ReactNode }) {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const allowed = hasPermission(permission);

  React.useEffect(() => {
    if (!allowed) router.replace(AUTH_ROUTES.accessDenied);
  }, [allowed, router]);

  if (!allowed) return null;
  return <>{children}</>;
}
