/**
 * The tenant is resolved server-side (RootLayout, from the subdomain) and
 * made available via `TenantProvider` — see features/tenant/tenant-provider.tsx.
 * Re-exported here so it's discoverable alongside the other auth-domain
 * hooks per the feature's folder convention, without a second, competing
 * implementation of tenant detection on the client.
 */
export { useTenant } from '@/features/tenant/tenant-provider';
