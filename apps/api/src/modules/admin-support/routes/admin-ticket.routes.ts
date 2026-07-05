import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { adminAuthenticateMiddleware } from '../../admin-auth/middlewares/admin-authenticate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { adminTicketController } from '../controllers/admin-ticket.controller';
import {
  addTicketNoteSchema,
  assignTicketSchema,
  listTicketsQuerySchema,
  setTicketStatusSchema,
  ticketIdParamSchema,
} from '../validators/admin-ticket.validators';

export const adminTicketRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

adminTicketRouter.use(adminAuthenticateMiddleware, requireAdminPermission('support:manage'));

/** @openapi { "/admin/support/tickets": { get: { tags: [Admin Support], summary: View Tickets, security: [{bearerAuth: []}], responses: { 200: { description: Paginated tickets } } } } } */
adminTicketRouter.get('/', validate({ query: listTicketsQuerySchema }), asyncHandler(adminTicketController.list.bind(adminTicketController)));

/** @openapi { "/admin/support/tickets/{ticketId}": { get: { tags: [Admin Support], summary: Ticket detail + notes, security: [{bearerAuth: []}], responses: { 200: { description: Ticket } } } } } */
adminTicketRouter.get('/:ticketId', validate({ params: ticketIdParamSchema }), asyncHandler(adminTicketController.getById.bind(adminTicketController)));

/** @openapi { "/admin/support/tickets/{ticketId}/assign": { post: { tags: [Admin Support], summary: Assign Ticket, security: [{bearerAuth: []}], responses: { 200: { description: Assigned } } } } } */
adminTicketRouter.post(
  '/:ticketId/assign',
  validate({ params: ticketIdParamSchema, body: assignTicketSchema }),
  asyncHandler(adminTicketController.assign.bind(adminTicketController)),
);

/** @openapi { "/admin/support/tickets/{ticketId}/close": { post: { tags: [Admin Support], summary: Close Ticket, security: [{bearerAuth: []}], responses: { 200: { description: Closed } } } } } */
adminTicketRouter.post('/:ticketId/close', validate({ params: ticketIdParamSchema }), asyncHandler(adminTicketController.close.bind(adminTicketController)));

/** @openapi { "/admin/support/tickets/{ticketId}/status": { patch: { tags: [Admin Support], summary: Change Ticket Status, security: [{bearerAuth: []}], responses: { 200: { description: Updated } } } } } */
adminTicketRouter.patch(
  '/:ticketId/status',
  validate({ params: ticketIdParamSchema, body: setTicketStatusSchema }),
  asyncHandler(adminTicketController.setStatus.bind(adminTicketController)),
);

/** @openapi { "/admin/support/tickets/{ticketId}/notes": { post: { tags: [Admin Support], summary: Internal Notes, security: [{bearerAuth: []}], responses: { 201: { description: Note added } } } } } */
adminTicketRouter.post(
  '/:ticketId/notes',
  validate({ params: ticketIdParamSchema, body: addTicketNoteSchema }),
  asyncHandler(adminTicketController.addNote.bind(adminTicketController)),
);
