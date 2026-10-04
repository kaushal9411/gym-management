import { AppError, NotFoundError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { prisma } from '../../../infrastructure/database/prisma';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';
import { tenantService } from '../../tenants/service/tenant.service';
import {
  applyOverrideChanges,
  buildLimitRows,
  LIMIT_KEYS,
  parseOverrides,
  type LimitKey,
  type LimitValues,
} from '../utils/tenant-limits.util';
import {
  isModuleOverridden,
  isGuardedModule,
  moduleLabel,
  moduleToggleError,
} from '../utils/tenant-modules.util';

interface AdminActor {
  sub: string;
  role: string;
}

async function loadTenant(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, slug: true, deletedAt: true },
  });
  if (!tenant || tenant.deletedAt) throw new NotFoundError('Tenant not found');
  return tenant;
}

async function loadPlan(tenantId: string) {
  const sub = await prisma.subscription.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: { plan: { include: { features: true } } },
  });
  return sub?.plan ?? null;
}

const pickLimits = (o: LimitValues): LimitValues =>
  Object.fromEntries(LIMIT_KEYS.map((k) => [k, o[k]])) as LimitValues;

/**
 * Super-admin limit overrides + module toggles.
 *
 * Semantics (also in docs/BACKEND-GUIDE.md):
 *  • `TenantLimit.max*` columns ALWAYS hold the effective value — member/staff/branch capacity checks read them
 *    directly, so an override takes effect on the very next request. `TenantLimit.overrides` records forced keys.
 *  • Plan changes (admin change-plan AND tenant self-service checkout) re-sync limits from the new plan but re-apply
 *    overrides on top — overrides SURVIVE plan changes until cleared (`null`).
 *  • `TenantModule.enabled` feeds `ResolvedTenant.featureFlags` → `requireModuleEnabled`. A row is flagged
 *    `adminOverride` while it differs from the plan default; plan sync skips flagged rows.
 */
export class TenantControlsService {
  private async limitRows(tenantId: string) {
    const db = getTenantScopedClient(tenantId);
    const [row, plan] = await Promise.all([
      db.tenantLimit.findUnique({ where: { tenantId } }),
      loadPlan(tenantId),
    ]);
    const overrides = parseOverrides(row?.overrides);
    const planValues = plan ? pickLimits(plan as unknown as LimitValues) : null;
    const stored = row ? pickLimits(row as unknown as LimitValues) : null;
    return {
      row,
      overrides,
      planValues,
      stored,
      rows: buildLimitRows(planValues, overrides, stored),
    };
  }

  async getLimits(tenantId: string) {
    await loadTenant(tenantId);
    return (await this.limitRows(tenantId)).rows;
  }

  async putLimits(
    tenantId: string,
    changes: Partial<Record<LimitKey, number | null>>,
    admin: AdminActor,
  ) {
    const tenant = await loadTenant(tenantId);
    const { row, overrides, planValues, stored, rows: beforeRows } = await this.limitRows(tenantId);
    const { next, diff } = applyOverrideChanges(overrides, changes);
    if (diff.length === 0) return beforeRows;

    const afterRows = buildLimitRows(planValues, next, stored);
    const effective = Object.fromEntries(afterRows.map((r) => [r.key, r.effective])) as Record<
      LimitKey,
      number | null
    >;
    if (LIMIT_KEYS.some((k) => effective[k] === null)) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'This tenant has no plan or limits record yet, so only fully-specified limits can be set.',
        422,
      );
    }
    const data = { ...(effective as Record<LimitKey, number>), overrides: next };
    const db = getTenantScopedClient(tenantId);
    if (row) await db.tenantLimit.update({ where: { tenantId }, data });
    else await db.tenantLimit.create({ data: { tenantId, ...data } });

    await tenantService.invalidateCache(tenant.slug, tenantId);
    await adminAuditLogRepository.record({
      adminUserId: admin.sub,
      actorRole: admin.role,
      action: 'admin.tenant_limits_overridden',
      entityType: 'Tenant',
      entityId: tenantId,
      before: Object.fromEntries(
        diff.map((d) => [
          d.key,
          {
            override: d.before,
            effective: beforeRows.find((r) => r.key === d.key)?.effective ?? null,
          },
        ]),
      ),
      after: Object.fromEntries(
        diff.map((d) => [d.key, { override: d.after, effective: effective[d.key] }]),
      ),
    });
    return afterRows;
  }

  async getModules(tenantId: string) {
    await loadTenant(tenantId);
    const db = getTenantScopedClient(tenantId);
    const [plan, tenantModules, platformFlags] = await Promise.all([
      loadPlan(tenantId),
      db.tenantModule.findMany({ where: { tenantId } }),
      prisma.featureFlag.findMany({ select: { key: true, enabled: true } }),
    ]);
    const features = new Map((plan?.features ?? []).map((f) => [f.key, f]));
    const mods = new Map(tenantModules.map((m) => [m.key, m]));
    const platform = new Map(platformFlags.map((f) => [f.key, f.enabled]));
    const keys = [
      ...new Set([
        ...(plan?.features ?? []).sort((a, b) => a.sortOrder - b.sortOrder).map((f) => f.key),
        ...tenantModules.map((m) => m.key),
      ]),
    ];
    return keys.map((key) => {
      const feature = features.get(key);
      const mod = mods.get(key);
      return {
        key,
        label: moduleLabel(key, feature?.label),
        planDefault: feature?.included ?? false,
        enabled: mod?.enabled ?? false,
        overridden: mod?.adminOverride ?? false,
        platformEnabled: platform.get(key) ?? true,
        guarded: isGuardedModule(key),
      };
    });
  }

  async setModule(tenantId: string, key: string, enabled: boolean, admin: AdminActor) {
    const tenant = await loadTenant(tenantId);
    const rows = await this.getModules(tenantId);
    const current = rows.find((r) => r.key === key);
    if (!current) throw new NotFoundError(`Unknown module "${key}" for this tenant`);
    const refusal = moduleToggleError(key, enabled);
    if (refusal) throw new AppError(ErrorCode.VALIDATION_ERROR, refusal, 422);

    const adminOverride = isModuleOverridden(enabled, current.planDefault);
    const db = getTenantScopedClient(tenantId);
    await db.tenantModule.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: { tenantId, key, enabled, adminOverride },
      update: { enabled, adminOverride },
    });
    await tenantService.invalidateCache(tenant.slug, tenantId);
    await adminAuditLogRepository.record({
      adminUserId: admin.sub,
      actorRole: admin.role,
      action: 'admin.tenant_module_toggled',
      entityType: 'Tenant',
      entityId: tenantId,
      before: { key, enabled: current.enabled, overridden: current.overridden },
      after: { key, enabled, overridden: adminOverride },
    });
    return { ...current, enabled, overridden: adminOverride };
  }
}

export const tenantControlsService = new TenantControlsService();
