'use client';

import * as React from 'react';

import type { Tenant } from './types';

const TenantContext = React.createContext<Tenant | null>(null);

/**
 * Makes the server-resolved tenant available to all client components.
 * The tenant is resolved once per request in the root layout (from the
 * x-tenant-slug header set by middleware) — no client round-trip, no flash.
 */
export function TenantProvider({ tenant, children }: { tenant: Tenant; children: React.ReactNode }) {
  return <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>;
}

export function useTenant(): Tenant {
  const tenant = React.useContext(TenantContext);
  if (!tenant) {
    throw new Error('useTenant must be used within <TenantProvider>');
  }
  return tenant;
}
