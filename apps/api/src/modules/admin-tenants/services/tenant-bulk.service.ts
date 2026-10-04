import { AppError, ForbiddenError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { prisma } from '../../../infrastructure/database/prisma';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';
import { adminTenantRepository } from '../repositories/admin-tenant.repository';
import { runBulk } from '../utils/tenant-list.util';
import type { BulkAction } from '../validators/tenant-list.validators';

import { AdminTenantBillingService } from './admin-tenant-billing.service';
import { adminTenantService } from './admin-tenant.service';

export interface BulkParams {
  days?: number;
  reason?: string;
  planId?: string;
  mode?: 'manual' | 'payment_link';
  enabled?: boolean;
  paymentMode?: 'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CHEQUE' | 'CARD' | 'OTHER';
  paymentDate?: string;
  notes?: string;
}

export interface BulkActor {
  sub: string;
  role: string;
  permissions: string[];
}

const fail = (message: string, status = 422) =>
  new AppError(ErrorCode.VALIDATION_ERROR, message, status);

/** Safe per-tenant error text: AppErrors carry user-facing messages; anything else is generic (never leak internals). */
export const describeError = (err: unknown): string =>
  err instanceof AppError ? err.message : 'Unexpected error — action not applied.';

/** Per-tenant state guards that the single-tenant endpoints don't enforce but a bulk run should (no silent no-ops). */
async function assertState(tenantId: string, action: BulkAction): Promise<void> {
  if (action === 'suspend' || action === 'reactivate') {
    const t = await adminTenantRepository.findBare(tenantId);
    if (!t || t.deletedAt) throw new AppError(ErrorCode.NOT_FOUND, 'Tenant not found', 404);
    if (action === 'suspend' && t.status === 'SUSPENDED')
      throw fail('Tenant is already suspended.');
    if (action === 'reactivate' && t.status !== 'SUSPENDED')
      throw fail(`Only suspended tenants can be reactivated — this tenant is ${t.status}.`);
  }
}

export class TenantBulkService {
  async run(
    input: { action: BulkAction; tenantIds: string[]; params: BulkParams },
    actor: BulkActor,
  ) {
    const { action, params } = input;
    if (action === 'change-plan' && !actor.permissions.includes('payments:manage'))
      throw new ForbiddenError('Missing required permission: payments:manage');

    const perTenant = async (tenantId: string): Promise<void> => {
      await assertState(tenantId, action);
      switch (action) {
        case 'extend-trial':
          await adminTenantService.extendTrial(
            tenantId,
            { days: params.days!, reason: params.reason },
            actor.sub,
            actor.role,
          );
          return;
        case 'maintenance':
          await adminTenantService.setMaintenance(
            tenantId,
            { enabled: params.enabled!, reason: params.reason },
            actor.sub,
            actor.role,
          );
          return;
        case 'suspend':
          await adminTenantService.setStatus(tenantId, 'SUSPENDED', actor.sub, actor.role);
          return;
        case 'reactivate':
          await adminTenantService.setStatus(tenantId, 'ACTIVE', actor.sub, actor.role);
          return;
        case 'force-logout':
          await adminTenantService.forceLogout(tenantId, actor.sub, actor.role);
          return;
        case 'change-plan': {
          const current = await prisma.subscription.findFirst({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            select: { planId: true, status: true },
          });
          if (current?.planId === params.planId && current?.status === 'ACTIVE')
            throw fail('Tenant is already on this plan.');
          const mode = params.mode ?? 'payment_link';
          const manual =
            mode === 'manual'
              ? {
                  paymentMode: params.paymentMode ?? ('OTHER' as const),
                  paymentDate: params.paymentDate ?? new Date().toISOString().slice(0, 10),
                  notes: params.notes ?? 'Bulk plan change by admin',
                }
              : undefined;
          await new AdminTenantBillingService(tenantId).changePlan(
            params.planId!,
            mode,
            actor.sub,
            actor.role,
            manual,
          );
          return;
        }
      }
    };

    const outcome = await runBulk(input.tenantIds, perTenant, describeError);

    await adminAuditLogRepository.record({
      adminUserId: actor.sub,
      actorRole: actor.role,
      action: 'admin.tenant_bulk_action',
      entityType: 'Tenant',
      after: {
        action,
        params: {
          days: params.days ?? null,
          planId: params.planId ?? null,
          mode: params.mode ?? null,
          enabled: params.enabled ?? null,
          reason: params.reason ?? null,
        },
        tenantIds: outcome.results.map((r) => r.tenantId),
        succeeded: outcome.succeeded,
        failed: outcome.failed,
      },
    });
    return outcome;
  }
}

export const tenantBulkService = new TenantBulkService();
