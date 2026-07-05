import { Router } from 'express';
import { z } from 'zod';

import { validate } from '../../../core/middleware/validate.middleware';
import { adminAuthenticateMiddleware } from '../../admin-auth/middlewares/admin-authenticate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { adminPaymentController } from '../controllers/admin-payment.controller';

export const adminPaymentRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

const listQuerySchema = z.object({
  status: z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
const paginationSchema = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(100).default(20) });
const paymentIdParamSchema = z.object({ paymentId: z.string().uuid() });

adminPaymentRouter.use(adminAuthenticateMiddleware, requireAdminPermission('payments:read'));

/** @openapi { "/admin/payments": { get: { tags: [Admin Payments], summary: Payment History (all tenants), security: [{bearerAuth: []}], responses: { 200: { description: Paginated payments } } } } } */
adminPaymentRouter.get('/', validate({ query: listQuerySchema }), asyncHandler(adminPaymentController.list.bind(adminPaymentController)));

/** @openapi { "/admin/payments/invoices": { get: { tags: [Admin Payments], summary: Invoices (all tenants), security: [{bearerAuth: []}], responses: { 200: { description: Paginated invoices } } } } } */
adminPaymentRouter.get('/invoices', validate({ query: paginationSchema }), asyncHandler(adminPaymentController.listInvoices.bind(adminPaymentController)));

/** @openapi { "/admin/payments/{paymentId}": { get: { tags: [Admin Payments], summary: Payment Details + transaction log, security: [{bearerAuth: []}], responses: { 200: { description: Payment detail } } } } } */
adminPaymentRouter.get('/:paymentId', validate({ params: paymentIdParamSchema }), asyncHandler(adminPaymentController.getById.bind(adminPaymentController)));
