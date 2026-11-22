'use client';

import * as React from 'react';

import type { Tenant } from './types';

const TenantContext = React.createContext<Tenant | null>(null);

/**
 * Makes the server-resolved tenant available to all client components.
 * The tenant is resolved in the root layout (from the x-tenant-slug header set by middleware) —
 * no client round-trip, no flash. The context FOLLOWS new props: `<TenantFlagsRefresher>` calls
 * `router.refresh()`, RootLayout re-resolves the tenant and a changed `featureFlags` flows in here.
 * Two guards keep refreshes safe: an unchanged tenant keeps its previous object identity (no
 * needless re-renders / memo busts), and a failed re-resolve (`resolveTenant` degrades to the
 * flag-less platform tenant when the API is unreachable) never replaces a real tenant.
 */
export function TenantProvider({ tenant, children }: { tenant: Tenant; children: React.ReactNode }) {
  const ref = React.useRef(tenant);
  const previous = ref.current;
  let value = tenant;
  if (previous.id !== 'platform' && tenant.id === 'platform') value = previous;
  else if (JSON.stringify(previous) === JSON.stringify(tenant)) value = previous;
  ref.current = value;
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): Tenant {
  const tenant = React.useContext(TenantContext);
  if (!tenant) {
    throw new Error('useTenant must be used within <TenantProvider>');
  }
  return tenant;
}
