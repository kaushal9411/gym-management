import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { adminAuthenticateMiddleware } from '../../admin-auth/middlewares/admin-authenticate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { adminTenantController } from '../controllers/admin-tenant.controller';
import { listTenantsQuerySchema, tenantIdParamSchema } from '../validators/admin-tenant.validators';

export const adminTenantRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

adminTenantRouter.use(adminAuthenticateMiddleware);

/**
 * @openapi
 * /admin/tenants:
 *   get:
 *     tags: [Admin Tenants]
 *     summary: List All Tenants — search, filter by status, paginated
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [TRIAL, ACTIVE, PAST_DUE, SUSPENDED, CANCELLED] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Paginated tenant list }
 */
adminTenantRouter.get('/', requireAdminPermission('tenants:read'), validate({ query: listTenantsQuerySchema }), asyncHandler(adminTenantController.list.bind(adminTenantController)));

/**
 * @openapi
 * /admin/tenants/{tenantId}:
 *   get:
 *     tags: [Admin Tenants]
 *     summary: View Details — full tenant record (settings, branding, limits, usage, subscription, users)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: tenantId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Tenant detail }
 *       404: { description: Tenant not found }
 */
adminTenantRouter.get('/:tenantId', requireAdminPermission('tenants:read'), validate({ params: tenantIdParamSchema }), asyncHandler(adminTenantController.getById.bind(adminTenantController)));

/** @openapi { "/admin/tenants/{tenantId}/activate": { post: { tags: [Admin Tenants], summary: Activate, security: [{bearerAuth: []}], responses: { 200: { description: Activated } } } } } */
adminTenantRouter.post('/:tenantId/activate', requireAdminPermission('tenants:manage'), validate({ params: tenantIdParamSchema }), asyncHandler(adminTenantController.activate.bind(adminTenantController)));

/** @openapi { "/admin/tenants/{tenantId}/suspend": { post: { tags: [Admin Tenants], summary: Suspend, security: [{bearerAuth: []}], responses: { 200: { description: Suspended } } } } } */
adminTenantRouter.post('/:tenantId/suspend', requireAdminPermission('tenants:manage'), validate({ params: tenantIdParamSchema }), asyncHandler(adminTenantController.suspend.bind(adminTenantController)));

/** @openapi { "/admin/tenants/{tenantId}/reactivate": { post: { tags: [Admin Tenants], summary: Reactivate, security: [{bearerAuth: []}], responses: { 200: { description: Reactivated } } } } } */
adminTenantRouter.post('/:tenantId/reactivate', requireAdminPermission('tenants:manage'), validate({ params: tenantIdParamSchema }), asyncHandler(adminTenantController.reactivate.bind(adminTenantController)));

/** @openapi { "/admin/tenants/{tenantId}": { delete: { tags: [Admin Tenants], summary: Delete (soft), security: [{bearerAuth: []}], responses: { 200: { description: Deleted } } } } } */
adminTenantRouter.delete('/:tenantId', requireAdminPermission('tenants:manage'), validate({ params: tenantIdParamSchema }), asyncHandler(adminTenantController.remove.bind(adminTenantController)));

/** @openapi { "/admin/tenants/{tenantId}/reset-owner-password": { post: { tags: [Admin Tenants], summary: Reset Owner Password, security: [{bearerAuth: []}], responses: { 200: { description: Reset email sent } } } } } */
adminTenantRouter.post(
  '/:tenantId/reset-owner-password',
  requireAdminPermission('tenants:manage'),
  validate({ params: tenantIdParamSchema }),
  asyncHandler(adminTenantController.resetOwnerPassword.bind(adminTenantController)),
);

/**
 * @openapi
 * /admin/tenants/{tenantId}/impersonate:
 *   post:
 *     tags: [Admin Tenants]
 *     summary: Impersonate Tenant (Securely) — issues a 10-minute, access-only tenant token, fully audited both sides
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ accessToken, expiresAt, portalUrl }" }
 */
adminTenantRouter.post(
  '/:tenantId/impersonate',
  requireAdminPermission('tenants:manage'),
  validate({ params: tenantIdParamSchema }),
  asyncHandler(adminTenantController.impersonate.bind(adminTenantController)),
);

/** @openapi { "/admin/tenants/{tenantId}/subscription": { get: { tags: [Admin Tenants], summary: View Subscription, security: [{bearerAuth: []}], responses: { 200: { description: Subscription } } } } } */
adminTenantRouter.get('/:tenantId/subscription', requireAdminPermission('tenants:read'), validate({ params: tenantIdParamSchema }), asyncHandler(adminTenantController.subscription.bind(adminTenantController)));

/** @openapi { "/admin/tenants/{tenantId}/usage": { get: { tags: [Admin Tenants], summary: View Usage, security: [{bearerAuth: []}], responses: { 200: { description: Limits + usage } } } } } */
adminTenantRouter.get('/:tenantId/usage', requireAdminPermission('tenants:read'), validate({ params: tenantIdParamSchema }), asyncHandler(adminTenantController.usage.bind(adminTenantController)));

/** @openapi { "/admin/tenants/{tenantId}/audit-logs": { get: { tags: [Admin Tenants], summary: View Audit Logs, security: [{bearerAuth: []}], responses: { 200: { description: Tenant audit log entries } } } } } */
adminTenantRouter.get('/:tenantId/audit-logs', requireAdminPermission('tenants:read'), validate({ params: tenantIdParamSchema }), asyncHandler(adminTenantController.auditLogs.bind(adminTenantController)));
