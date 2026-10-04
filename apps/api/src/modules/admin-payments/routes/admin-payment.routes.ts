import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { adminAuthenticateMiddleware } from '../../admin-auth/middlewares/admin-authenticate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { adminPaymentController } from '../controllers/admin-payment.controller';
import {
  invoiceIdParamSchema,
  invoiceListQuerySchema,
  paymentExportQuerySchema,
  paymentIdParamSchema,
  paymentListQuerySchema,
  paymentOverviewQuerySchema,
} from '../validators/admin-payment.validators';

export const adminPaymentRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

adminPaymentRouter.use(adminAuthenticateMiddleware, requireAdminPermission('payments:read'));

/**
 * @openapi
 * /admin/payments:
 *   get:
 *     tags: [Admin Payments]
 *     summary: "Payment history (all tenants) — filters provider/tenant/from/to (paidAt, else createdAt)/minAmount/maxAmount/currency/mode/status, sort; adds counts (ignore status filter) and summary (full filtered set)"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [PENDING, SUCCEEDED, FAILED, REFUNDED, PARTIALLY_REFUNDED] } }
 *       - { in: query, name: provider, schema: { type: string, enum: [STRIPE, RAZORPAY, PAYPAL, MANUAL] } }
 *       - { in: query, name: tenant, schema: { type: string } }
 *       - { in: query, name: from, schema: { type: string, format: date } }
 *       - { in: query, name: to, schema: { type: string, format: date } }
 *       - { in: query, name: minAmount, schema: { type: number } }
 *       - { in: query, name: maxAmount, schema: { type: number } }
 *       - { in: query, name: currency, schema: { type: string } }
 *       - { in: query, name: mode, schema: { type: string, enum: [CASH, BANK_TRANSFER, UPI, CHEQUE, CARD, OTHER] } }
 *       - { in: query, name: sort, schema: { type: string, enum: [createdAt, amount, paidAt] } }
 *       - { in: query, name: sortDir, schema: { type: string, enum: [asc, desc] } }
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: limit, schema: { type: integer } }
 *     responses:
 *       200: { description: "Paginated payments + counts + summary" }
 */
adminPaymentRouter.get(
  '/',
  validate({ query: paymentListQuerySchema }),
  asyncHandler(adminPaymentController.list.bind(adminPaymentController)),
);

/**
 * @openapi
 * /admin/payments/overview:
 *   get:
 *     tags: [Admin Payments]
 *     summary: "Payments page payload — KPIs with previous-period deltas, daily series, provider/mode splits, status mix, failure reasons, stuck PENDING, recent failures"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: range, schema: { type: string, enum: [30d, 90d, 12m], default: 30d } }
 *     responses:
 *       200: { description: Overview payload }
 *       422: { description: Invalid range }
 */
adminPaymentRouter.get(
  '/overview',
  validate({ query: paymentOverviewQuerySchema }),
  asyncHandler(adminPaymentController.overview.bind(adminPaymentController)),
);

/**
 * @openapi
 * /admin/payments/export:
 *   get:
 *     tags: [Admin Payments]
 *     summary: "Export payments as CSV (same filters as the list; 10,000-row cap; formula-injection safe; audited admin.payments_exported)"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: text/csv attachment }
 */
adminPaymentRouter.get(
  '/export',
  validate({ query: paymentExportQuerySchema }),
  asyncHandler(adminPaymentController.export.bind(adminPaymentController)),
);

/**
 * @openapi
 * /admin/payments/invoices:
 *   get:
 *     tags: [Admin Payments]
 *     summary: "Invoices (all tenants) — filters status/tenant/from/to (issue date)/overdue/minAmount/maxAmount/currency, sort; adds counts and summary"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [DRAFT, OPEN, PAID, VOID, UNCOLLECTIBLE] } }
 *       - { in: query, name: tenant, schema: { type: string } }
 *       - { in: query, name: from, schema: { type: string, format: date } }
 *       - { in: query, name: to, schema: { type: string, format: date } }
 *       - { in: query, name: overdue, schema: { type: boolean } }
 *       - { in: query, name: minAmount, schema: { type: number } }
 *       - { in: query, name: maxAmount, schema: { type: number } }
 *       - { in: query, name: currency, schema: { type: string } }
 *       - { in: query, name: sort, schema: { type: string, enum: [createdAt, total, dueDate] } }
 *       - { in: query, name: sortDir, schema: { type: string, enum: [asc, desc] } }
 *     responses:
 *       200: { description: "Paginated invoices + counts + summary" }
 */
adminPaymentRouter.get(
  '/invoices',
  validate({ query: invoiceListQuerySchema }),
  asyncHandler(adminPaymentController.listInvoices.bind(adminPaymentController)),
);

/** @openapi { "/admin/payments/invoices/{invoiceId}": { get: { tags: [Admin Payments], summary: "Invoice detail - items, tenant, coupon, payments, subscription", security: [{bearerAuth: []}], responses: { 200: { description: Invoice detail }, 404: { description: Unknown invoice } } } } } */
adminPaymentRouter.get(
  '/invoices/:invoiceId',
  validate({ params: invoiceIdParamSchema }),
  asyncHandler(adminPaymentController.getInvoice.bind(adminPaymentController)),
);

/** @openapi { "/admin/payments/{paymentId}": { get: { tags: [Admin Payments], summary: "Payment detail + masked transaction log + status timeline", security: [{bearerAuth: []}], responses: { 200: { description: Payment detail } } } } } */
adminPaymentRouter.get(
  '/:paymentId',
  validate({ params: paymentIdParamSchema }),
  asyncHandler(adminPaymentController.getById.bind(adminPaymentController)),
);
