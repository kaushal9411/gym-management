import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';
import { adminCouponRepository, type UpsertCouponInput } from '../repositories/admin-coupon.repository';

export class AdminCouponService {
  async list() {
    return adminCouponRepository.list();
  }

  /** Doubles as the "Usage Report" — redemption history + total count is on the same record. */
  async getById(id: string) {
    const coupon = await adminCouponRepository.findById(id);
    if (!coupon) throw new AppError(ErrorCode.NOT_FOUND, 'Coupon not found', 404);
    return coupon;
  }

  async create(input: UpsertCouponInput, adminUserId: string, adminRole: string) {
    const coupon = await adminCouponRepository.create(input);
    await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: 'admin.coupon_created', entityType: 'Coupon', entityId: coupon.id, after: input });
    return coupon;
  }

  async update(id: string, input: Partial<UpsertCouponInput>, adminUserId: string, adminRole: string) {
    await this.getById(id);
    const coupon = await adminCouponRepository.update(id, input);
    await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: 'admin.coupon_updated', entityType: 'Coupon', entityId: id, after: input });
    return coupon;
  }

  async remove(id: string, adminUserId: string, adminRole: string): Promise<void> {
    await this.getById(id);
    await adminCouponRepository.remove(id);
    await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: 'admin.coupon_deleted', entityType: 'Coupon', entityId: id });
  }
}

export const adminCouponService = new AdminCouponService();
