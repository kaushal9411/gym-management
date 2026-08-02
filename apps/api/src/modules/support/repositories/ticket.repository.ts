import type { TicketPriority, TicketStatus } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

/**
 * `SupportTicket` has NO RLS policy (it's queried cross-tenant by the admin
 * plane via the raw client — see `admin-support/repositories`) — the
 * `tenantId` filter below is what actually enforces isolation here, not the
 * DB. Still constructed with the tenant-scoped client for consistency with
 * every other tenant module and in case RLS is ever added to this table.
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
