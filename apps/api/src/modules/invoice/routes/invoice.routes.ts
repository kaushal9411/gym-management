import { Router } from 'express';

import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { invoiceController } from '../controllers/invoice.controller';

export const invoiceRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

/**
 * @openapi
 * /invoice:
 *   get:
 *     tags: [Invoice]
 *     summary: Invoice List — every invoice for the current tenant
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of invoices, most recent first }
 */
invoiceRouter.get('/', authenticateMiddleware, requirePermission('billing:read'), asyncHandler(invoiceController.list.bind(invoiceController)));

/**
 * @openapi
 * /invoice/{id}/download:
 *   get:
 *     tags: [Invoice]
 *     summary: Invoice Download — printable HTML document for one invoice
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: HTML invoice document }
 *       404: { description: Invoice not found }
 */
invoiceRouter.get(
  '/:id/download',
  authenticateMiddleware,
  requirePermission('billing:read'),
  asyncHandler(invoiceController.download.bind(invoiceController)),
);
