import { Prisma, type Coupon } from '@prisma/client';

import { AppError, ValidationError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { prisma } from '../../../infrastructure/database/prisma';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';
import { adminCouponRepository } from '../repositories/admin-coupon.repository';
import { couponShapeIssues, generateUniqueCodes } from '../utils/coupon-rules.util';
import {
  buildComputed,
  dailySeries,
  deriveCouponStatus,
  remainingRedemptions,
  type CouponComputed,
  type CouponStatus,
} from '../utils/coupon-status.util';

const DAY_MS = 86_400_000;
const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

interface CouponFacts {
  redemptions: Map<string, { count: number; last: Date | null }>;
  discount: Map<string, number>;
}

/** Two grouped queries (redemption rows, PAID invoice discounts) for the given coupons — no N+1. */
async function loadFacts(couponIds?: string[]): Promise<CouponFacts> {
  const scope = couponIds ? { in: couponIds } : undefined;
  const [red, disc] = await Promise.all([
    prisma.couponRedemption.groupBy({
      by: ['couponId'],
      where: scope ? { couponId: scope } : undefined,
      _count: { _all: true },
      _max: { redeemedAt: true },
    }),
    prisma.invoice.groupBy({
      by: ['couponId'],
      where: { couponId: scope ?? { not: null }, status: 'PAID' },
      _sum: { discountAmount: true },
    }),
  ]);
  return {
    redemptions: new Map(
      red.map((r) => [r.couponId, { count: r._count._all, last: r._max.redeemedAt }]),
    ),
    discount: new Map(
      disc.filter((d) => d.couponId).map((d) => [d.couponId!, num(d._sum.discountAmount)]),
    ),
  };
}

function computedFor(coupon: Coupon, facts: CouponFacts, now: Date): CouponComputed {
  const r = facts.redemptions.get(coupon.id);
  return buildComputed(
    coupon,
    {
      redemptions: r?.count ?? 0,
      discountGiven: facts.discount.get(coupon.id) ?? 0,
      lastRedeemedAt: r?.last ?? null,
    },
    now,
  );
}

export class CouponInsightsService {
  /** `GET /admin/coupons` — existing array (+ `_count`) with filters and `computed` on each coupon. */
  async list(
    query: { search?: string; status?: Exclude<CouponStatus, 'scheduled'>; type?: Coupon['type'] },
    now = new Date(),
  ) {
    const search = query.search?.trim();
    const coupons = await prisma.coupon.findMany({
      where: {
        ...(query.type ? { type: query.type } : {}),
        ...(search ? { code: { contains: search, mode: 'insensitive' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { redemptions: true } } },
    });
    const facts = await loadFacts(coupons.map((c) => c.id));
    const items = coupons.map((c) => ({ ...c, computed: computedFor(c, facts, now) }));
    return query.status ? items.filter((c) => c.computed.status === query.status) : items;
  }

  async overview(now = new Date()) {
    const since60 = new Date(now.getTime() - 60 * DAY_MS);
    const since30 = new Date(now.getTime() - 30 * DAY_MS);
    const in14 = new Date(now.getTime() + 14 * DAY_MS);
    const [coupons, recent, discAll, disc30, byTypeRed, topRed] = await Promise.all([
      prisma.coupon.findMany(),
      prisma.couponRedemption.findMany({
        where: { redeemedAt: { gte: since60 } },
        select: { redeemedAt: true },
      }),
      prisma.invoice.aggregate({
        where: { couponId: { not: null }, status: 'PAID' },
        _sum: { discountAmount: true },
      }),
      prisma.invoice.aggregate({
        where: { couponId: { not: null }, status: 'PAID', paidAt: { gte: since30 } },
        _sum: { discountAmount: true },
      }),
      prisma.couponRedemption.groupBy({ by: ['couponId'], _count: { _all: true } }),
      prisma.couponRedemption.groupBy({
        by: ['couponId'],
        _count: { _all: true },
        orderBy: { _count: { couponId: 'desc' } },
        take: 5,
      }),
    ]);

    const statusCount: Record<string, number> = {
      active: 0,
      expired: 0,
      disabled: 0,
      exhausted: 0,
      scheduled: 0,
    };
    for (const c of coupons) statusCount[deriveCouponStatus(c, now)]! += 1;

    const redemptionsDaily = dailySeries(
      recent.map((r) => r.redeemedAt),
      now,
    );
    const redemptions30d = redemptionsDaily.reduce((s, d) => s + d.count, 0);
    const redemptionsPrev30d = redemptionsDaily.reduce((s, d) => s + d.previousCount, 0);

    const redByCoupon = new Map(byTypeRed.map((r) => [r.couponId, r._count._all]));
    const typeMap = new Map<string, { coupons: number; redemptions: number }>();
    for (const type of ['PERCENTAGE', 'FIXED_AMOUNT', 'TRIAL_EXTENSION'])
      typeMap.set(type, { coupons: 0, redemptions: 0 });
    for (const c of coupons) {
      const e = typeMap.get(c.type)!;
      e.coupons += 1;
      e.redemptions += redByCoupon.get(c.id) ?? 0;
    }

    const topIds = topRed.map((t) => t.couponId);
    const topFacts = topIds.length
      ? await loadFacts(topIds)
      : { redemptions: new Map(), discount: new Map<string, number>() };
    const codeById = new Map(coupons.map((c) => [c.id, c.code]));

    const expiringSoon = coupons
      .filter((c) => c.isActive && c.expiresAt && c.expiresAt >= now && c.expiresAt <= in14)
      .sort((a, b) => a.expiresAt!.getTime() - b.expiresAt!.getTime())
      .slice(0, 8)
      .map((c) => ({
        couponId: c.id,
        code: c.code,
        expiresAt: c.expiresAt,
        remaining: remainingRedemptions(c.maxRedemptions, c.timesRedeemed),
      }));

    return {
      kpis: {
        total: coupons.length,
        active: statusCount.active!,
        expired: statusCount.expired!,
        disabled: statusCount.disabled!,
        exhausted: statusCount.exhausted!,
        redemptions30d,
        redemptionsPrev30d,
        discountGiven30d: num(disc30._sum.discountAmount).toFixed(2),
        discountGivenAllTime: num(discAll._sum.discountAmount).toFixed(2),
      },
      redemptionsDaily,
      byType: [...typeMap.entries()].map(([type, v]) => ({ type, ...v })),
      topCoupons: topRed.map((t) => ({
        couponId: t.couponId,
        code: codeById.get(t.couponId) ?? '',
        redemptions: t._count._all,
        discountGiven: (topFacts.discount.get(t.couponId) ?? 0).toFixed(2),
      })),
      expiringSoon,
    };
  }

  /** `GET /admin/coupons/:id` — existing coupon + last 50 redemptions, extended with usage insights. */
  async detail(id: string, now = new Date()) {
    const coupon = await adminCouponRepository.findById(id);
    if (!coupon) throw new AppError(ErrorCode.NOT_FOUND, 'Coupon not found', 404);
    const since60 = new Date(now.getTime() - 60 * DAY_MS);
    const [facts, recent, tenantGroups, invoices] = await Promise.all([
      loadFacts([id]),
      prisma.couponRedemption.findMany({
        where: { couponId: id, redeemedAt: { gte: since60 } },
        select: { redeemedAt: true },
      }),
      prisma.couponRedemption.groupBy({
        by: ['tenantId'],
        where: { couponId: id },
        _count: { _all: true },
        orderBy: { _count: { tenantId: 'desc' } },
        take: 5,
      }),
      prisma.invoice.findMany({
        where: { couponId: id, status: 'PAID' },
        orderBy: { paidAt: 'desc' },
        take: 10,
        include: { tenant: { select: { id: true, name: true, slug: true } } },
      }),
    ]);
    const tenants = tenantGroups.length
      ? await prisma.tenant.findMany({
          where: { id: { in: tenantGroups.map((t) => t.tenantId) } },
          select: { id: true, name: true, slug: true },
        })
      : [];
    const tenantById = new Map(tenants.map((t) => [t.id, t]));
    return {
      ...coupon,
      computed: computedFor(coupon, facts, now),
      redemptionsDaily: dailySeries(
        recent.map((r) => r.redeemedAt),
        now,
      ).map(({ date, count }) => ({ date, count })),
      topTenants: tenantGroups.map((g) => ({
        tenantId: g.tenantId,
        name: tenantById.get(g.tenantId)?.name ?? '',
        slug: tenantById.get(g.tenantId)?.slug ?? '',
        redemptions: g._count._all,
      })),
      invoices: invoices.map((i) => ({
        id: i.id,
        number: i.invoiceNumber,
        tenant: i.tenant,
        discountAmount: num(i.discountAmount).toFixed(2),
        total: num(i.total).toFixed(2),
        paidAt: i.paidAt,
      })),
    };
  }

  async setActive(id: string, isActive: boolean, adminUserId: string, adminRole: string) {
    const existing = await prisma.coupon.findUnique({ where: { id }, select: { code: true } });
    if (!existing) throw new AppError(ErrorCode.NOT_FOUND, 'Coupon not found', 404);
    const coupon = await prisma.coupon.update({ where: { id }, data: { isActive } });
    await adminAuditLogRepository.record({
      adminUserId,
      actorRole: adminRole,
      action: isActive ? 'admin.coupon_enabled' : 'admin.coupon_disabled',
      entityType: 'Coupon',
      entityId: id,
      after: { code: existing.code, isActive },
    });
    return coupon;
  }

  async bulkGenerate(
    input: {
      prefix: string;
      count: number;
      length: number;
      type: Coupon['type'];
      scope: Coupon['scope'];
      percentOff?: number;
      amountOff?: number;
      currency?: string;
      trialExtensionDays?: number;
      maxRedemptions?: number;
      maxRedemptionsPerTenant: number;
      expiresAt?: Date;
    },
    adminUserId: string,
    adminRole: string,
  ) {
    const issues = couponShapeIssues(input);
    if (issues.length) throw new ValidationError(issues[0]!.message);
    const { prefix, count, length, ...fields } = input;
    if (32 ** length < count * 4)
      throw new ValidationError(
        'Suffix length is too short for that many unique codes; increase length.',
      );

    let codes: string[] | null = null;
    for (let attempt = 0; attempt < 3 && !codes; attempt += 1) {
      const candidate = generateUniqueCodes(prefix, count, length);
      if (!candidate) break;
      // eslint-disable-next-line no-await-in-loop -- bounded (3) collision-retry loop
      const clashes = await prisma.coupon.findMany({
        where: { code: { in: candidate } },
        select: { code: true },
      });
      if (clashes.length === 0) {
        codes = candidate;
        break;
      }
      const taken = new Set(clashes.map((c) => c.code));
      const regenerated = generateUniqueCodes(prefix, count, length, taken);
      if (regenerated) codes = regenerated;
    }
    if (!codes)
      throw new ValidationError(
        'Could not generate enough unique codes; increase length or change the prefix.',
      );

    try {
      await prisma.$transaction(async (tx) => {
        await tx.coupon.createMany({
          data: codes!.map((code) => ({ ...fields, code, isActive: true })),
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(
          ErrorCode.CONFLICT,
          'A generated code collided with an existing coupon. Please retry.',
          409,
        );
      }
      throw error;
    }

    await adminAuditLogRepository.record({
      adminUserId,
      actorRole: adminRole,
      action: 'admin.coupons_bulk_generated',
      entityType: 'Coupon',
      after: { count, prefix, length, type: fields.type, scope: fields.scope },
    });
    return { created: codes.length, codes };
  }
}

export const couponInsightsService = new CouponInsightsService();
