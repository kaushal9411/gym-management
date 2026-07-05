'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useTenant } from '../hooks/use-tenant';
import { AUTH_ROUTES } from '../constants';

/**
 * Preemptive check using the tenant status already resolved server-side —
 * catches SUSPENDED/CANCELLED/maintenance before rendering a private page
 * at all. Trial/subscription EXPIRY dates are intentionally not exposed
 * by the public tenant-resolve endpoint (they're not public information),
 * so that case is instead enforced backend-side and handled reactively by
 * the axios client's global error interceptor on the first API call that
 * hits it (see services/api-client.ts) — this guard complements, not
 * replaces, that server-side enforcement.
 */
export function RequireSubscription({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const tenant = useTenant();
  const blocked = tenant.maintenanceMode || tenant.status === 'SUSPENDED' || tenant.status === 'CANCELLED';

  React.useEffect(() => {
    if (tenant.maintenanceMode) {
      router.replace(AUTH_ROUTES.maintenance);
    } else if (tenant.status === 'SUSPENDED' || tenant.status === 'CANCELLED') {
      router.replace(AUTH_ROUTES.accountSuspended);
    }
  }, [tenant, router]);

  if (blocked) return null;
  return <>{children}</>;
}
