import { Router } from 'express';

import { adminAuthenticateMiddleware } from '../../admin-auth/middlewares/admin-authenticate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { adminAuditController } from '../controllers/admin-audit.controller';

export const adminAuditRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

/**
 * @openapi
 * /admin/audit-logs:
 *   get:
 *     tags: [Admin Audit]
 *     summary: Admin activity audit trail — login/logout, tenant/subscription/payment/settings changes
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated audit log entries }
 */
adminAuditRouter.get(
  '/',
  adminAuthenticateMiddleware,
  requireAdminPermission('audit:read'),
  asyncHandler(adminAuditController.list.bind(adminAuditController)),
);
