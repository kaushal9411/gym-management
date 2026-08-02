import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { actorFrom } from '../../authentication/utils/actor.util';
import { TicketService } from '../services/ticket.service';
import type { CreateTicketInput, ListTicketsQuery } from '../validators/ticket.validators';

function serviceFor(req: Request): TicketService {
  return new TicketService(req.tenant!.id);
}

export class TicketController {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).list(req.query as unknown as ListTicketsQuery));
  }

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await serviceFor(req).getById(req.params.ticketId!));
  }

  async create(req: Request, res: Response): Promise<void> {
    const ticket = await serviceFor(req).create(req.body as CreateTicketInput, actorFrom(req));
    sendSuccess(res, ticket, 'Support ticket created.', 201);
  }
}

export const ticketController = new TicketController();
