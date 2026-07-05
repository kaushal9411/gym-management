import type { InvoiceStatus } from '@prisma/client';

import { prisma } from '../../../infrastructure/database/prisma';
import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

export interface InvoiceLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export class InvoiceRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  /**
   * `INV-<yyyyMM>-<sequence>` — sequence is derived from the platform-wide
   * invoice count via the raw client (invoice numbers must be globally
   * unique and monotonically informative, not just per-tenant), so this
   * one lookup deliberately bypasses the tenant-scoped client. A tiny race
   * window exists under concurrent invoice generation (same tradeoff
   * already documented for onboarding's assertNoDuplicate) — acceptable
   * here since a collision only forces a retry, it never double-charges.
   */
  async nextInvoiceNumber(): Promise<string> {
    const count = await prisma.invoice.count();
    const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
    return `INV-${yearMonth}-${String(count + 1).padStart(6, '0')}`;
  }

  async create(input: {
    tenantId: string;
    subscriptionId: string | null;
    couponId: string | null;
    invoiceNumber: string;
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    total: number;
    currency: string;
    dueDate: Date | null;
    items: InvoiceLineInput[];
  }) {
    return this.db.invoice.create({
      data: {
        tenantId: input.tenantId,
        subscriptionId: input.subscriptionId,
        couponId: input.couponId,
        invoiceNumber: input.invoiceNumber,
        subtotal: input.subtotal,
        taxAmount: input.taxAmount,
        discountAmount: input.discountAmount,
        total: input.total,
        currency: input.currency,
        dueDate: input.dueDate,
        status: 'OPEN',
        items: { create: input.items },
      },
      include: { items: true },
    });
  }

  async markPaid(invoiceId: string) {
    return this.db.invoice.update({ where: { id: invoiceId }, data: { status: 'PAID', paidAt: new Date() } });
  }

  async markStatus(invoiceId: string, status: InvoiceStatus) {
    return this.db.invoice.update({ where: { id: invoiceId }, data: { status } });
  }

  async listForTenant(tenantId: string, limit = 50) {
    return this.db.invoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { items: true },
    });
  }

  async findById(tenantId: string, invoiceId: string) {
    return this.db.invoice.findFirst({ where: { id: invoiceId, tenantId }, include: { items: true } });
  }
}
