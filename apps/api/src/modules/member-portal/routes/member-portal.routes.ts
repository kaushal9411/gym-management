import { Router } from 'express';

import { createRateLimiter } from '../../../core/middleware/rate-limiter';
import { validate } from '../../../core/middleware/validate.middleware';
import { memberAuthenticateMiddleware } from '../../member-auth/middlewares/member-authenticate.middleware';
import { memberChangePasswordSchema } from '../../member-auth/validators/member-auth.validators';
import { memberPortalController } from '../controllers/member-portal.controller';
import {
  memberDietLogSchema,
  memberInvoicePaymentParamSchema,
  memberNotificationsQuerySchema,
  memberPortalClassesQuerySchema,
  memberProfilePhotoSchema,
  memberProfileUpdateSchema,
  memberPortalIdParamSchema,
  memberPortalPaginationSchema,
  memberRegisterDeviceTokenSchema,
  memberRenewalPaymentParamSchema,
  memberUnregisterDeviceTokenSchema,
  memberVerifyInvoicePaymentSchema,
  memberVerifyRenewalCheckoutSchema,
  memberWorkoutProgressSchema,
} from '../validators/member-portal.validators';

export const memberPortalRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

// Per-member throttle for the profile write routes (keyed on the token's member id, never the body).
const profileWriteLimiter = () =>
  createRateLimiter({
    windowMs: 15 * 60_000,
    max: 30,
    prefix: 'member-profile-write',
    keyGenerator: (req) => `${req.tenant?.id ?? 'platform'}:${req.memberAuth?.sub ?? req.ip}`,
  });

// Router-level gate — every route below requires a valid member-audience
// token, same "one line covers the whole module" pattern as the AI
// assistant module's `requirePermission('ai:use')` at router level. No
// permission-key catalog entries needed — the member auth plane has no RBAC.
memberPortalRouter.use(memberAuthenticateMiddleware);

/**
 * @openapi
 * /portal/overview:
 *   get:
 *     tags: [Member Portal]
 *     summary: Dashboard aggregate for the authenticated member (membership, attendance, workout, diet, billing, classes, unread count)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Member overview }
 * /portal/payments:
 *   get:
 *     tags: [Member Portal]
 *     summary: The authenticated member's own payments, paginated (limit up to 100)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ items, total, page, limit, totalPages }" }
 * /portal/invoices/{id}:
 *   get:
 *     tags: [Member Portal]
 *     summary: Own invoice detail with items, payments, paid and balance — 404 for another member's invoice
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Invoice detail }
 *       404: { description: Not found or not owned }
 * /portal/gym:
 *   get:
 *     tags: [Member Portal]
 *     summary: Public-safe gym contact info, business hours and the member's own branch
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Gym info }
 */
memberPortalRouter.get('/overview', asyncHandler(memberPortalController.overview.bind(memberPortalController)));
memberPortalRouter.get('/gym', asyncHandler(memberPortalController.gym.bind(memberPortalController)));
memberPortalRouter.get(
  '/payments',
  validate({ query: memberPortalPaginationSchema }),
  asyncHandler(memberPortalController.payments.bind(memberPortalController)),
);
memberPortalRouter.get('/me', asyncHandler(memberPortalController.me.bind(memberPortalController)));
memberPortalRouter.get('/gdpr-export', asyncHandler(memberPortalController.gdprExport.bind(memberPortalController)));
memberPortalRouter.post(
  '/change-password',
  validate({ body: memberChangePasswordSchema }),
  asyncHandler(memberPortalController.changePassword.bind(memberPortalController)),
);

memberPortalRouter.post(
  '/membership/renew/checkout',
  asyncHandler(memberPortalController.startRenewalCheckout.bind(memberPortalController)),
);
memberPortalRouter.post(
  '/membership/renew/checkout/:paymentId/verify',
  validate({ params: memberRenewalPaymentParamSchema, body: memberVerifyRenewalCheckoutSchema }),
  asyncHandler(memberPortalController.verifyRenewalCheckout.bind(memberPortalController)),
);

memberPortalRouter.get(
  '/attendance',
  validate({ query: memberPortalPaginationSchema }),
  asyncHandler(memberPortalController.attendance.bind(memberPortalController)),
);

memberPortalRouter.get('/workout', asyncHandler(memberPortalController.workout.bind(memberPortalController)));
memberPortalRouter.post(
  '/workout/:id/progress',
  validate({ params: memberPortalIdParamSchema, body: memberWorkoutProgressSchema }),
  asyncHandler(memberPortalController.markWorkoutProgress.bind(memberPortalController)),
);

memberPortalRouter.get('/diet', asyncHandler(memberPortalController.diet.bind(memberPortalController)));
memberPortalRouter.post(
  '/diet/:id/log',
  validate({ params: memberPortalIdParamSchema, body: memberDietLogSchema }),
  asyncHandler(memberPortalController.logDiet.bind(memberPortalController)),
);

memberPortalRouter.get('/measurements', asyncHandler(memberPortalController.measurements.bind(memberPortalController)));

memberPortalRouter.get(
  '/invoices',
  validate({ query: memberPortalPaginationSchema }),
  asyncHandler(memberPortalController.invoices.bind(memberPortalController)),
);
memberPortalRouter.get(
  '/invoices/:id',
  validate({ params: memberPortalIdParamSchema }),
  asyncHandler(memberPortalController.invoiceDetail.bind(memberPortalController)),
);
memberPortalRouter.get(
  '/invoices/:id/download',
  validate({ params: memberPortalIdParamSchema }),
  asyncHandler(memberPortalController.downloadInvoice.bind(memberPortalController)),
);
memberPortalRouter.post(
  '/invoices/:id/pay/checkout',
  validate({ params: memberPortalIdParamSchema }),
  asyncHandler(memberPortalController.startInvoicePaymentCheckout.bind(memberPortalController)),
);
memberPortalRouter.post(
  '/invoices/:id/pay/checkout/:paymentId/verify',
  validate({ params: memberInvoicePaymentParamSchema, body: memberVerifyInvoicePaymentSchema }),
  asyncHandler(memberPortalController.verifyInvoicePaymentCheckout.bind(memberPortalController)),
);

memberPortalRouter.get(
  '/classes',
  validate({ query: memberPortalClassesQuerySchema }),
  asyncHandler(memberPortalController.classes.bind(memberPortalController)),
);
memberPortalRouter.get('/bookings', asyncHandler(memberPortalController.myBookings.bind(memberPortalController)));
memberPortalRouter.post(
  '/classes/:id/book',
  validate({ params: memberPortalIdParamSchema }),
  asyncHandler(memberPortalController.bookClass.bind(memberPortalController)),
);
memberPortalRouter.post(
  '/bookings/:id/cancel',
  validate({ params: memberPortalIdParamSchema }),
  asyncHandler(memberPortalController.cancelBooking.bind(memberPortalController)),
);

memberPortalRouter.post(
  '/device-token',
  validate({ body: memberRegisterDeviceTokenSchema }),
  asyncHandler(memberPortalController.registerDeviceToken.bind(memberPortalController)),
);
memberPortalRouter.delete(
  '/device-token',
  validate({ body: memberUnregisterDeviceTokenSchema }),
  asyncHandler(memberPortalController.unregisterDeviceToken.bind(memberPortalController)),
);

memberPortalRouter.get(
  '/notifications',
  validate({ query: memberNotificationsQuerySchema }),
  asyncHandler(memberPortalController.notifications.bind(memberPortalController)),
);
memberPortalRouter.get(
  '/notifications/unread-count',
  asyncHandler(memberPortalController.unreadNotificationCount.bind(memberPortalController)),
);
memberPortalRouter.post(
  '/notifications/read-all',
  asyncHandler(memberPortalController.markAllNotificationsRead.bind(memberPortalController)),
);
memberPortalRouter.post(
  '/notifications/:id/read',
  validate({ params: memberPortalIdParamSchema }),
  asyncHandler(memberPortalController.markNotificationRead.bind(memberPortalController)),
);

/**
 * @openapi
 * /portal/profile:
 *   get:
 *     tags: [Member Portal]
 *     summary: Own self-service profile (editable fields + read-only locked block + editable key list)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Member profile }
 *   patch:
 *     tags: [Member Portal]
 *     summary: Update whitelisted own profile fields (strict — unknown/locked keys are 422). Email change needs currentPassword.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, additionalProperties: false }
 *     responses:
 *       200: { description: Updated profile }
 *       409: { description: Email or phone already in use }
 *       422: { description: Validation failed / wrong password }
 * /portal/profile/photo:
 *   post:
 *     tags: [Member Portal]
 *     summary: Upload or replace own profile photo (base64 data-URL; JPEG/PNG/WebP only, ~700 KB max)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [image], properties: { image: { type: string } } }
 *     responses:
 *       200: { description: "{ profilePhotoUrl }" }
 *       422: { description: Bad type or too large }
 *   delete:
 *     tags: [Member Portal]
 *     summary: Remove own profile photo
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Removed }
 */
memberPortalRouter.get('/profile', asyncHandler(memberPortalController.getProfile.bind(memberPortalController)));
memberPortalRouter.patch(
  '/profile',
  profileWriteLimiter(),
  validate({ body: memberProfileUpdateSchema }),
  asyncHandler(memberPortalController.updateProfile.bind(memberPortalController)),
);
memberPortalRouter.post(
  '/profile/photo',
  profileWriteLimiter(),
  validate({ body: memberProfilePhotoSchema }),
  asyncHandler(memberPortalController.uploadProfilePhoto.bind(memberPortalController)),
);
memberPortalRouter.delete(
  '/profile/photo',
  profileWriteLimiter(),
  asyncHandler(memberPortalController.removeProfilePhoto.bind(memberPortalController)),
);
