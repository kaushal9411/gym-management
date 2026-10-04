import { Router, type Request, type RequestHandler, type Response } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { adminAuthenticateMiddleware } from '../../admin-auth/middlewares/admin-authenticate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { tenantDetailController as c } from '../controllers/tenant-detail.controller';
import { tenantIdParamSchema } from '../validators/admin-tenant.validators';
import {
  activityQuerySchema,
  limitsBodySchema,
  moduleBodySchema,
  moduleKeyParamSchema,
  noteBodySchema,
  noteIdParamSchema,
  reportsQuerySchema,
  tagsBodySchema,
  ticketsQuerySchema,
  usersQuerySchema,
} from '../validators/tenant-detail.validators';

/**
 * Tenant "control center" (detail page) endpoints — mounted at `/admin/tenants` AFTER the base routers, so it only adds
 * `/:tenantId/<sub-path>` routes and never shadows `/:tenantId`. Reads = `tenants:read`, writes = `tenants:manage`.
 */
export const adminTenantDetailRouter: Router = Router();

const h =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn.call(c, req, res)).catch(next);
  };
const read = requireAdminPermission('tenants:read');
const write = requireAdminPermission('tenants:manage');
const params = validate({ params: tenantIdParamSchema });

adminTenantDetailRouter.use(adminAuthenticateMiddleware);

/**
 * @openapi
 * /admin/tenants/{tenantId}/overview:
 *   get:
 *     tags: [Admin Tenants]
 *     summary: Overview tab — tenant, KPIs, health, usage vs limits, engagement, 6-month growth, latest invoices, timeline
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: tenantId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Overview payload }
 *       404: { description: Tenant not found }
 */
adminTenantDetailRouter.get('/:tenantId/overview', read, params, h(c.overview));

/**
 * @openapi
 * /admin/tenants/{tenantId}/reports:
 *   get:
 *     tags: [Admin Tenants]
 *     summary: Reports tab — KPIs, member growth, feature adoption, heatmap, platform revenue, cohorts, staff logins, tickets, plan utilisation
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: tenantId, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: range, schema: { type: string, enum: ['30d', '90d', '6m', '12m'], default: '30d' } }
 *       - { in: query, name: compare, schema: { type: boolean, default: true } }
 *     responses:
 *       200: { description: Reports payload (UTC) }
 *       404: { description: Tenant not found }
 *       422: { description: Invalid range }
 */
adminTenantDetailRouter.get(
  '/:tenantId/reports',
  read,
  validate({ params: tenantIdParamSchema, query: reportsQuerySchema }),
  h(c.reports),
);

/**
 * @openapi
 * /admin/tenants/{tenantId}/limits:
 *   get:
 *     tags: [Admin Tenants]
 *     summary: Limit table — plan value, override, effective value per limit key
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: tenantId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: "[{key,label,planValue,override,effective}]" }
 *   put:
 *     tags: [Admin Tenants]
 *     summary: Set or clear limit overrides (null clears) — enforced immediately, survives plan changes
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: tenantId, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, properties: { overrides: { type: object, additionalProperties: { type: integer, nullable: true } } } }
 *     responses:
 *       200: { description: New effective limit table }
 *       422: { description: Validation error }
 */
adminTenantDetailRouter.get('/:tenantId/limits', read, params, h(c.getLimits));
adminTenantDetailRouter.put(
  '/:tenantId/limits',
  write,
  validate({ params: tenantIdParamSchema, body: limitsBodySchema }),
  h(c.putLimits),
);

/**
 * @openapi
 * /admin/tenants/{tenantId}/modules:
 *   get:
 *     tags: [Admin Tenants]
 *     summary: Module table — plan default, effective enabled flag, override flag
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: tenantId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: "[{key,label,planDefault,enabled,overridden,platformEnabled,guarded}]" }
 */
adminTenantDetailRouter.get('/:tenantId/modules', read, params, h(c.getModules));

/**
 * @openapi
 * /admin/tenants/{tenantId}/modules/{key}:
 *   put:
 *     tags: [Admin Tenants]
 *     summary: Enable/disable one module for this tenant (core modules cannot be disabled)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: tenantId, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: key, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [enabled], properties: { enabled: { type: boolean } } }
 *     responses:
 *       200: { description: Updated module row }
 *       404: { description: Unknown module }
 *       422: { description: Guarded module }
 */
adminTenantDetailRouter.put(
  '/:tenantId/modules/:key',
  write,
  validate({ params: moduleKeyParamSchema, body: moduleBodySchema }),
  h(c.putModule),
);

/**
 * @openapi
 * /admin/tenants/{tenantId}/notes:
 *   get:
 *     tags: [Admin Tenants]
 *     summary: Internal admin-only notes (newest first)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: tenantId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: "[{id,body,authorId,authorName,createdAt,canDelete}]" }
 *   post:
 *     tags: [Admin Tenants]
 *     summary: Add an internal note (max 2000 chars)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: tenantId, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [body], properties: { body: { type: string, maxLength: 2000 } } }
 *     responses:
 *       201: { description: Created note }
 */
adminTenantDetailRouter.get('/:tenantId/notes', read, params, h(c.listNotes));
adminTenantDetailRouter.post(
  '/:tenantId/notes',
  write,
  validate({ params: tenantIdParamSchema, body: noteBodySchema }),
  h(c.addNote),
);

/** @openapi { "/admin/tenants/{tenantId}/notes/{noteId}": { delete: { tags: [Admin Tenants], summary: "Delete a note - author or admins:manage", security: [{bearerAuth: []}], parameters: [{ in: path, name: tenantId, required: true, schema: { type: string, format: uuid } }, { in: path, name: noteId, required: true, schema: { type: string, format: uuid } }], responses: { 200: { description: Deleted }, 403: { description: Not author }, 404: { description: Not found } } } } } */
adminTenantDetailRouter.delete(
  '/:tenantId/notes/:noteId',
  write,
  validate({ params: noteIdParamSchema }),
  h(c.deleteNote),
);

/**
 * @openapi
 * /admin/tenants/{tenantId}/tags:
 *   get:
 *     tags: [Admin Tenants]
 *     summary: Admin-only tags for this tenant
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: tenantId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: "{tags:string[]}" }
 *   put:
 *     tags: [Admin Tenants]
 *     summary: Replace tags (max 10, each max 24 chars, lowercase slug)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: tenantId, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [tags], properties: { tags: { type: array, items: { type: string } } } }
 *     responses:
 *       200: { description: "{tags:string[]}" }
 */
adminTenantDetailRouter.get('/:tenantId/tags', read, params, h(c.getTags));
adminTenantDetailRouter.put(
  '/:tenantId/tags',
  write,
  validate({ params: tenantIdParamSchema, body: tagsBodySchema }),
  h(c.putTags),
);

/** @openapi { "/admin/tenants/{tenantId}/users": { get: { tags: [Admin Tenants], summary: "Users tab - tenant staff list with role, status, lastLoginAt, mfa", security: [{bearerAuth: []}], parameters: [{ in: path, name: tenantId, required: true, schema: { type: string, format: uuid } }, { in: query, name: search, schema: { type: string } }, { in: query, name: status, schema: { type: string } }, { in: query, name: page, schema: { type: integer } }, { in: query, name: limit, schema: { type: integer } }], responses: { 200: { description: "{items,counts,page,limit,total,totalPages}" } } } } } */
adminTenantDetailRouter.get(
  '/:tenantId/users',
  read,
  validate({ params: tenantIdParamSchema, query: usersQuerySchema }),
  h(c.users),
);

/** @openapi { "/admin/tenants/{tenantId}/activity": { get: { tags: [Admin Tenants], summary: "Activity tab - tenant-side audit trail filtered by action/from/to/actor, paginated", security: [{bearerAuth: []}], parameters: [{ in: path, name: tenantId, required: true, schema: { type: string, format: uuid } }, { in: query, name: action, schema: { type: string } }, { in: query, name: actor, schema: { type: string } }, { in: query, name: from, schema: { type: string } }, { in: query, name: to, schema: { type: string } }, { in: query, name: page, schema: { type: integer } }, { in: query, name: limit, schema: { type: integer } }], responses: { 200: { description: "{items,page,limit,total,totalPages}" } } } } } */
adminTenantDetailRouter.get(
  '/:tenantId/activity',
  read,
  validate({ params: tenantIdParamSchema, query: activityQuerySchema }),
  h(c.activity),
);

/** @openapi { "/admin/tenants/{tenantId}/support/tickets": { get: { tags: [Admin Tenants], summary: "Support tab - this tenant's tickets with status filter and counts", security: [{bearerAuth: []}], parameters: [{ in: path, name: tenantId, required: true, schema: { type: string, format: uuid } }, { in: query, name: status, schema: { type: string, enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED] } }, { in: query, name: page, schema: { type: integer } }, { in: query, name: limit, schema: { type: integer } }], responses: { 200: { description: "{items,counts,page,limit,total,totalPages}" } } } } } */
adminTenantDetailRouter.get(
  '/:tenantId/support/tickets',
  read,
  validate({ params: tenantIdParamSchema, query: ticketsQuerySchema }),
  h(c.tickets),
);

/** @openapi { "/admin/tenants/{tenantId}/subscription/history": { get: { tags: [Admin Tenants], summary: "Subscription tab - subscriptions and plan/status history", security: [{bearerAuth: []}], parameters: [{ in: path, name: tenantId, required: true, schema: { type: string, format: uuid } }], responses: { 200: { description: "{subscriptions,history}" } } } } } */
adminTenantDetailRouter.get(
  '/:tenantId/subscription/history',
  read,
  params,
  h(c.subscriptionHistory),
);
