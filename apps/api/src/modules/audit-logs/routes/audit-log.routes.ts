import { Router } from 'express';
import { z } from 'zod';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { auditLogController } from '../controllers/audit-log.controller';

export const auditLogRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

const listAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  action: z.string().trim().max(80).optional(),
  entityType: z.string().trim().max(60).optional(),
  actorUserId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

/**
 * @openapi
 * /audit-logs:
 *   get:
 *     tags: [Audit Logs]
 *     summary: Tenant audit trail (filter by action prefix, entity, actor, date range)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated audit records }
 */
auditLogRouter.get(
  '/',
  authenticateMiddleware,
  requirePermission('audit:read'),
  validate({ query: listAuditLogsQuerySchema }),
  asyncHandler(auditLogController.list.bind(auditLogController)),
);
