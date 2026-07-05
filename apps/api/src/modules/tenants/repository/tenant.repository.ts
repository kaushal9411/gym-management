import type { Branch, Prisma, Tenant, TenantSettings } from '@prisma/client';

import { prisma } from '../../../infrastructure/database/prisma';
import type {
  CreateTenantInput,
  ResolvedTenantRecord,
  TenantRepositoryPort,
} from '../interfaces/tenant.interface';

const DEFAULT_BRANDING = {
  primaryColor: 'oklch(0.51 0.23 277)',
  primaryForeground: 'oklch(0.985 0 0)',
  welcomeMessage: 'Welcome back. Sign in to continue.',
};

/** Shape returned by both `findBySlug`/`findById`'s `include` below. */
type TenantWithRelations = Tenant & {
  settings: TenantSettings | null;
  branding: { primaryColor: string; primaryForeground: string; secondaryColor: string | null; logoUrl: string | null; faviconUrl: string | null; welcomeMessage: string | null } | null;
  subscriptions: Array<{ status: string; trialEndsAt: Date | null; currentPeriodEnd: Date | null; plan: { slug: string; name: string } }>;
  modules: Array<{ key: string; enabled: boolean }>;
  branches: Branch[];
};

const RESOLVE_INCLUDE = {
  settings: true,
  branding: true,
  subscriptions: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    include: { plan: { select: { slug: true, name: true } } },
  },
  modules: { select: { key: true, enabled: true } },
  branches: { where: { isDefault: true }, take: 1 },
} satisfies Prisma.TenantInclude;

function toRecord(tenant: TenantWithRelations): ResolvedTenantRecord {
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    status: tenant.status,
    trialEndsAt: tenant.trialEndsAt,
    subscriptionExpiresAt: tenant.subscriptionExpiresAt,
    maintenanceMode: tenant.maintenanceMode,
    settings: tenant.settings
      ? {
          branding: tenant.settings.branding as Record<string, unknown>,
          timezone: tenant.settings.timezone,
          currency: tenant.settings.currency,
          locale: tenant.settings.locale,
          emailFromName: tenant.settings.emailFromName,
          emailFromAddress: tenant.settings.emailFromAddress,
        }
      : null,
    branding: tenant.branding,
    subscriptions: tenant.subscriptions,
    modules: tenant.modules,
    branches: tenant.branches,
  };
}

/**
 * Uses the RAW (unscoped) Prisma client deliberately — tenant resolution
 * happens BEFORE a tenant context exists (that's the whole point), and the
 * `tenants` table itself has no tenant_id column / RLS policy.
 */
export class TenantRepository implements TenantRepositoryPort {
  async findBySlug(slug: string): Promise<ResolvedTenantRecord | null> {
    const tenant = await prisma.tenant.findUnique({
      where: { slug, deletedAt: null },
      include: RESOLVE_INCLUDE,
    });
    return tenant ? toRecord(tenant) : null;
  }

  async findById(tenantId: string): Promise<ResolvedTenantRecord | null> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
      include: RESOLVE_INCLUDE,
    });
    return tenant ? toRecord(tenant) : null;
  }

  async slugExists(slug: string): Promise<boolean> {
    const count = await prisma.tenant.count({ where: { slug } });
    return count > 0;
  }

  /**
   * Creates ONLY the bare `tenants` row, with a caller-supplied id (rather
   * than Prisma's auto-generated one) — this lets the caller immediately
   * follow up using `getTenantScopedClient(id)` for every child row
   * (settings, branding, the owner user, ...), so RLS is satisfied for
   * those inserts in production too. Used by the onboarding provisioning
   * saga; `createTenantWithSettings` below is unchanged for the simpler
   * direct-registration flow (Prompt 5).
   */
  async createBareTenant(input: {
    id: string;
    slug: string;
    name: string;
    trialEndsAt: Date | null;
  }): Promise<Tenant> {
    return prisma.tenant.create({
      data: { id: input.id, slug: input.slug, name: input.name, trialEndsAt: input.trialEndsAt },
    });
  }

  async createTenantWithSettings(input: CreateTenantInput): Promise<ResolvedTenantRecord> {
    const trialEndsAt = new Date(Date.now() + input.trialDays * 24 * 60 * 60 * 1000);

    const tenant = await prisma.tenant.create({
      data: {
        slug: input.slug,
        name: input.name,
        trialEndsAt,
        settings: {
          create: {
            branding: { ...DEFAULT_BRANDING, welcomeMessage: `Welcome to ${input.name}. Sign in to continue.` },
          },
        },
      },
      include: { settings: true },
    });

    // This path (Prompt 5's direct /auth/register, no onboarding wizard)
    // never creates branding/subscription/modules/branches rows — the
    // tenant simply has none of those yet, not an error.
    return toRecord({ ...tenant, branding: null, subscriptions: [], modules: [], branches: [] });
  }
}

export const tenantRepository = new TenantRepository();
