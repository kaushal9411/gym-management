import type { TenantStatus } from '@prisma/client';

import { prisma } from '../../../infrastructure/database/prisma';

/**
 * Deliberately the RAW client, not `getTenantScopedClient` — the entire
 * point of the admin portal is reading/managing ACROSS every tenant. There
 * is no single tenant to scope these queries to.
 */
export class AdminTenantRepository {
  async list(params: { search?: string; status?: TenantStatus; skip: number; take: number }) {
    const where = {
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? { OR: [{ name: { contains: params.search, mode: 'insensitive' as const } }, { slug: { contains: params.search, mode: 'insensitive' as const } }] }
        : {}),
    };
    const [total, items] = await Promise.all([
      prisma.tenant.count({ where }),
      prisma.tenant.findMany({
        where,
        include: {
          subscriptions: { orderBy: { createdAt: 'desc' }, take: 1, include: { plan: true } },
          users: { where: { status: 'ACTIVE' }, take: 1, orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
    ]);
    return { total, items };
  }

  async findById(tenantId: string) {
    return prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        settings: true,
        branding: true,
        limits: true,
        usage: true,
        domains: true,
        subscriptions: { orderBy: { createdAt: 'desc' }, take: 1, include: { plan: true } },
        users: { where: { status: { not: 'DEACTIVATED' } }, orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async updateStatus(tenantId: string, status: TenantStatus, extra: { suspendedAt?: Date | null } = {}) {
    return prisma.tenant.update({ where: { id: tenantId }, data: { status, ...extra } });
  }

  async softDelete(tenantId: string) {
    return prisma.tenant.update({ where: { id: tenantId }, data: { deletedAt: new Date(), status: 'SUSPENDED' } });
  }

  async findOwner(tenantId: string) {
    return prisma.user.findFirst({ where: { tenantId, deletedAt: null }, orderBy: { createdAt: 'asc' } });
  }

  async auditLogs(tenantId: string, take = 50) {
    return prisma.auditLog.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take });
  }
}

export const adminTenantRepository = new AdminTenantRepository();
