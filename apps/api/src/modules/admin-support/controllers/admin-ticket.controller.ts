import type { TicketPriority, TicketStatus } from '@prisma/client';
import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { adminTicketService } from '../services/admin-ticket.service';

interface ListQuery {
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedAdminId?: string;
  page: number;
  limit: number;
}

export class AdminTicketController {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminTicketService.list(req.query as unknown as ListQuery));
  }

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminTicketService.getById(req.params.ticketId!));
  }

  async assign(req: Request, res: Response): Promise<void> {
    const { assignedAdminId } = req.body as { assignedAdminId: string | null };
    const ticket = await adminTicketService.assign(req.params.ticketId!, assignedAdminId, req.admin!.sub, req.admin!.role);
    sendSuccess(res, ticket, 'Ticket assigned.');
  }

  async close(req: Request, res: Response): Promise<void> {
    const ticket = await adminTicketService.close(req.params.ticketId!, req.admin!.sub, req.admin!.role);
    sendSuccess(res, ticket, 'Ticket closed.');
  }

  async setStatus(req: Request, res: Response): Promise<void> {
    const { status } = req.body as { status: TicketStatus };
    const ticket = await adminTicketService.setStatus(req.params.ticketId!, status, req.admin!.sub, req.admin!.role);
    sendSuccess(res, ticket, 'Ticket status updated.');
  }

  async addNote(req: Request, res: Response): Promise<void> {
    const { note, isInternal } = req.body as { note: string; isInternal: boolean };
    const created = await adminTicketService.addNote(req.params.ticketId!, req.admin!.sub, note, isInternal);
    sendSuccess(res, created, 'Note added.', 201);
  }
}

export const adminTicketController = new AdminTicketController();
