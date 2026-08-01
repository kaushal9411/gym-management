import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { adminAuthenticateMiddleware } from '../../admin-auth/middlewares/admin-authenticate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { adminTenantBillingController } from '../controllers/admin-tenant-billing.controller';
import {
  changePlanBodySchema,
  createPaymentLinkBodySchema,
  emailInvoiceBodySchema,
  resendNotificationBodySchema,
  tenantBillingListQuerySchema,
  tenantInvoiceParamSchema,
  tenantPaymentParamSchema,
} from '../validators/admin-tenant-billing.validators';
import { tenantIdParamSchema } from '../validators/admin-tenant.validators';

export const adminTenantBillingRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

adminTenantBillingRouter.use(adminAuthenticateMiddleware);

/** @openapi { "/admin/tenants/{tenantId}/payments": { get: { tags: [Admin Tenants], summary: "Tenant's Platform Payment History", security: [{bearerAuth: []}], responses: { 200: { description: Paginated payments } } } } } */
adminTenantBillingRouter.get(
  '/:tenantId/payments',
  requireAdminPermission('tenants:read'),
  validate({ params: tenantIdParamSchema, query: tenantBillingListQuerySchema }),
  asyncHandler(adminTenantBillingController.payments.bind(adminTenantBillingController)),
);

/** @openapi { "/admin/tenants/{tenantId}/invoices": { get: { tags: [Admin Tenants], summary: "Tenant's Platform Invoices", security: [{bearerAuth: []}], responses: { 200: { description: Paginated invoices } } } } } */
adminTenantBillingRouter.get(
  '/:tenantId/invoices',
  requireAdminPermission('tenants:read'),
  validate({ params: tenantIdParamSchema, query: tenantBillingListQuerySchema }),
  asyncHandler(adminTenantBillingController.invoices.bind(adminTenantBillingController)),
);

/**
 * @openapi
 * /admin/tenants/{tenantId}/payment-link:
 *   post:
 *     tags: [Admin Tenants]
 *     summary: Send Razorpay Payment Link — creates/reuses one against the tenant's outstanding (or auto-generated) invoice
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ paymentId, invoiceId, shortUrl, status }" }
 */
adminTenantBillingRouter.post(
  '/:tenantId/payment-link',
  requireAdminPermission('payments:manage'),
  validate({ params: tenantIdParamSchema, body: createPaymentLinkBodySchema }),
  asyncHandler(adminTenantBillingController.createPaymentLink.bind(adminTenantBillingController)),
);

/**
 * @openapi
 * /admin/tenants/{tenantId}/subscription/change-plan:
 *   post:
 *     tags: [Admin Tenants]
 *     summary: Upgrade/Downgrade/Assign Plan — manual admin override or a real Razorpay payment link
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "manual mode -> updated Subscription; payment_link mode -> { paymentId, invoiceId, shortUrl, status }" }
 */
adminTenantBillingRouter.post(
  '/:tenantId/subscription/change-plan',
  requireAdminPermission('payments:manage'),
  validate({ params: tenantIdParamSchema, body: changePlanBodySchema }),
  asyncHandler(adminTenantBillingController.changePlan.bind(adminTenantBillingController)),
);

/** @openapi { "/admin/tenants/{tenantId}/payments/{paymentId}/verify": { post: { tags: [Admin Tenants], summary: Check Payment Link Status, security: [{bearerAuth: []}], responses: { 200: { description: "{ status }" } } } } } */
adminTenantBillingRouter.post(
  '/:tenantId/payments/:paymentId/verify',
  requireAdminPermission('payments:manage'),
  validate({ params: tenantPaymentParamSchema }),
  asyncHandler(adminTenantBillingController.verifyPaymentStatus.bind(adminTenantBillingController)),
);

/** @openapi { "/admin/tenants/{tenantId}/payments/{paymentId}/resend-notification": { post: { tags: [Admin Tenants], summary: Resend Payment Link Notification, security: [{bearerAuth: []}], responses: { 200: { description: Resent } } } } } */
adminTenantBillingRouter.post(
  '/:tenantId/payments/:paymentId/resend-notification',
  requireAdminPermission('payments:manage'),
  validate({ params: tenantPaymentParamSchema, body: resendNotificationBodySchema }),
  asyncHandler(adminTenantBillingController.resendNotification.bind(adminTenantBillingController)),
);

/** @openapi { "/admin/tenants/{tenantId}/invoices/{invoiceId}/download": { get: { tags: [Admin Tenants], summary: Download Invoice PDF, security: [{bearerAuth: []}], responses: { 200: { description: PDF binary } } } } } */
adminTenantBillingRouter.get(
  '/:tenantId/invoices/:invoiceId/download',
  requireAdminPermission('tenants:read'),
  validate({ params: tenantInvoiceParamSchema }),
  asyncHandler(adminTenantBillingController.downloadInvoicePdf.bind(adminTenantBillingController)),
);

/** @openapi { "/admin/tenants/{tenantId}/invoices/{invoiceId}/email": { post: { tags: [Admin Tenants], summary: Email Invoice/Receipt to Tenant, security: [{bearerAuth: []}], responses: { 200: { description: Emailed } } } } } */
adminTenantBillingRouter.post(
  '/:tenantId/invoices/:invoiceId/email',
  requireAdminPermission('payments:manage'),
  validate({ params: tenantInvoiceParamSchema, body: emailInvoiceBodySchema }),
  asyncHandler(adminTenantBillingController.emailInvoice.bind(adminTenantBillingController)),
);
