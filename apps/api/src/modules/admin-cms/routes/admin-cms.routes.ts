import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { adminAuthenticateMiddleware } from '../../admin-auth/middlewares/admin-authenticate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { adminCmsController } from '../controllers/admin-cms.controller';
import { cmsPageQuerySchema, cmsPageSlugParamSchema, createCmsPageSchema, updateCmsPageSchema } from '../validators/admin-cms.validators';

export const adminCmsRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

adminCmsRouter.use(adminAuthenticateMiddleware, requireAdminPermission('cms:manage'));

/** @openapi { "/admin/cms/pages": { get: { tags: [Admin CMS], summary: List pages (landing/blog/faq/testimonial/legal), security: [{bearerAuth: []}], responses: { 200: { description: Pages } } } } } */
adminCmsRouter.get('/pages', validate({ query: cmsPageQuerySchema }), asyncHandler(adminCmsController.list.bind(adminCmsController)));

/** @openapi { "/admin/cms/pages/{slug}": { get: { tags: [Admin CMS], summary: Get page, security: [{bearerAuth: []}], responses: { 200: { description: Page } } } } } */
adminCmsRouter.get('/pages/:slug', validate({ params: cmsPageSlugParamSchema }), asyncHandler(adminCmsController.getBySlug.bind(adminCmsController)));

/** @openapi { "/admin/cms/pages": { post: { tags: [Admin CMS], summary: Create page, security: [{bearerAuth: []}], responses: { 201: { description: Created } } } } } */
adminCmsRouter.post('/pages', validate({ body: createCmsPageSchema }), asyncHandler(adminCmsController.create.bind(adminCmsController)));

/** @openapi { "/admin/cms/pages/{slug}": { put: { tags: [Admin CMS], summary: Update page, security: [{bearerAuth: []}], responses: { 200: { description: Updated } } } } } */
adminCmsRouter.put(
  '/pages/:slug',
  validate({ params: cmsPageSlugParamSchema, body: updateCmsPageSchema }),
  asyncHandler(adminCmsController.update.bind(adminCmsController)),
);

/** @openapi { "/admin/cms/pages/{slug}": { delete: { tags: [Admin CMS], summary: Delete page, security: [{bearerAuth: []}], responses: { 200: { description: Deleted } } } } } */
adminCmsRouter.delete('/pages/:slug', validate({ params: cmsPageSlugParamSchema }), asyncHandler(adminCmsController.remove.bind(adminCmsController)));
