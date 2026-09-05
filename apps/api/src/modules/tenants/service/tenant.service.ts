import { TenantError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { cache } from '../../../infrastructure/cache/redis';
import { prisma } from '../../../infrastructure/database/prisma';
import type {
  PublicTenantSummary,
  ResolvedTenant,
  ResolvedTenantRecord,
  TenantRepositoryPort,
} from '../interfaces/tenant.interface';
import { tenantRepository } from '../repository/tenant.repository';
import { RESERVED_SLUGS, SLUG_PATTERN } from '../types/tenant.types';

const CACHE_TTL_SECONDS = 300;
const slugCacheKey = (slug: string) => `tenant:slug:${slug}`;
const idCacheKey = (id: string) => `tenant:id:${id}`;

/**
 * Platform-wide `FeatureFlag.enabled` keys (Prompt 80's kill switch) — a
 * separate, single, short-TTL cache entry (NOT baked into the per-tenant
 * cached record above), so an admin toggling one takes effect within
 * seconds for every tenant, not up to 5 minutes per already-cached tenant.
 */
const PLATFORM_FLAGS_CACHE_KEY = 'platform:feature-flags:enabled';
const PLATFORM_FLAGS_CACHE_TTL_SECONDS = 30;

/**
 * Every key that's actually under platform-flag control, mapped to its
 * current `enabled` value — NOT just the enabled ones. A `TenantModule`
 * key with no row here at all (e.g. `members`/`staff`/`branches`/
 * `membership_plans`, deliberately never made a kill switch — see
 * `FEATURE_FLAGS` in `prisma/seed.ts`) must read as "platform-enabled by
 * default", which a plain enabled-only Set couldn't distinguish from
 * "platform-disabled."
 */
async function getPlatformFeatureFlagMap(): Promise<Map<string, boolean>> {
  const cached = await cache.get<Array<[string, boolean]>>(PLATFORM_FLAGS_CACHE_KEY);
  if (cached) return new Map(cached);
  const rows = await prisma.featureFlag.findMany({ select: { key: true, enabled: true } });
  const entries: Array<[string, boolean]> = rows.map((r) => [r.key, r.enabled]);
  await cache.set(PLATFORM_FLAGS_CACHE_KEY, entries, PLATFORM_FLAGS_CACHE_TTL_SECONDS);
  return new Map(entries);
}

/** Called by `AdminFeatureFlagService#setEnabled` right after a toggle so the change is live immediately, not after the TTL lapses. */
export async function invalidatePlatformFeatureFlagsCache(): Promise<void> {
  await cache.del(PLATFORM_FLAGS_CACHE_KEY);
}

interface TenantBrandingShape {
  primaryColor: string;
  primaryForeground: string;
  logoUrl?: string;
  welcomeMessage: string;
}

/**
 * Dates don't survive a JSON.stringify/parse round-trip (Redis stores the
 * cached record as a JSON string) — they come back as plain strings, not
 * Date instances. Re-hydrate them so downstream code (assertTenantAccessible)
 * can safely call `.getTime()` regardless of whether the record came from a
 * fresh Prisma read or a cache hit.
 */
function reviveTenantRecordDates(record: ResolvedTenantRecord): ResolvedTenantRecord {
  return {
    ...record,
    trialEndsAt: record.trialEndsAt ? new Date(record.trialEndsAt) : null,
    subscriptionExpiresAt: record.subscriptionExpiresAt ? new Date(record.subscriptionExpiresAt) : null,
    subscriptions: record.subscriptions.map((s) => ({
      ...s,
      trialEndsAt: s.trialEndsAt ? new Date(s.trialEndsAt) : null,
      currentPeriodEnd: s.currentPeriodEnd ? new Date(s.currentPeriodEnd) : null,
    })),
  };
}

/**
 * Two branding sources exist historically: the dedicated `TenantBranding`
 * table (Prompt 7's onboarding wizard) and a JSON blob on `TenantSettings`
 * (Prompt 5's simpler direct-registration path). The dedicated table wins
 * when present; the JSON blob is the fallback for tenants provisioned
 * before it existed — not a rearchitecture, just resolving an inherited
 * inconsistency honestly instead of silently picking one and breaking the other.
 */
function toResolvedTenant(record: ResolvedTenantRecord, platformFlags: Map<string, boolean>): ResolvedTenant {
  const jsonBranding = (record.settings?.branding ?? {}) as Partial<TenantBrandingShape>;
  const table = record.branding;
  const subscription = record.subscriptions[0] ?? null;

  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    status: record.status,
    maintenanceMode: record.maintenanceMode,
    branding: {
      primaryColor: table?.primaryColor ?? jsonBranding.primaryColor ?? 'oklch(0.51 0.23 277)',
      primaryForeground: table?.primaryForeground ?? jsonBranding.primaryForeground ?? 'oklch(0.985 0 0)',
      secondaryColor: table?.secondaryColor ?? 'oklch(0.62 0.2 277)',
      logoUrl: table?.logoUrl ?? jsonBranding.logoUrl,
      faviconUrl: table?.faviconUrl ?? undefined,
      loginBackgroundUrl: table?.loginBackgroundUrl ?? undefined,
      dashboardBannerUrl: table?.dashboardBannerUrl ?? undefined,
      emailLogoUrl: table?.emailLogoUrl ?? undefined,
      welcomeMessage: table?.welcomeMessage ?? jsonBranding.welcomeMessage ?? 'Welcome back. Sign in to continue.',
    },
    timezone: record.settings?.timezone ?? 'UTC',
    currency: record.settings?.currency ?? 'INR',
    locale: record.settings?.locale ?? 'en',
    emailFromName: record.settings?.emailFromName ?? null,
    emailFromAddress: record.settings?.emailFromAddress ?? null,
    subscription: subscription
      ? {
          status: subscription.status,
          planSlug: subscription.plan.slug,
          planName: subscription.plan.name,
          trialEndsAt: subscription.trialEndsAt ? subscription.trialEndsAt.toISOString() : null,
          currentPeriodEnd: subscription.currentPeriodEnd ? subscription.currentPeriodEnd.toISOString() : null,
        }
      : null,
    // ANDed with the platform-wide kill switch (Prompt 80) — a module the
    // tenant's plan grants (`m.enabled`) is still hidden/blocked if a super
    // admin has disabled it platform-wide. `platformFlags.get(key) ?? true`
    // treats a key with no matching `FeatureFlag` row as platform-enabled
    // by default (see `getPlatformFeatureFlagMap`'s doc comment).
    featureFlags: record.modules.filter((m) => m.enabled && (platformFlags.get(m.key) ?? true)).map((m) => m.key),
    defaultBranch: record.branches[0] ? { id: record.branches[0].id, name: record.branches[0].name, timezone: record.branches[0].timezone } : null,
  };
}

/**
 * Tenant identity + validation — the "Tenant Validation Flow" deliverable.
 * Deliberately does NOT include gym operations (branches, billing UI,
 * plan management); only what authentication needs to identify a tenant
 * and decide whether requests against it should proceed at all.
 */
export class TenantService {
  constructor(private readonly repository: TenantRepositoryPort) {}

  /** Cache-aside resolve by subdomain slug. Returns null for unknown tenants. */
  async resolveBySlug(slug: string): Promise<{ tenant: ResolvedTenant; record: ResolvedTenantRecord } | null> {
    const cached = await cache.get<ResolvedTenantRecord>(slugCacheKey(slug));
    const record = cached ? reviveTenantRecordDates(cached) : await this.repository.findBySlug(slug);
    if (!record) return null;

    if (!cached) await cache.set(slugCacheKey(slug), record, CACHE_TTL_SECONDS);
    const platformFlags = await getPlatformFeatureFlagMap();
    return { tenant: toResolvedTenant(record, platformFlags), record };
  }

  /**
   * Resolve by id — used by background jobs / event listeners that only
   * carry a tenantId (e.g. rendering a branded email after the subdomain
   * that triggered the request is no longer in scope).
   */
  async resolveById(tenantId: string): Promise<ResolvedTenant | null> {
    const cached = await cache.get<ResolvedTenantRecord>(idCacheKey(tenantId));
    const record = cached ? reviveTenantRecordDates(cached) : await this.repository.findById(tenantId);
    if (!record) return null;

    if (!cached) await cache.set(idCacheKey(tenantId), record, CACHE_TTL_SECONDS);
    const platformFlags = await getPlatformFeatureFlagMap();
    return toResolvedTenant(record, platformFlags);
  }

  /** Not cached — this list changes rarely and a stale-for-5-minutes picker is worse than one extra query per pre-login screen view. */
  listActive(): Promise<PublicTenantSummary[]> {
    return this.repository.listActive();
  }

  async invalidateCache(slug: string, tenantId?: string): Promise<void> {
    await cache.del(slugCacheKey(slug));
    if (tenantId) await cache.del(idCacheKey(tenantId));
  }

  /**
   * Throws the specific AppError for the first failing check, in priority
   * order: not found → maintenance → suspended → trial expired →
   * subscription expired. Passing means the request may proceed.
   *
   * `allowExpired` skips ONLY the two expiry checks — the billing rescue
   * path: an owner whose trial/subscription lapsed must still be able to
   * log in and pay, otherwise expiry is an unrecoverable dead end.
   * Suspension (an admin decision) and maintenance always block.
   */
  assertTenantAccessible(record: ResolvedTenantRecord, options?: { allowExpired?: boolean }): void {
    const now = new Date();

    if (record.maintenanceMode) {
      throw new TenantError(ErrorCode.MAINTENANCE, 'This gym portal is undergoing scheduled maintenance', 503);
    }
    if (record.status === 'SUSPENDED' || record.status === 'CANCELLED') {
      throw new TenantError(ErrorCode.TENANT_SUSPENDED, 'This gym account has been suspended', 403);
    }
    if (options?.allowExpired) return;

    if (record.status === 'TRIAL' && record.trialEndsAt && record.trialEndsAt.getTime() < now.getTime()) {
      throw new TenantError(ErrorCode.TRIAL_EXPIRED, 'The free trial for this gym has ended', 402);
    }
    if (
      record.status === 'PAST_DUE' &&
      record.subscriptionExpiresAt &&
      record.subscriptionExpiresAt.getTime() < now.getTime()
    ) {
      throw new TenantError(ErrorCode.SUBSCRIPTION_EXPIRED, 'The subscription for this gym has expired', 402);
    }
  }

  /** Slug validation for registration — format, reserved words, then availability. */
  async assertSlugAvailable(slug: string): Promise<void> {
    if (!SLUG_PATTERN.test(slug)) {
      throw new TenantError(ErrorCode.VALIDATION_ERROR, 'Subdomain must be lowercase letters, numbers and hyphens', 422);
    }
    if (RESERVED_SLUGS.has(slug)) {
      throw new TenantError(ErrorCode.SLUG_RESERVED, `"${slug}" is a reserved name and can't be used`, 409);
    }
    if (await this.repository.slugExists(slug)) {
      throw new TenantError(ErrorCode.SLUG_TAKEN, `"${slug}" is already in use. Try another subdomain.`, 409);
    }
  }
}

export const tenantService = new TenantService(tenantRepository);
