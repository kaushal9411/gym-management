import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  extendTrial: vi.fn(),
  setMaintenance: vi.fn(),
  setStatus: vi.fn(),
  forceLogout: vi.fn(),
  changePlan: vi.fn(),
  findBare: vi.fn(),
  record: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock('./admin-tenant.service', () => ({
  adminTenantService: {
    extendTrial: m.extendTrial,
    setMaintenance: m.setMaintenance,
    setStatus: m.setStatus,
    forceLogout: m.forceLogout,
  },
}));
vi.mock('./admin-tenant-billing.service', () => ({
  AdminTenantBillingService: class {
    changePlan = m.changePlan;
  },
}));
vi.mock('../repositories/admin-tenant.repository', () => ({
  adminTenantRepository: { findBare: m.findBare },
}));
vi.mock('../../admin-audit/repositories/admin-audit-log.repository', () => ({
  adminAuditLogRepository: { record: m.record },
}));
vi.mock('../../../infrastructure/database/prisma', () => ({
  prisma: { subscription: { findFirst: m.findFirst } },
}));

import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';

import { TenantBulkService } from './tenant-bulk.service';

const actor = {
  sub: 'admin1',
  role: 'SUPER_ADMIN',
  permissions: ['tenants:manage', 'payments:manage'],
};
const svc = new TenantBulkService();

beforeEach(() => vi.clearAllMocks());

describe('TenantBulkService', () => {
  it('extend-trial reports per-tenant failures, continues, writes one summary audit row', async () => {
    m.extendTrial
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(
        new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Only tenants on a free trial can be extended',
          422,
        ),
      )
      .mockRejectedValueOnce(new Error('db exploded'));
    const out = await svc.run(
      { action: 'extend-trial', tenantIds: ['a', 'b', 'c'], params: { days: 7 } },
      actor,
    );
    expect(out.succeeded).toBe(1);
    expect(out.failed).toBe(2);
    expect(out.results[1]).toEqual({
      tenantId: 'b',
      ok: false,
      error: 'Only tenants on a free trial can be extended',
    });
    expect(out.results[2]!.error).toBe('Unexpected error — action not applied.');
    expect(m.record).toHaveBeenCalledTimes(1);
    expect(m.record.mock.calls[0]![0]).toMatchObject({
      action: 'admin.tenant_bulk_action',
      adminUserId: 'admin1',
    });
  });

  it('suspend rejects already-suspended; reactivate only SUSPENDED', async () => {
    m.findBare
      .mockResolvedValueOnce({ status: 'SUSPENDED', deletedAt: null })
      .mockResolvedValueOnce({ status: 'ACTIVE', deletedAt: null });
    const s = await svc.run({ action: 'suspend', tenantIds: ['a', 'b'], params: {} }, actor);
    expect(s.results.map((r) => r.ok)).toEqual([false, true]);
    expect(m.setStatus).toHaveBeenCalledTimes(1);

    m.findBare.mockResolvedValueOnce({ status: 'ACTIVE', deletedAt: null });
    const r = await svc.run({ action: 'reactivate', tenantIds: ['c'], params: {} }, actor);
    expect(r.results[0]!.error).toMatch(/Only suspended/);
  });

  it('change-plan needs payments:manage (403 for the whole request, nothing run)', async () => {
    await expect(
      svc.run(
        { action: 'change-plan', tenantIds: ['a'], params: { planId: 'p' } },
        { ...actor, permissions: ['tenants:manage'] },
      ),
    ).rejects.toThrow(/payments:manage/);
    expect(m.changePlan).not.toHaveBeenCalled();
    expect(m.record).not.toHaveBeenCalled();
  });

  it('change-plan defaults to payment_link, skips tenants already on the plan', async () => {
    m.findFirst
      .mockResolvedValueOnce({ planId: 'p', status: 'ACTIVE' })
      .mockResolvedValueOnce({ planId: 'old', status: 'ACTIVE' });
    const out = await svc.run(
      { action: 'change-plan', tenantIds: ['a', 'b'], params: { planId: 'p' } },
      actor,
    );
    expect(out.results[0]!.error).toMatch(/already on this plan/);
    expect(m.changePlan).toHaveBeenCalledTimes(1);
    expect(m.changePlan.mock.calls[0]![1]).toBe('payment_link');
  });
});
