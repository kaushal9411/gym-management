'use client';

import * as React from 'react';

import { useTenant } from '../hooks/use-tenant';

/**
 * Renders `children` only when the module `feature` is enabled for the tenant
 * (`tenant.featureFlags` — plan modules AND platform kill switches already
 * AND-ed by the API; an absent key means OFF), otherwise `fallback`.
 */
export function RequireFeature({ feature, children, fallback = null }: {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const tenant = useTenant();

  if (!tenant.featureFlags.includes(feature)) return <>{fallback}</>;
  return <>{children}</>;
}
