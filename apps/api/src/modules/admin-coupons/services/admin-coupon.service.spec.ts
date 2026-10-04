import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { adminCouponRepository } from '../repositories/admin-coupon.repository';

import { AdminCouponService } from './admin-coupon.service';

vi.mock('../../admin-audit/repositories/admin-audit-log.repository', () => ({
  adminAuditLogRepository: { record: vi.fn() },
}));

const duplicate = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });

describe('AdminCouponService duplicate codes', () => {
  it('turns a unique-constraint failure on create into a 409 conflict', async () => {
    vi.spyOn(adminCouponRepository, 'create').mockRejectedValueOnce(duplicate());
    await expect(
      new AdminCouponService().create({ code: 'SAVE20' } as never, 'admin-1', 'SUPER_ADMIN'),
    ).rejects.toMatchObject({ httpStatus: 409, code: 'CONFLICT' });
  });

  it('lets other create errors through unchanged', async () => {
    vi.spyOn(adminCouponRepository, 'create').mockRejectedValueOnce(new Error('boom'));
    await expect(
      new AdminCouponService().create({ code: 'SAVE20' } as never, 'admin-1', 'SUPER_ADMIN'),
    ).rejects.toThrow('boom');
  });
});
