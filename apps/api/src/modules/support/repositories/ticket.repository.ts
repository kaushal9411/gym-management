import type { TicketPriority, TicketStatus } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

/**
 * RLS-enforced via the tenant-scoped client (`20260804060000_enable_rls_support_tickets`)
 * — the `tenantId` filter below is kept anyway as defense-in-depth and to
 * match every other repository's shape. The admin plane reads this table
 * cross-tenant via the raw, non-tenant-scoped client — see
 * `admin-support/repositories` — which is unaffected by this table's RLS.
 */
export class TicketRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(tenantId: string, params: { status?: TicketStatus; skip: number; take: number }) {
    const where = { tenantId, ...(params.status ? { status: params.status } : {}) };
    const [total, items] = await Promise.all([
      this.db.supportTicket.count({ where }),
      this.db.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
    ]);
    return { total, items };
  }

  async findById(tenantId: string, id: string) {
    return this.db.supportTicket.findFirst({
      where: { id, tenantId },
      include: {
        // Internal admin notes (triage chatter) are deliberately excluded —
        // a tenant only sees replies an admin explicitly marked non-internal.
        notes: { where: { isInternal: false }, orderBy: { createdAt: 'asc' }, include: { authorAdmin: { select: { name: true } } } },
      },
    });
  }

  async create(input: { tenantId: string; subject: string; description: string; priority: TicketPriority; createdByEmail: string; createdByName?: string }) {
    return this.db.supportTicket.create({ data: input });
  }
}
