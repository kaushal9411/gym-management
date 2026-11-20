import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { adminAuthenticateMiddleware } from '../../admin-auth/middlewares/admin-authenticate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { adminLeadController } from '../controllers/admin-lead.controller';
import { leadIdParamSchema, listLeadsQuerySchema, updateLeadSchema } from '../validators/admin-lead.validators';

export const adminLeadRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

adminLeadRouter.use(adminAuthenticateMiddleware, requireAdminPermission('leads:manage'));

/** @openapi { "/admin/leads": { get: { tags: [Admin Leads], summary: "Website contact-form leads (filter by status, topic, search) with per-status counts", security: [{bearerAuth: []}], responses: { 200: { description: Paginated leads and stats } } } } } */
adminLeadRouter.get('/', validate({ query: listLeadsQuerySchema }), asyncHandler(adminLeadController.list.bind(adminLeadController)));

/** @openapi { "/admin/leads/{leadId}": { get: { tags: [Admin Leads], summary: Lead detail, security: [{bearerAuth: []}], responses: { 200: { description: Lead } } } } } */
adminLeadRouter.get('/:leadId', validate({ params: leadIdParamSchema }), asyncHandler(adminLeadController.getById.bind(adminLeadController)));

/** @openapi { "/admin/leads/{leadId}": { patch: { tags: [Admin Leads], summary: "Change a lead's status and/or internal notes", security: [{bearerAuth: []}], responses: { 200: { description: Updated lead } } } } } */
adminLeadRouter.patch(
  '/:leadId',
  validate({ params: leadIdParamSchema, body: updateLeadSchema }),
  asyncHandler(adminLeadController.update.bind(adminLeadController)),
);

/** @openapi { "/admin/leads/{leadId}": { delete: { tags: [Admin Leads], summary: Delete a lead, security: [{bearerAuth: []}], responses: { 200: { description: Deleted } } } } } */
adminLeadRouter.delete('/:leadId', validate({ params: leadIdParamSchema }), asyncHandler(adminLeadController.remove.bind(adminLeadController)));
