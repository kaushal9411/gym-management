import { PLATFORM_TENANT, type Tenant } from './types';

interface TenantResolveApiResponse {
  success: boolean;
  data: {
    id: string;
    slug: string;
    name: string;
    status: Tenant['status'];
    maintenanceMode: boolean;
    maintenanceMessage?: string | null;
    branding: Tenant['branding'];
    timezone: string;
    currency: string;
    locale: string;
    subscription: Tenant['subscription'];
    featureFlags: string[];
    defaultBranch: Tenant['defaultBranch'];
  } | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

interface PlatformConfigApiResponse {
  success: boolean;
  data: { appName: string; supportEmail?: string | null } | null;
}

/**
 * The super-admin-configured platform name (`GET /public/platform-config`,
 * short-TTL-cached server-side). A plain `fetch()` so Next's request
 * memoization dedupes it across `resolveTenant()`'s two per-request call
 * sites (`generateMetadata()` + `RootLayout()`) the same way the tenant
 * resolve call below is already deduped. Any failure degrades to the
 * static default rather than breaking the request.
 */
async function resolvePlatformConfig(): Promise<{ platformName: string; supportEmail: string | null }> {
  const fallback = { platformName: PLATFORM_TENANT.platformName, supportEmail: null };
  try {
    const res = await fetch(`${API_URL}/public/platform-config`, { cache: 'no-store' });
    if (!res.ok) return fallback;
    const body = (await res.json()) as PlatformConfigApiResponse;
    if (!body.success || !body.data) return fallback;
    return { platformName: body.data.appName || fallback.platformName, supportEmail: body.data.supportEmail ?? null };
  } catch {
    return fallback;
  }
}

/**
 * Resolves a tenant by slug against the REAL backend
 * (`GET /public/tenants/resolve?slug=…`, Redis-cached server-side). Runs
 * on the server (RootLayout is an async Server Component) so branding
 * paints on first byte with no client-side flash. As of Prompt 10 this one
 * call also delivers everything the portal shell's initialization sequence
 * needs — subscription status, feature flags, default branch — so
 * tenant-web doesn't need four more round-trips just to boot. It also
 * fetches the platform name alongside (in parallel, since the two are
 * independent) so every tenant gets `platformName` regardless of slug.
 *
 * Unknown slugs, empty slugs, and network failures all fall back to
 * platform branding so the page still renders something reasonable
 * rather than crashing the whole request.
 */
export async function resolveTenant(slug: string | null | undefined): Promise<Tenant> {
  if (!slug) return { ...PLATFORM_TENANT, ...(await resolvePlatformConfig()) };

  const [tenantResult, platformConfig] = await Promise.all([
    (async (): Promise<Tenant> => {
      try {
        const res = await fetch(`${API_URL}/public/tenants/resolve?slug=${encodeURIComponent(slug)}`, {
          cache: 'no-store',
        });
        if (!res.ok) return { ...PLATFORM_TENANT, slug };

        const body = (await res.json()) as TenantResolveApiResponse;
        if (!body.success || !body.data) return { ...PLATFORM_TENANT, slug };

        return {
          id: body.data.id,
          slug: body.data.slug,
          name: body.data.name,
          status: body.data.status,
          maintenanceMode: body.data.maintenanceMode,
          maintenanceMessage: body.data.maintenanceMessage ?? null,
          branding: body.data.branding,
          timezone: body.data.timezone,
          currency: body.data.currency,
          locale: body.data.locale,
          subscription: body.data.subscription,
          featureFlags: body.data.featureFlags,
          defaultBranch: body.data.defaultBranch,
          platformName: PLATFORM_TENANT.platformName,
        };
      } catch {
        // API unreachable — degrade to platform branding rather than a 500.
        return { ...PLATFORM_TENANT, slug };
      }
    })(),
    resolvePlatformConfig(),
  ]);

  return { ...tenantResult, ...platformConfig };
}
