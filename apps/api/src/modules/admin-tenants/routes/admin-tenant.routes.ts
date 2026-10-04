import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { adminAuthenticateMiddleware } from '../../admin-auth/middlewares/admin-authenticate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { adminTenantController } from '../controllers/admin-tenant.controller';
import {
  extendTrialBodySchema,
  maintenanceBodySchema,
  tenantIdParamSchema,
} from '../validators/admin-tenant.validators';

import { adminTenantListRouter } from './tenant-list.routes';

export const adminTenantRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

adminTenantRouter.use(adminAuthenticateMiddleware);

// List / insights / export / bulk live in `tenant-list.routes.ts` — mounted here, BEFORE every `/:tenantId` route.
adminTenantRouter.use(adminTenantListRouter);

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
adminTenantRouter.get(
  '/:tenantId',
  requireAdminPermission('tenants:read'),
  validate({ params: tenantIdParamSchema }),
  asyncHandler(adminTenantController.getById.bind(adminTenantController)),
);

/** @openapi { "/admin/tenants/{tenantId}/activate": { post: { tags: [Admin Tenants], summary: Activate, security: [{bearerAuth: []}], responses: { 200: { description: Activated } } } } } */
adminTenantRouter.post(
  '/:tenantId/activate',
  requireAdminPermission('tenants:manage'),
  validate({ params: tenantIdParamSchema }),
  asyncHandler(adminTenantController.activate.bind(adminTenantController)),
);

/** @openapi { "/admin/tenants/{tenantId}/suspend": { post: { tags: [Admin Tenants], summary: Suspend, security: [{bearerAuth: []}], responses: { 200: { description: Suspended } } } } } */
adminTenantRouter.post(
  '/:tenantId/suspend',
  requireAdminPermission('tenants:manage'),
  validate({ params: tenantIdParamSchema }),
  asyncHandler(adminTenantController.suspend.bind(adminTenantController)),
);

/** @openapi { "/admin/tenants/{tenantId}/reactivate": { post: { tags: [Admin Tenants], summary: Reactivate, security: [{bearerAuth: []}], responses: { 200: { description: Reactivated } } } } } */
adminTenantRouter.post(
  '/:tenantId/reactivate',
  requireAdminPermission('tenants:manage'),
  validate({ params: tenantIdParamSchema }),
  asyncHandler(adminTenantController.reactivate.bind(adminTenantController)),
);

/** @openapi { "/admin/tenants/{tenantId}": { delete: { tags: [Admin Tenants], summary: Delete (soft), security: [{bearerAuth: []}], responses: { 200: { description: Deleted } } } } } */
adminTenantRouter.delete(
  '/:tenantId',
  requireAdminPermission('tenants:manage'),
  validate({ params: tenantIdParamSchema }),
  asyncHandler(adminTenantController.remove.bind(adminTenantController)),
);

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

/**
 * @openapi
 * /admin/tenants/{tenantId}/extend-trial:
 *   post:
 *     tags: [Admin Tenants]
 *     summary: Extend Trial — TRIAL tenants only (422 otherwise); extends from the later of now / current trial end
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [days]
 *             properties:
 *               days: { type: integer, minimum: 1, maximum: 90 }
 *               reason: { type: string, maxLength: 200 }
 *     responses:
 *       200: { description: "{ id, status, trialEndsAt }" }
 *       404: { description: Tenant not found }
 *       422: { description: Not on trial / invalid days }
 */
adminTenantRouter.post(
  '/:tenantId/extend-trial',
  requireAdminPermission('tenants:manage'),
  validate({ params: tenantIdParamSchema, body: extendTrialBodySchema }),
  asyncHandler(adminTenantController.extendTrial.bind(adminTenantController)),
);

/**
 * @openapi
 * /admin/tenants/{tenantId}/maintenance:
 *   post:
 *     tags: [Admin Tenants]
 *     summary: Toggle Maintenance Mode — blocks every tenant-portal request with 503 MAINTENANCE while on (409 if already in that state)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [enabled]
 *             properties:
 *               enabled: { type: boolean }
 *               reason: { type: string, maxLength: 200 }
 *     responses:
 *       200: { description: "{ id, maintenanceMode }" }
 *       404: { description: Tenant not found }
 *       409: { description: Already in requested state }
 */
adminTenantRouter.post(
  '/:tenantId/maintenance',
  requireAdminPermission('tenants:manage'),
  validate({ params: tenantIdParamSchema, body: maintenanceBodySchema }),
  asyncHandler(adminTenantController.maintenance.bind(adminTenantController)),
);

/** @openapi { "/admin/tenants/{tenantId}/force-logout": { post: { tags: [Admin Tenants], summary: "Force Logout — revokes every active refresh token and session of the tenant", security: [{bearerAuth: []}], responses: { 200: { description: "{ revokedSessions }" }, 404: { description: Tenant not found } } } } } */
adminTenantRouter.post(
  '/:tenantId/force-logout',
  requireAdminPermission('tenants:manage'),
  validate({ params: tenantIdParamSchema }),
  asyncHandler(adminTenantController.forceLogout.bind(adminTenantController)),
);

/** @openapi { "/admin/tenants/{tenantId}/subscription": { get: { tags: [Admin Tenants], summary: View Subscription, security: [{bearerAuth: []}], responses: { 200: { description: Subscription } } } } } */
adminTenantRouter.get(
  '/:tenantId/subscription',
  requireAdminPermission('tenants:read'),
  validate({ params: tenantIdParamSchema }),
  asyncHandler(adminTenantController.subscription.bind(adminTenantController)),
);

/** @openapi { "/admin/tenants/{tenantId}/usage": { get: { tags: [Admin Tenants], summary: View Usage, security: [{bearerAuth: []}], responses: { 200: { description: Limits + usage } } } } } */
adminTenantRouter.get(
  '/:tenantId/usage',
  requireAdminPermission('tenants:read'),
  validate({ params: tenantIdParamSchema }),
  asyncHandler(adminTenantController.usage.bind(adminTenantController)),
);

/** @openapi { "/admin/tenants/{tenantId}/audit-logs": { get: { tags: [Admin Tenants], summary: View Audit Logs, security: [{bearerAuth: []}], responses: { 200: { description: Tenant audit log entries } } } } } */
adminTenantRouter.get(
  '/:tenantId/audit-logs',
  requireAdminPermission('tenants:read'),
  validate({ params: tenantIdParamSchema }),
  asyncHandler(adminTenantController.auditLogs.bind(adminTenantController)),
);
