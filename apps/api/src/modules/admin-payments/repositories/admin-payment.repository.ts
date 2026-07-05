import type { PaymentStatus } from '@prisma/client';

import { prisma } from '../../../infrastructure/database/prisma';

export class AdminPaymentRepository {
  async list(params: { status?: PaymentStatus; skip: number; take: number }) {
    const where = params.status ? { status: params.status } : {};
    const [total, items] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        include: { tenant: { select: { name: true, slug: true } } },
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
    ]);
    return { total, items };
  }

  async findById(id: string) {
    return prisma.payment.findUnique({
      where: { id },
      include: { tenant: { select: { name: true, slug: true } }, invoice: true, transactions: { orderBy: { createdAt: 'desc' } } },
    });
  }

  async listInvoices(params: { skip: number; take: number }) {
    const [total, items] = await Promise.all([
      prisma.invoice.count(),
      prisma.invoice.findMany({
        include: { tenant: { select: { name: true, slug: true } } },
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
    ]);
    return { total, items };
  }
}

export const adminPaymentRepository = new AdminPaymentRepository();
