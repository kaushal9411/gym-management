import { PLATFORM_TENANT, type Tenant } from './types';

/**
 * MOCK tenant registry.
 *
 * Replaced by `GET /api/v1/public/tenants/resolve?slug=…` (Redis-cached)
 * when the backend lands. Shapes match the API contract so the swap is a
 * one-line change in `resolveTenant`.
 */
const MOCK_TENANTS: Record<string, Tenant> = {
  goldgym: {
    id: 'a2f8d9e0-0000-4000-8000-000000000001',
    slug: 'goldgym',
    name: "Gold's Gym",
    status: 'active',
    branding: {
      primaryColor: 'oklch(0.68 0.16 75)',
      primaryForeground: 'oklch(0.2 0.05 75)',
      welcomeMessage: 'Stronger every day. Sign in to continue.',
    },
  },
  fitnesshub: {
    id: 'a2f8d9e0-0000-4000-8000-000000000002',
    slug: 'fitnesshub',
    name: 'Fitness Hub',
    status: 'active',
    branding: {
      primaryColor: 'oklch(0.55 0.2 250)',
      primaryForeground: 'oklch(0.985 0 0)',
      welcomeMessage: 'Your fitness journey starts here.',
    },
  },
  musclefactory: {
    id: 'a2f8d9e0-0000-4000-8000-000000000003',
    slug: 'musclefactory',
    name: 'Muscle Factory',
    status: 'active',
    branding: {
      primaryColor: 'oklch(0.55 0.21 25)',
      primaryForeground: 'oklch(0.985 0 0)',
      welcomeMessage: 'Built different. Train harder.',
    },
  },
};

/**
 * Resolve a tenant by slug. Unknown/empty slugs fall back to platform
 * branding so localhost and fitcloud.com still render a working portal.
 */
export function resolveTenant(slug: string | null | undefined): Tenant {
  if (!slug) return PLATFORM_TENANT;
  return MOCK_TENANTS[slug.toLowerCase()] ?? { ...PLATFORM_TENANT, slug };
}
