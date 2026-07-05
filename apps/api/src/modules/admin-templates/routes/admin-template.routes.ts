import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { adminAuthenticateMiddleware } from '../../admin-auth/middlewares/admin-authenticate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { adminTemplateController } from '../controllers/admin-template.controller';
import { templateKeyParamSchema, upsertEmailTemplateSchema, upsertSmsTemplateSchema } from '../validators/admin-template.validators';

export const adminTemplateRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

adminTemplateRouter.use(adminAuthenticateMiddleware, requireAdminPermission('templates:manage'));

/** @openapi { "/admin/templates/email": { get: { tags: [Admin Templates], summary: List email templates, security: [{bearerAuth: []}], responses: { 200: { description: Templates } } } } } */
adminTemplateRouter.get('/email', asyncHandler(adminTemplateController.listEmail.bind(adminTemplateController)));

/** @openapi { "/admin/templates/email/{key}": { put: { tags: [Admin Templates], summary: Create/update an email template, security: [{bearerAuth: []}], responses: { 200: { description: Saved } } } } } */
adminTemplateRouter.put(
  '/email/:key',
  validate({ params: templateKeyParamSchema, body: upsertEmailTemplateSchema }),
  asyncHandler(adminTemplateController.upsertEmail.bind(adminTemplateController)),
);

/** @openapi { "/admin/templates/email/{key}": { delete: { tags: [Admin Templates], summary: Delete an email template, security: [{bearerAuth: []}], responses: { 200: { description: Deleted } } } } } */
adminTemplateRouter.delete('/email/:key', validate({ params: templateKeyParamSchema }), asyncHandler(adminTemplateController.removeEmail.bind(adminTemplateController)));

/** @openapi { "/admin/templates/sms": { get: { tags: [Admin Templates], summary: List SMS templates, security: [{bearerAuth: []}], responses: { 200: { description: Templates } } } } } */
adminTemplateRouter.get('/sms', asyncHandler(adminTemplateController.listSms.bind(adminTemplateController)));

/** @openapi { "/admin/templates/sms/{key}": { put: { tags: [Admin Templates], summary: Create/update an SMS template, security: [{bearerAuth: []}], responses: { 200: { description: Saved } } } } } */
adminTemplateRouter.put(
  '/sms/:key',
  validate({ params: templateKeyParamSchema, body: upsertSmsTemplateSchema }),
  asyncHandler(adminTemplateController.upsertSms.bind(adminTemplateController)),
);

/** @openapi { "/admin/templates/sms/{key}": { delete: { tags: [Admin Templates], summary: Delete an SMS template, security: [{bearerAuth: []}], responses: { 200: { description: Deleted } } } } } */
adminTemplateRouter.delete('/sms/:key', validate({ params: templateKeyParamSchema }), asyncHandler(adminTemplateController.removeSms.bind(adminTemplateController)));
