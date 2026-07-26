import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { notificationTemplateController } from '../controllers/notification-template.controller';
import { templateTypeParamSchema, updateTemplateSchema } from '../validators/tenant-notification.validators';

export const notificationTemplateRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

notificationTemplateRouter.use(authenticateMiddleware);

/** @openapi { "/notifications/templates": { get: { tags: [Notification Templates], summary: "List all 10 templates (tenant override merged with the default)", security: [{bearerAuth: []}], responses: { 200: { description: OK } } } } } */
notificationTemplateRouter.get('/', requirePermission('notifications:manage'), asyncHandler(notificationTemplateController.list.bind(notificationTemplateController)));

/** @openapi { "/notifications/templates/{type}": { patch: { tags: [Notification Templates], summary: "Customize a template for this tenant", security: [{bearerAuth: []}], responses: { 200: { description: Updated } } } } } */
notificationTemplateRouter.patch(
  '/:type',
  requirePermission('notifications:manage'),
  validate({ params: templateTypeParamSchema, body: updateTemplateSchema }),
  asyncHandler(notificationTemplateController.update.bind(notificationTemplateController)),
);
