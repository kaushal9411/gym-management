import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { adminAuthenticateMiddleware } from '../../admin-auth/middlewares/admin-authenticate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { adminPaymentGatewaysController } from '../controllers/admin-payment-gateways.controller';
import { testRazorpayGatewaySchema, upsertRazorpayGatewaySchema } from '../validators/admin-payment-gateways.validators';

export const adminPaymentGatewaysRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

// Same permission the neighbouring admin settings routes use (`/admin/settings`, `/admin/ai/settings`) — the admin
// permission catalogue has no separate "settings:read", and these credentials are sensitive even masked.
adminPaymentGatewaysRouter.use(adminAuthenticateMiddleware, requireAdminPermission('settings:manage'));

/** @openapi { "/admin/payment-gateways/razorpay": { get: { tags: [Admin Payment Gateways], summary: "Razorpay credential status - secrets never returned (source, mode, key id, last 4 of secret, webhook URL)", security: [{bearerAuth: []}], responses: { 200: { description: Razorpay gateway view } } } } } */
adminPaymentGatewaysRouter.get('/razorpay', asyncHandler(adminPaymentGatewaysController.getRazorpay.bind(adminPaymentGatewaysController)));

/** @openapi { "/admin/payment-gateways/razorpay": { put: { tags: [Admin Payment Gateways], summary: "Save Razorpay credentials (secrets encrypted; omit keySecret/webhookSecret to keep the stored ones)", security: [{bearerAuth: []}], responses: { 200: { description: Razorpay gateway view }, 422: { description: Validation error } } } } } */
adminPaymentGatewaysRouter.put(
  '/razorpay',
  validate({ body: upsertRazorpayGatewaySchema }),
  asyncHandler(adminPaymentGatewaysController.upsertRazorpay.bind(adminPaymentGatewaysController)),
);

/** @openapi { "/admin/payment-gateways/razorpay/test": { post: { tags: [Admin Payment Gateways], summary: "Test Razorpay credentials with a read-only API call (optionally with unsaved overrides)", security: [{bearerAuth: []}], responses: { 200: { description: "ok, mode and message" } } } } } */
adminPaymentGatewaysRouter.post(
  '/razorpay/test',
  validate({ body: testRazorpayGatewaySchema }),
  asyncHandler(adminPaymentGatewaysController.testRazorpay.bind(adminPaymentGatewaysController)),
);

/** @openapi { "/admin/payment-gateways/razorpay": { delete: { tags: [Admin Payment Gateways], summary: "Remove the stored Razorpay credentials (falls back to the environment configuration)", security: [{bearerAuth: []}], responses: { 200: { description: Razorpay gateway view } } } } } */
adminPaymentGatewaysRouter.delete('/razorpay', asyncHandler(adminPaymentGatewaysController.removeRazorpay.bind(adminPaymentGatewaysController)));
