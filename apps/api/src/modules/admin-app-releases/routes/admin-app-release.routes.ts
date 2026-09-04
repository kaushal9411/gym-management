import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { adminAuthenticateMiddleware } from '../../admin-auth/middlewares/admin-authenticate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { adminAppReleaseController } from '../controllers/admin-app-release.controller';
import { apkUpload } from '../middlewares/apk-upload.middleware';
import { createAppReleaseSchema, idParamSchema } from '../validators/admin-app-release.validators';

export const adminAppReleaseRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

adminAppReleaseRouter.use(adminAuthenticateMiddleware, requireAdminPermission('app-releases:manage'));

/** @openapi { "/admin/app-releases": { get: { tags: [Admin App Releases], summary: List every uploaded mobile app build, security: [{bearerAuth: []}], responses: { 200: { description: "AppRelease[]" } } } } } */
adminAppReleaseRouter.get('/', asyncHandler(adminAppReleaseController.list.bind(adminAppReleaseController)));

/** @openapi { "/admin/app-releases": { post: { tags: [Admin App Releases], summary: "Upload a new .apk build (multipart: file + version + versionCode + releaseNotes? + activate?)", security: [{bearerAuth: []}], responses: { 201: { description: Release uploaded } } } } } */
adminAppReleaseRouter.post(
  '/',
  apkUpload,
  validate({ body: createAppReleaseSchema }),
  asyncHandler(adminAppReleaseController.create.bind(adminAppReleaseController)),
);

/** @openapi { "/admin/app-releases/{id}/activate": { post: { tags: [Admin App Releases], summary: "Make this the release every user downloads", security: [{bearerAuth: []}], responses: { 200: { description: Activated } } } } } */
adminAppReleaseRouter.post(
  '/:id/activate',
  validate({ params: idParamSchema }),
  asyncHandler(adminAppReleaseController.activate.bind(adminAppReleaseController)),
);

/** @openapi { "/admin/app-releases/{id}": { delete: { tags: [Admin App Releases], summary: "Delete a release (refused for the currently-active one)", security: [{bearerAuth: []}], responses: { 200: { description: Deleted } } } } } */
adminAppReleaseRouter.delete(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(adminAppReleaseController.remove.bind(adminAppReleaseController)),
);
