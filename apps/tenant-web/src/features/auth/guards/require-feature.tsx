'use client';

import * as React from 'react';

import { useTenant } from '../hooks/use-tenant';

/**
 * Plan-gated feature flags live on the tenant's subscription plan — a
 * concept the Subscriptions module (not yet built) will populate. Until
 * then this is an honest stub: it never grants access to a feature it
 * can't actually verify, matching the backend's own
 * `feature-access.middleware.ts` (same rationale documented there).
 */
export function RequireFeature({ feature, children, fallback = null }: {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const tenant = useTenant();
  const features = (tenant as { features?: Record<string, boolean> }).features;

  if (!features?.[feature]) return <>{fallback}</>;
  return <>{children}</>;
}
