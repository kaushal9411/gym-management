import type { TicketPriority, TicketStatus } from '@prisma/client';

import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';
import { adminTicketRepository } from '../repositories/admin-ticket.repository';

export class AdminTicketService {
  async list(params: { status?: TicketStatus; priority?: TicketPriority; assignedAdminId?: string; page: number; limit: number }) {
    const skip = (params.page - 1) * params.limit;
    const { total, items } = await adminTicketRepository.list({ ...params, skip, take: params.limit });
    return { items, page: params.page, limit: params.limit, total, totalPages: Math.ceil(total / params.limit) };
  }

  async getById(id: string) {
    const ticket = await adminTicketRepository.findById(id);
    if (!ticket) throw new AppError(ErrorCode.NOT_FOUND, 'Ticket not found', 404);
    return ticket;
  }

  async assign(id: string, assignedAdminId: string | null, actorAdminId: string, actorRole: string) {
    await this.getById(id);
    const ticket = await adminTicketRepository.assign(id, assignedAdminId);
    await adminAuditLogRepository.record({ adminUserId: actorAdminId, actorRole, action: 'admin.ticket_assigned', entityType: 'SupportTicket', entityId: id, after: { assignedAdminId } });
    return ticket;
  }

  async close(id: string, actorAdminId: string, actorRole: string) {
    await this.getById(id);
    const ticket = await adminTicketRepository.setStatus(id, 'CLOSED');
    await adminAuditLogRepository.record({ adminUserId: actorAdminId, actorRole, action: 'admin.ticket_closed', entityType: 'SupportTicket', entityId: id });
    return ticket;
  }

  async setStatus(id: string, status: TicketStatus, actorAdminId: string, actorRole: string) {
    await this.getById(id);
    const ticket = await adminTicketRepository.setStatus(id, status);
    await adminAuditLogRepository.record({ adminUserId: actorAdminId, actorRole, action: 'admin.ticket_status_changed', entityType: 'SupportTicket', entityId: id, after: { status } });
    return ticket;
  }

  async addNote(id: string, authorAdminId: string, note: string, isInternal: boolean) {
    await this.getById(id);
    return adminTicketRepository.addNote(id, authorAdminId, note, isInternal);
  }
}

export const adminTicketService = new AdminTicketService();
