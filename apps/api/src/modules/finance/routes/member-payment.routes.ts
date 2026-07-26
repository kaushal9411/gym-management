import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { memberPaymentController } from '../controllers/member-payment.controller';
import { createPaymentSchema, idParamSchema, listPaymentsQuerySchema, refundPaymentSchema, updatePaymentSchema } from '../validators/finance.validators';

export const memberPaymentRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

memberPaymentRouter.use(authenticateMiddleware);

/** @openapi { "/payments/export": { get: { tags: [Finance], summary: "Download filtered payment history as CSV", security: [{bearerAuth: []}], responses: { 200: { description: CSV file } } } } } */
memberPaymentRouter.get('/export', requirePermission('finance:view'), asyncHandler(memberPaymentController.exportCsv.bind(memberPaymentController)));

/** @openapi { "/payments/export/excel": { get: { tags: [Finance], summary: "Download filtered payment history as an Excel workbook", security: [{bearerAuth: []}], responses: { 200: { description: XLSX file } } } } } */
memberPaymentRouter.get('/export/excel', requirePermission('finance:view'), asyncHandler(memberPaymentController.exportExcel.bind(memberPaymentController)));

/**
 * @openapi
 * /payments:
 *   get:
 *     tags: [Finance]
 *     summary: Paginated payment history with search + filters (member, branch, method, status, date range)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ items, total, page, limit, totalPages }" }
 */
memberPaymentRouter.get('/', requirePermission('finance:view'), validate({ query: listPaymentsQuerySchema }), asyncHandler(memberPaymentController.list.bind(memberPaymentController)));

/** @openapi { "/payments": { post: { tags: [Finance], summary: "Record a payment — auto-generates an invoice on success unless invoiceId settles an existing one", security: [{bearerAuth: []}], responses: { 201: { description: Payment recorded } } } } } */
memberPaymentRouter.post(
  '/',
  requirePermission('finance:payment-create'),
  validate({ body: createPaymentSchema }),
  asyncHandler(memberPaymentController.create.bind(memberPaymentController)),
);

/** @openapi { "/payments/{id}": { get: { tags: [Finance], summary: "One payment's details, including its refund history", security: [{bearerAuth: []}], responses: { 200: { description: Payment } } } } } */
memberPaymentRouter.get(
  '/:id',
  requirePermission('finance:view'),
  validate({ params: idParamSchema }),
  asyncHandler(memberPaymentController.getById.bind(memberPaymentController)),
);

/** @openapi { "/payments/{id}": { patch: { tags: [Finance], summary: "Update a payment record", security: [{bearerAuth: []}], responses: { 200: { description: Payment updated } } } } } */
memberPaymentRouter.patch(
  '/:id',
  requirePermission('finance:payment-create'),
  validate({ params: idParamSchema, body: updatePaymentSchema }),
  asyncHandler(memberPaymentController.update.bind(memberPaymentController)),
);

/** @openapi { "/payments/{id}/cancel": { post: { tags: [Finance], summary: "Cancel a payment (not yet refunded)", security: [{bearerAuth: []}], responses: { 200: { description: Payment cancelled } } } } } */
memberPaymentRouter.post(
  '/:id/cancel',
  requirePermission('finance:payment-create'),
  validate({ params: idParamSchema }),
  asyncHandler(memberPaymentController.cancel.bind(memberPaymentController)),
);

/** @openapi { "/payments/{id}/verify": { post: { tags: [Finance], summary: "Verify a payment's current status (a stub seam for a future online gateway)", security: [{bearerAuth: []}], responses: { 200: { description: "{ status, verifiedAt }" } } } } } */
memberPaymentRouter.post(
  '/:id/verify',
  requirePermission('finance:view'),
  validate({ params: idParamSchema }),
  asyncHandler(memberPaymentController.verifyStatus.bind(memberPaymentController)),
);

/** @openapi { "/payments/{id}/refund": { post: { tags: [Finance], summary: "Refund a payment (full or partial) — creates a new refund history row", security: [{bearerAuth: []}], responses: { 200: { description: Refund recorded } } } } } */
memberPaymentRouter.post(
  '/:id/refund',
  requirePermission('finance:payment-refund'),
  validate({ params: idParamSchema, body: refundPaymentSchema }),
  asyncHandler(memberPaymentController.refund.bind(memberPaymentController)),
);
