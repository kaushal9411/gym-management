'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useTenant } from '@/features/tenant/tenant-provider';
import { AUTH_ROUTES } from '../../constants';

/**
 * Sends signed-out visitors of a gym that is under maintenance (its own switch OR the platform-wide one) straight to the dedicated
 * maintenance page instead of showing a login form that could only fail. Wraps the self-contained public auth pages
 * (login, forgot/reset password, phone code). Not applied on the bare platform host (no gym to be "in maintenance").
 */
export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const tenant = useTenant();
  const blocked = tenant.maintenanceMode && tenant.id !== 'platform';

  React.useEffect(() => {
    if (blocked) router.replace(AUTH_ROUTES.maintenance);
  }, [blocked, router]);

  if (blocked) return null;
  return <>{children}</>;
}
