import { logger } from '../../../core/logging/logger';
import { tenantService } from '../service/tenant.service';

/**
 * The 11 platform-toggleable module keys (`FeatureFlag` seed). Plan-only keys (`members`, `staff`, ...) are NOT switches and
 * are deliberately not listed — nothing outside the HTTP gate should key off them.
 */
export type FlagModuleKey =
  | 'ai_coach'
  | 'notifications'
  | 'support_tickets'
  | 'expenses'
  | 'income'
  | 'payments'
  | 'reports'
  | 'attendance'
  | 'diet_plans'
  | 'live_classes'
  | 'workout_plans';

/**
 * One tenant's enabled-module view. `resolved: false` means the flags could not be read (resolve threw, or the tenant row
 * is gone) — in that case `has()` answers `true` for every key (see FAIL OPEN below).
 */
export interface TenantModules {
  readonly resolved: boolean;
  has(key: string): boolean;
}

/**
 * Background jobs / assistant code that has no `req.tenant` reads the tenant's flags through here. The source of truth is
 * `tenantService.resolveById(tenantId).featureFlags` — the SAME array `requireModuleEnabled` checks on the HTTP side
 * (plan-granted `TenantModule` AND platform `FeatureFlag.enabled`, tenant record cached 5 min, platform flags 30 s).
 *
 * FAIL OPEN: if the read fails (Redis/DB blip) or the tenant cannot be found, the module is treated as ENABLED and a
 * warning is logged. A flag-read hiccup must never silently stop billing/reminder jobs for every gym; the worst case of
 * failing open is one extra sweep for a gym that switched a module off, which the next sweep corrects.
 */
export async function getEnabledModules(tenantId: string): Promise<TenantModules> {
  try {
    const tenant = await tenantService.resolveById(tenantId);
    if (!tenant) {
      logger.warn('Module flags unavailable (tenant not found) - treating every module as enabled', { tenantId });
      return { resolved: false, has: () => true };
    }
    const enabled = new Set(tenant.featureFlags);
    return { resolved: true, has: (key) => enabled.has(key) };
  } catch (error) {
    logger.warn('Module flags unavailable (resolve failed) - treating every module as enabled', { tenantId, error: error instanceof Error ? error.message : String(error) });
    return { resolved: false, has: () => true };
  }
}

/** Single-key convenience over `getEnabledModules` (fails open, see above). */
export async function isModuleEnabled(tenantId: string, key: FlagModuleKey): Promise<boolean> {
  return (await getEnabledModules(tenantId)).has(key);
}

/**
 * Per-run gate for a sweep that touches many rows of many tenants: the answer is memoised per tenant for the lifetime of
 * the returned function (one resolve per tenant per sweep, never one per row), and a disabled tenant is logged once at
 * debug level. The skip is strictly per tenant — other tenants in the same sweep are unaffected.
 *
 *   const enabled = moduleGate('payments', 'invoice-generation');
 *   for (const row of rows) { if (!(await enabled(row.tenantId))) continue; ... }
 */
export function moduleGate(key: FlagModuleKey, job: string): (tenantId: string) => Promise<boolean> {
  const memo = new Map<string, Promise<boolean>>();
  return (tenantId) => {
    let answer = memo.get(tenantId);
    if (!answer) {
      answer = isModuleEnabled(tenantId, key).then((enabled) => {
        if (!enabled) logger.debug('Skipping tenant: module disabled', { job, tenantId, module: key });
        return enabled;
      });
      memo.set(tenantId, answer);
    }
    return answer;
  };
}
