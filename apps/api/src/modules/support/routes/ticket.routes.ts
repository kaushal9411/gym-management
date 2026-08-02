import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { ticketController } from '../controllers/ticket.controller';
import { createTicketSchema, listTicketsQuerySchema, ticketIdParamSchema } from '../validators/ticket.validators';

export const ticketRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

ticketRouter.use(authenticateMiddleware);

/** @openapi { "/support/tickets": { get: { tags: [Support], summary: List my tickets, security: [{bearerAuth: []}], responses: { 200: { description: Paginated tickets } } } } } */
ticketRouter.get(
  '/',
  requirePermission('support:view'),
  validate({ query: listTicketsQuerySchema }),
  asyncHandler(ticketController.list.bind(ticketController)),
);

/** @openapi { "/support/tickets/{ticketId}": { get: { tags: [Support], summary: Ticket detail, security: [{bearerAuth: []}], responses: { 200: { description: Ticket } } } } } */
ticketRouter.get(
  '/:ticketId',
  requirePermission('support:view'),
  validate({ params: ticketIdParamSchema }),
  asyncHandler(ticketController.getById.bind(ticketController)),
);

/** @openapi { "/support/tickets": { post: { tags: [Support], summary: Create a ticket, security: [{bearerAuth: []}], responses: { 201: { description: Created } } } } } */
ticketRouter.post(
  '/',
  requirePermission('support:create'),
  validate({ body: createTicketSchema }),
  asyncHandler(ticketController.create.bind(ticketController)),
);
