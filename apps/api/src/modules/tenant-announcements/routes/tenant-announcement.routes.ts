import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { tenantAnnouncementController } from '../controllers/tenant-announcement.controller';
import {
  createAnnouncementSchema,
  idParamSchema,
  listAnnouncementsQuerySchema,
  scheduleAnnouncementSchema,
  updateAnnouncementSchema,
} from '../validators/tenant-announcement.validators';

export const tenantAnnouncementRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

tenantAnnouncementRouter.use(authenticateMiddleware);

/** @openapi { "/tenant-announcements": { get: { tags: [Tenant Announcements], summary: "List this tenant's announcements", security: [{bearerAuth: []}], responses: { 200: { description: OK } } } } } */
tenantAnnouncementRouter.get(
  '/',
  requirePermission('announcements:view'),
  validate({ query: listAnnouncementsQuerySchema }),
  asyncHandler(tenantAnnouncementController.list.bind(tenantAnnouncementController)),
);

/** @openapi { "/tenant-announcements": { post: { tags: [Tenant Announcements], summary: "Create a draft announcement", security: [{bearerAuth: []}], responses: { 201: { description: Created } } } } } */
tenantAnnouncementRouter.post(
  '/',
  requirePermission('announcements:create'),
  validate({ body: createAnnouncementSchema }),
  asyncHandler(tenantAnnouncementController.create.bind(tenantAnnouncementController)),
);

/** @openapi { "/tenant-announcements/{id}": { get: { tags: [Tenant Announcements], summary: "Announcement details", security: [{bearerAuth: []}], responses: { 200: { description: OK } } } } } */
tenantAnnouncementRouter.get(
  '/:id',
  requirePermission('announcements:view'),
  validate({ params: idParamSchema }),
  asyncHandler(tenantAnnouncementController.getById.bind(tenantAnnouncementController)),
);

/** @openapi { "/tenant-announcements/{id}": { patch: { tags: [Tenant Announcements], summary: "Edit a draft/scheduled announcement", security: [{bearerAuth: []}], responses: { 200: { description: Updated } } } } } */
tenantAnnouncementRouter.patch(
  '/:id',
  requirePermission('announcements:update'),
  validate({ params: idParamSchema, body: updateAnnouncementSchema }),
  asyncHandler(tenantAnnouncementController.update.bind(tenantAnnouncementController)),
);

/** @openapi { "/tenant-announcements/{id}/publish": { post: { tags: [Tenant Announcements], summary: "Publish immediately", security: [{bearerAuth: []}], responses: { 200: { description: Published } } } } } */
tenantAnnouncementRouter.post(
  '/:id/publish',
  requirePermission('announcements:publish'),
  validate({ params: idParamSchema }),
  asyncHandler(tenantAnnouncementController.publish.bind(tenantAnnouncementController)),
);

/** @openapi { "/tenant-announcements/{id}/schedule": { post: { tags: [Tenant Announcements], summary: "Schedule a future auto-publish time", security: [{bearerAuth: []}], responses: { 200: { description: Scheduled } } } } } */
tenantAnnouncementRouter.post(
  '/:id/schedule',
  requirePermission('announcements:publish'),
  validate({ params: idParamSchema, body: scheduleAnnouncementSchema }),
  asyncHandler(tenantAnnouncementController.schedule.bind(tenantAnnouncementController)),
);

/** @openapi { "/tenant-announcements/{id}": { delete: { tags: [Tenant Announcements], summary: "Delete an announcement", security: [{bearerAuth: []}], responses: { 200: { description: Deleted } } } } } */
tenantAnnouncementRouter.delete(
  '/:id',
  requirePermission('announcements:delete'),
  validate({ params: idParamSchema }),
  asyncHandler(tenantAnnouncementController.remove.bind(tenantAnnouncementController)),
);
