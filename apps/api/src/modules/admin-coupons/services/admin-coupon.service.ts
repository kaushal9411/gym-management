import { Prisma } from '@prisma/client';

import { AppError, ValidationError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';
import {
  adminCouponRepository,
  type UpsertCouponInput,
} from '../repositories/admin-coupon.repository';
import { couponShapeIssues } from '../utils/coupon-rules.util';

function duplicateCodeError(code: string | undefined): AppError {
  return new AppError(ErrorCode.CONFLICT, `A coupon with code "${code ?? ''}" already exists.`, 409);
}

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
    let coupon;
    try {
      coupon = await adminCouponRepository.create(input);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw duplicateCodeError(input.code);
      throw error;
    }
    await adminAuditLogRepository.record({
      adminUserId,
      actorRole: adminRole,
      action: 'admin.coupon_created',
      entityType: 'Coupon',
      entityId: coupon.id,
      after: input,
    });
    return coupon;
  }

  async update(
    id: string,
    input: Partial<UpsertCouponInput>,
    adminUserId: string,
    adminRole: string,
  ) {
    const existing = await this.getById(id);
    // Cross-field rules on the MERGED state (a partial PUT may omit fields already stored).
    const merged = {
      type: input.type ?? existing.type,
      percentOff:
        input.percentOff ?? (existing.percentOff === null ? null : Number(existing.percentOff)),
      amountOff:
        input.amountOff ?? (existing.amountOff === null ? null : Number(existing.amountOff)),
      currency: input.currency ?? existing.currency,
      trialExtensionDays: input.trialExtensionDays ?? existing.trialExtensionDays,
    };
    const issues = couponShapeIssues(merged);
    if (issues.length) throw new ValidationError(issues[0]!.message, { issues });
    let coupon;
    try {
      coupon = await adminCouponRepository.update(id, input);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw duplicateCodeError(input.code);
      throw error;
    }
    await adminAuditLogRepository.record({
      adminUserId,
      actorRole: adminRole,
      action: 'admin.coupon_updated',
      entityType: 'Coupon',
      entityId: id,
      after: input,
    });
    return coupon;
  }

  async remove(id: string, adminUserId: string, adminRole: string): Promise<void> {
    const existing = await this.getById(id);
    const redemptions = await adminCouponRepository.countRedemptions(id);
    await adminCouponRepository.remove(id);
    await adminAuditLogRepository.record({
      adminUserId,
      actorRole: adminRole,
      action: 'admin.coupon_deleted',
      entityType: 'Coupon',
      entityId: id,
      after: { code: existing.code, redemptions },
    });
  }
}

export const adminCouponService = new AdminCouponService();
