import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Platform feature-flag resolve matrix (Prompt 80 kill switch).
 *
 * `ResolvedTenant.featureFlags` = tenant plan modules (`TenantModule.enabled`)
 * AND platform `FeatureFlag.enabled` (a key with NO FeatureFlag row defaults to
 * enabled). Exercised through the real `TenantService#resolveBySlug` /
 * `resolveById` with an in-memory TTL cache standing in for Redis and a mocked
 * prisma, so the 30 s `platform:feature-flags:enabled` window is testable with
 * fake timers.
 */

const state = vi.hoisted(() => ({
  store: new Map<string, { value: string; expiresAt: number }>(),
  setCalls: [] as Array<{ key: string; ttl: number | undefined }>,
  flagRows: [] as Array<{ key: string; enabled: boolean }>,
  flagFindMany: 0,
  audit: [] as Array<Record<string, unknown>>,
}));

vi.mock('../../infrastructure/cache/redis', () => ({
  cache: {
    get: async (key: string) => {
      const hit = state.store.get(key);
      if (!hit || hit.expiresAt <= Date.now()) {
        state.store.delete(key);
        return null;
      }
      return JSON.parse(hit.value);
    },
    set: async (key: string, value: unknown, ttl?: number) => {
      state.setCalls.push({ key, ttl });
      state.store.set(key, { value: JSON.stringify(value), expiresAt: Date.now() + (ttl ?? 300) * 1000 });
    },
    del: async (key: string) => {
      state.store.delete(key);
    },
    delByPrefix: async () => undefined,
  },
}));
vi.mock('../../infrastructure/database/prisma', () => ({
  prisma: {
    featureFlag: {
      findMany: async () => {
        state.flagFindMany += 1;
        return state.flagRows.map((r) => ({ ...r }));
      },
      findUnique: async ({ where }: { where: { key: string } }) => state.flagRows.find((r) => r.key === where.key) ?? null,
      update: async ({ where, data }: { where: { key: string }; data: { enabled: boolean } }) => {
        const row = state.flagRows.find((r) => r.key === where.key)!;
        row.enabled = data.enabled;
        return { ...row };
      },
    },
  },
}));
vi.mock('../admin-settings/services/platform-maintenance.service', () => ({
  getPlatformMaintenance: async () => ({ enabled: false, message: null }),
}));
vi.mock('../admin-audit/repositories/admin-audit-log.repository', () => ({
  adminAuditLogRepository: {
    record: async (input: Record<string, unknown>) => {
      state.audit.push(input);
    },
  },
}));
vi.mock('./repository/tenant.repository', () => ({ tenantRepository: {} }));

import { AdminFeatureFlagService } from '../admin-feature-flags/services/admin-feature-flag.service';

import type { ResolvedTenantRecord, TenantRepositoryPort } from './interfaces/tenant.interface';
import { invalidatePlatformFeatureFlagsCache, TenantService } from './service/tenant.service';

/** The 12 platform kill-switch keys seeded in prisma/seed.ts FEATURE_FLAGS. */
const PLATFORM_FLAG_KEYS = [
  'ai_coach',
  'notifications',
  'support_tickets',
  'expenses',
  'income',
  'payments',
  'reports',
  'attendance',
  'diet_plans',
  'live_classes',
  'workout_plans',
  'hr',
] as const;

/** Modules with NO FeatureFlag row — foundational, never a kill switch. */
const NON_SWITCH_KEYS = ['members', 'staff', 'branches', 'membership_plans', 'dashboard', 'analytics', 'chat'] as const;

const PLATFORM_KEY = 'platform:feature-flags:enabled';

function makeRecord(modules: Array<{ key: string; enabled: boolean }>): ResolvedTenantRecord {
  return {
    id: 'tenant-1',
    slug: 'gym-one',
    name: 'Gym One',
    status: 'ACTIVE',
    trialEndsAt: null,
    subscriptionExpiresAt: null,
    maintenanceMode: false,
    settings: null,
    branding: null,
    subscriptions: [],
    modules,
    branches: [],
  } as unknown as ResolvedTenantRecord;
}

function makeService(modules: Array<{ key: string; enabled: boolean }>): TenantService {
  const record = makeRecord(modules);
  const repo = {
    findBySlug: async () => structuredClone(record),
    findById: async () => structuredClone(record),
  } as unknown as TenantRepositoryPort;
  return new TenantService(repo);
}

const allPlanModules = () => [...PLATFORM_FLAG_KEYS, ...NON_SWITCH_KEYS].map((key) => ({ key, enabled: true }));

async function flagsFor(service: TenantService): Promise<string[]> {
  const resolved = await service.resolveBySlug('gym-one');
  return resolved!.tenant.featureFlags;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-22T10:00:00Z'));
  state.store.clear();
  state.setCalls.length = 0;
  state.flagFindMany = 0;
  state.audit.length = 0;
  state.flagRows = PLATFORM_FLAG_KEYS.map((key) => ({ key, enabled: true }));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('toResolvedTenant — per-flag matrix (plan x platform)', () => {
  describe.each(PLATFORM_FLAG_KEYS)('%s', (key) => {
    it('plan-enabled + platform-enabled -> present', async () => {
      const service = makeService(allPlanModules());
      expect(await flagsFor(service)).toContain(key);
    });

    it('plan-enabled + platform-DISABLED -> absent (and every OTHER flag is untouched)', async () => {
      state.flagRows = state.flagRows.map((r) => (r.key === key ? { ...r, enabled: false } : r));
      const flags = await flagsFor(makeService(allPlanModules()));
      expect(flags).not.toContain(key);
      for (const other of [...PLATFORM_FLAG_KEYS, ...NON_SWITCH_KEYS].filter((k) => k !== key)) {
        expect(flags).toContain(other);
      }
    });

    it('plan-DISABLED + platform-enabled -> absent', async () => {
      const modules = allPlanModules().map((m) => (m.key === key ? { ...m, enabled: false } : m));
      expect(await flagsFor(makeService(modules))).not.toContain(key);
    });

    it('plan-DISABLED + platform-disabled -> absent', async () => {
      state.flagRows = state.flagRows.map((r) => (r.key === key ? { ...r, enabled: false } : r));
      const modules = allPlanModules().map((m) => (m.key === key ? { ...m, enabled: false } : m));
      expect(await flagsFor(makeService(modules))).not.toContain(key);
    });

    it('plan has no row for the key at all -> absent even when platform-enabled (a platform flag never GRANTS a module)', async () => {
      const modules = allPlanModules().filter((m) => m.key !== key);
      expect(await flagsFor(makeService(modules))).not.toContain(key);
    });

    it('no FeatureFlag row for the key -> defaults to platform-enabled (present)', async () => {
      state.flagRows = state.flagRows.filter((r) => r.key !== key);
      expect(await flagsFor(makeService(allPlanModules()))).toContain(key);
    });

    it('resolveById applies the same kill switch (used by background jobs / member portal / mail branding)', async () => {
      state.flagRows = state.flagRows.map((r) => (r.key === key ? { ...r, enabled: false } : r));
      const resolved = await makeService(allPlanModules()).resolveById('tenant-1');
      expect(resolved!.featureFlags).not.toContain(key);
    });
  });

  it.each(NON_SWITCH_KEYS)('%s has no kill switch: stays present even if a platform row for another key is disabled', async (key) => {
    state.flagRows = state.flagRows.map((r) => ({ ...r, enabled: false }));
    expect(await flagsFor(makeService(allPlanModules()))).toContain(key);
  });

  it('disabling ALL 12 platform flags leaves only the non-switch modules', async () => {
    state.flagRows = state.flagRows.map((r) => ({ ...r, enabled: false }));
    const flags = await flagsFor(makeService(allPlanModules()));
    expect([...flags].sort()).toEqual([...NON_SWITCH_KEYS].sort());
  });

  it('an unknown platform row (not tied to any module) never leaks a module into the list', async () => {
    state.flagRows.push({ key: 'marketplace', enabled: true });
    expect(await flagsFor(makeService(allPlanModules()))).not.toContain('marketplace');
  });
});

describe('platform flag cache — `platform:feature-flags:enabled`, 30 s TTL', () => {
  it('is written with the documented key and a 30 s TTL (separate from the 5 min tenant record)', async () => {
    await flagsFor(makeService(allPlanModules()));
    const platform = state.setCalls.filter((c) => c.key === PLATFORM_KEY);
    expect(platform).toEqual([{ key: PLATFORM_KEY, ttl: 30 }]);
    const tenantRecord = state.setCalls.find((c) => c.key === 'tenant:slug:gym-one');
    expect(tenantRecord?.ttl).toBe(300);
  });

  it('is read once per window — repeated resolves do not hit the DB again', async () => {
    const service = makeService(allPlanModules());
    await flagsFor(service);
    await flagsFor(service);
    await flagsFor(service);
    expect(state.flagFindMany).toBe(1);
  });

  it('WITHOUT invalidation a toggle is stale inside the 30 s window, then visible after it (documented worst case)', async () => {
    const service = makeService(allPlanModules());
    expect(await flagsFor(service)).toContain('attendance');

    state.flagRows = state.flagRows.map((r) => (r.key === 'attendance' ? { ...r, enabled: false } : r)); // e.g. a direct DB edit / another process
    vi.advanceTimersByTime(29_000);
    expect(await flagsFor(service)).toContain('attendance'); // still cached
    vi.advanceTimersByTime(2_000);
    expect(await flagsFor(service)).not.toContain('attendance'); // window lapsed
  });

  it('invalidatePlatformFeatureFlagsCache makes a toggle visible immediately (no 30 s wait)', async () => {
    const service = makeService(allPlanModules());
    expect(await flagsFor(service)).toContain('reports');
    state.flagRows = state.flagRows.map((r) => (r.key === 'reports' ? { ...r, enabled: false } : r));
    await invalidatePlatformFeatureFlagsCache();
    expect(await flagsFor(service)).not.toContain('reports');
  });

  it('the per-tenant 5 min record cache does NOT freeze the platform flag (applied after caching)', async () => {
    const service = makeService(allPlanModules());
    await flagsFor(service); // tenant record now cached for 5 min
    state.flagRows = state.flagRows.map((r) => (r.key === 'payments' ? { ...r, enabled: false } : r));
    await invalidatePlatformFeatureFlagsCache();
    vi.advanceTimersByTime(60_000); // far inside the 5 min tenant TTL
    expect(await flagsFor(service)).not.toContain('payments');
  });

  it('AdminFeatureFlagService#setEnabled persists, invalidates the cache and audits — end to end disable then re-enable', async () => {
    const service = makeService(allPlanModules());
    const admin = new AdminFeatureFlagService();

    expect(await flagsFor(service)).toContain('diet_plans'); // primes the 30 s cache

    await admin.setEnabled('diet_plans', false, 'admin-1', 'SUPER_ADMIN');
    expect(await flagsFor(service)).not.toContain('diet_plans'); // immediately, inside the old window

    await admin.setEnabled('diet_plans', true, 'admin-1', 'SUPER_ADMIN');
    expect(await flagsFor(service)).toContain('diet_plans');

    expect(state.audit.map((a) => a.action)).toEqual(['admin.feature_flag_disabled', 'admin.feature_flag_enabled']);
    expect(state.audit.every((a) => a.entityType === 'FeatureFlag' && a.entityId === 'diet_plans')).toBe(true);
  });

  it('AdminFeatureFlagService#setEnabled 404s for an unknown key and does not touch the cache or audit log', async () => {
    const admin = new AdminFeatureFlagService();
    await expect(admin.setEnabled('chat', false, 'admin-1', 'SUPER_ADMIN')).rejects.toMatchObject({ httpStatus: 404 });
    expect(state.audit).toHaveLength(0);
  });
});
