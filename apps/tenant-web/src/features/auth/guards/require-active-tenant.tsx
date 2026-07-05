'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useTenant } from '../hooks/use-tenant';
import { AUTH_ROUTES } from '../constants';

/**
 * Ensures the request actually resolved to a real gym (not the bare
 * platform host falling back to placeholder branding — see
 * features/tenant/resolve.ts). Use on routes that assume tenant-scoped
 * data exists at all, before even checking subscription/auth state.
 */
export function RequireActiveTenant({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const tenant = useTenant();
  const isRealTenant = tenant.id !== 'platform';

  React.useEffect(() => {
    if (!isRealTenant) router.replace(AUTH_ROUTES.accessDenied);
  }, [isRealTenant, router]);

  if (!isRealTenant) return null;
  return <>{children}</>;
}
