import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { memberInvoiceController } from '../controllers/member-invoice.controller';
import { emailInvoiceSchema, generateInvoiceSchema, idParamSchema, listInvoicesQuerySchema } from '../validators/finance.validators';

export const memberInvoiceRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

memberInvoiceRouter.use(authenticateMiddleware);

/**
 * @openapi
 * /invoices:
 *   get:
 *     tags: [Finance]
 *     summary: Paginated invoice list with search + filters (member, branch, status, date range)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ items, total, page, limit, totalPages }" }
 */
memberInvoiceRouter.get(
  '/',
  requirePermission('finance:invoice-view'),
  validate({ query: listInvoicesQuerySchema }),
  asyncHandler(memberInvoiceController.list.bind(memberInvoiceController)),
);

/** @openapi { "/invoices": { post: { tags: [Finance], summary: "Manually generate an invoice (e.g. billing an upcoming renewal in advance)", security: [{bearerAuth: []}], responses: { 201: { description: Invoice generated } } } } } */
memberInvoiceRouter.post(
  '/',
  requirePermission('finance:payment-create'),
  validate({ body: generateInvoiceSchema }),
  asyncHandler(memberInvoiceController.generate.bind(memberInvoiceController)),
);

/** @openapi { "/invoices/{id}": { get: { tags: [Finance], summary: "One invoice's details, including its line items and settling payments", security: [{bearerAuth: []}], responses: { 200: { description: Invoice } } } } } */
memberInvoiceRouter.get(
  '/:id',
  requirePermission('finance:invoice-view'),
  validate({ params: idParamSchema }),
  asyncHandler(memberInvoiceController.getById.bind(memberInvoiceController)),
);

/** @openapi { "/invoices/{id}/download": { get: { tags: [Finance], summary: "Download the invoice as a PDF", security: [{bearerAuth: []}], responses: { 200: { description: PDF file } } } } } */
memberInvoiceRouter.get(
  '/:id/download',
  requirePermission('finance:invoice-download'),
  validate({ params: idParamSchema }),
  asyncHandler(memberInvoiceController.downloadPdf.bind(memberInvoiceController)),
);

/** @openapi { "/invoices/{id}/email": { post: { tags: [Finance], summary: "Email the invoice to the member (or an override address)", security: [{bearerAuth: []}], responses: { 200: { description: Invoice emailed } } } } } */
memberInvoiceRouter.post(
  '/:id/email',
  requirePermission('finance:invoice-download'),
  validate({ params: idParamSchema, body: emailInvoiceSchema }),
  asyncHandler(memberInvoiceController.email.bind(memberInvoiceController)),
);
