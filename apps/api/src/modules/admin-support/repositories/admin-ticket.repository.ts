import type { TicketPriority, TicketStatus } from '@prisma/client';

import { prisma } from '../../../infrastructure/database/prisma';

export class AdminTicketRepository {
  async list(params: { status?: TicketStatus; priority?: TicketPriority; assignedAdminId?: string; skip: number; take: number }) {
    const where = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.priority ? { priority: params.priority } : {}),
      ...(params.assignedAdminId ? { assignedAdminId: params.assignedAdminId } : {}),
    };
    const [total, items] = await Promise.all([
      prisma.supportTicket.count({ where }),
      prisma.supportTicket.findMany({
        where,
        include: { tenant: { select: { name: true, slug: true } }, assignedAdmin: { select: { name: true, email: true } } },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip: params.skip,
        take: params.take,
      }),
    ]);
    return { total, items };
  }

  async findById(id: string) {
    return prisma.supportTicket.findUnique({
      where: { id },
      include: {
        tenant: { select: { name: true, slug: true } },
        assignedAdmin: { select: { name: true, email: true } },
        notes: { orderBy: { createdAt: 'asc' }, include: { authorAdmin: { select: { name: true } } } },
      },
    });
  }

  async create(input: { tenantId?: string; subject: string; description: string; priority: TicketPriority; createdByEmail: string; createdByName?: string }) {
    return prisma.supportTicket.create({ data: input });
  }

  async assign(id: string, assignedAdminId: string | null) {
    return prisma.supportTicket.update({ where: { id }, data: { assignedAdminId, status: assignedAdminId ? 'IN_PROGRESS' : 'OPEN' } });
  }

  async setStatus(id: string, status: TicketStatus) {
    return prisma.supportTicket.update({ where: { id }, data: { status, closedAt: status === 'CLOSED' ? new Date() : null } });
  }

  async addNote(ticketId: string, authorAdminId: string, note: string, isInternal: boolean) {
    return prisma.supportTicketNote.create({ data: { ticketId, authorAdminId, note, isInternal } });
  }
}

export const adminTicketRepository = new AdminTicketRepository();
