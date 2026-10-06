import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { requireModuleEnabled } from '../../tenants/middleware/require-module-enabled.middleware';
import { messageLogController } from '../controllers/message-log.controller';
import { listMessageLogQuerySchema } from '../validators/tenant-notification.validators';

export const messageLogRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

messageLogRouter.use(authenticateMiddleware);
messageLogRouter.use(requireModuleEnabled('notifications'));

/**
 * @openapi
 * /notifications/message-log:
 *   get:
 *     tags: [Tenant Notifications]
 *     summary: Every Email/SMS/WhatsApp send attempt for this tenant, with status and full content — never IN_APP/PUSH
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: channel, schema: { type: string, enum: [EMAIL, SMS, WHATSAPP] } }
 *       - { in: query, name: status, schema: { type: string, enum: [SENT, FAILED, SKIPPED_DISABLED, SKIPPED_QUOTA] } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *     responses:
 *       200: { description: "{ items, page, limit, total, totalPages }" }
 */
messageLogRouter.get(
  '/',
  requirePermission('notifications:view'),
  validate({ query: listMessageLogQuerySchema }),
  asyncHandler(messageLogController.list.bind(messageLogController)),
);
