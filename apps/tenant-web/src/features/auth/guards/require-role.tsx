'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { usePermissions } from '../hooks/use-permissions';
import { AUTH_ROUTES } from '../constants';
import type { UserRole } from '../types';

/** RBAC gate — renders children only if the current user holds one of `roles`. */
export function RequireRole({ roles, children }: { roles: UserRole[]; children: React.ReactNode }) {
  const router = useRouter();
  const { hasAnyRole } = usePermissions();
  const allowed = hasAnyRole(roles);

  React.useEffect(() => {
    if (!allowed) router.replace(AUTH_ROUTES.accessDenied);
  }, [allowed, router]);

  if (!allowed) return null;
  return <>{children}</>;
}
