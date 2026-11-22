import { Router } from 'express';

import { createRateLimiter } from '../../../core/middleware/rate-limiter';
import { validate } from '../../../core/middleware/validate.middleware';
import { memberPreferenceRouter } from '../../communications/routes/member-preference.routes';
import { memberAuthenticateMiddleware } from '../../member-auth/middlewares/member-authenticate.middleware';
import { memberChangePasswordSchema } from '../../member-auth/validators/member-auth.validators';
import { requireModuleEnabled } from '../../tenants/middleware/require-module-enabled.middleware';
import { memberPortalController } from '../controllers/member-portal.controller';
import {
  memberCreateMeasurementSchema,
  memberUpdateMeasurementSchema,
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

import { memberWorkoutLogRouter } from './member-workout-log.routes';

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

// Per-member throttle for the diet log route (water quick-add taps are frequent, so the cap is generous).
const dietWriteLimiter = () =>
  createRateLimiter({
    windowMs: 15 * 60_000,
    max: 120,
    prefix: 'member-diet-write',
    keyGenerator: (req) => `${req.tenant?.id ?? 'platform'}:${req.memberAuth?.sub ?? req.ip}`,
  });

// Per-member throttle for the body-measurement write routes (keyed on the token's member id, never the body).
const measurementWriteLimiter = () =>
  createRateLimiter({
    windowMs: 15 * 60_000,
    max: 60,
    prefix: 'member-measurement-write',
    keyGenerator: (req) => `${req.tenant?.id ?? 'platform'}:${req.memberAuth?.sub ?? req.ip}`,
  });

// Router-level gate — every route below requires a valid member-audience
// token, same "one line covers the whole module" pattern as the AI
// assistant module's `requirePermission('ai:use')` at router level. No
// permission-key catalog entries needed — the member auth plane has no RBAC.
memberPortalRouter.use(memberAuthenticateMiddleware);

// Module kill switch (plan-granted AND platform FeatureFlag.enabled) — same `requireModuleEnabled` the staff routers use;
// `req.tenant.featureFlags` is set by the global `tenantMiddleware` (it runs before this router and the token's tenant is
// checked against it above). Applied per route group, AFTER member auth (so an unauthenticated caller still gets 401) and
// BEFORE validation/handlers. Profile, plan, gym, me, gdpr-export, measurements, change-password stay ungated (no flag owns them).
const workoutGate = requireModuleEnabled('workout_plans');
const dietGate = requireModuleEnabled('diet_plans');
const classesGate = requireModuleEnabled('live_classes');
const attendanceGate = requireModuleEnabled('attendance');
const paymentsGate = requireModuleEnabled('payments');
const notificationsGate = requireModuleEnabled('notifications');

/**
 * @openapi
 * /portal/overview:
 *   get:
 *     tags: [Member Portal]
 *     summary: Dashboard aggregate for the authenticated member (membership, attendance, workout, diet, billing, classes, unread count)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Member overview }
 * /portal/plan:
 *   get:
 *     tags: [Member Portal]
 *     summary: "The authenticated member current plan and everything it includes (gym access, PT, classes, diet, locker, guest passes, freeze) with usage vs quota; data is null without a membership"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Plan benefits }
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
memberPortalRouter.get('/plan', asyncHandler(memberPortalController.plan.bind(memberPortalController)));
memberPortalRouter.get('/gym', asyncHandler(memberPortalController.gym.bind(memberPortalController)));
memberPortalRouter.get(
  '/payments',
  paymentsGate,
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
  paymentsGate,
  asyncHandler(memberPortalController.startRenewalCheckout.bind(memberPortalController)),
);
memberPortalRouter.post(
  '/membership/renew/checkout/:paymentId/verify',
  paymentsGate,
  validate({ params: memberRenewalPaymentParamSchema, body: memberVerifyRenewalCheckoutSchema }),
  asyncHandler(memberPortalController.verifyRenewalCheckout.bind(memberPortalController)),
);

memberPortalRouter.get(
  '/attendance',
  attendanceGate,
  validate({ query: memberPortalPaginationSchema }),
  asyncHandler(memberPortalController.attendance.bind(memberPortalController)),
);

memberPortalRouter.get('/workout', workoutGate, asyncHandler(memberPortalController.workout.bind(memberPortalController)));
// Daily workout log (member self-tracking) - own file, see member-workout-log.routes.ts
memberPortalRouter.use('/workout/log', workoutGate, memberWorkoutLogRouter);
// Promotional opt-out per channel (Communications) - own file, see communications/routes/member-preference.routes.ts
memberPortalRouter.use('/notification-preferences', notificationsGate, memberPreferenceRouter);
memberPortalRouter.post(
  '/workout/:id/progress',
  workoutGate,
  validate({ params: memberPortalIdParamSchema, body: memberWorkoutProgressSchema }),
  asyncHandler(memberPortalController.markWorkoutProgress.bind(memberPortalController)),
);

memberPortalRouter.get('/diet', dietGate, asyncHandler(memberPortalController.diet.bind(memberPortalController)));
memberPortalRouter.post(
  '/diet/:id/log',
  dietGate,
  dietWriteLimiter(),
  validate({ params: memberPortalIdParamSchema, body: memberDietLogSchema }),
  asyncHandler(memberPortalController.logDiet.bind(memberPortalController)),
);

/**
 * @openapi
 * /portal/measurements:
 *   get:
 *     tags: [Member Portal]
 *     summary: Own body-measurement history, newest first (staff- and member-logged; each row carries `id` and `source` STAFF|MEMBER)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of measurements }
 *   post:
 *     tags: [Member Portal]
 *     summary: Log own measurement for a day (default today). One MEMBER entry per day - logging again on the same day merges into it (200) instead of duplicating (201 when new). At least one numeric value is required.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, additionalProperties: false, properties: { recordedAt: { type: string }, weightKg: { type: number }, heightCm: { type: number }, bodyFatPercent: { type: number }, chestCm: { type: number }, waistCm: { type: number }, hipsCm: { type: number }, bicepsCm: { type: number }, thighsCm: { type: number }, notes: { type: string } } }
 *     responses:
 *       200: { description: Existing same-day entry updated }
 *       201: { description: Entry created }
 *       422: { description: "Out-of-range value, no value, future date, or older than 365 days" }
 * /portal/measurements/{id}:
 *   patch:
 *     tags: [Member Portal]
 *     summary: Edit an entry the member logged themselves. Staff-recorded entries are 403; another member's entry is 404.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Updated entry }
 *       403: { description: Entry was recorded by staff }
 *       404: { description: Not found or not owned }
 *       409: { description: Another entry already exists on the target day }
 *   delete:
 *     tags: [Member Portal]
 *     summary: Delete an entry the member logged themselves (staff-recorded 403, others' 404)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Deleted }
 *       403: { description: Entry was recorded by staff }
 *       404: { description: Not found or not owned }
 */
memberPortalRouter.get('/measurements', asyncHandler(memberPortalController.measurements.bind(memberPortalController)));
memberPortalRouter.post(
  '/measurements',
  measurementWriteLimiter(),
  validate({ body: memberCreateMeasurementSchema }),
  asyncHandler(memberPortalController.logMeasurement.bind(memberPortalController)),
);
memberPortalRouter.patch(
  '/measurements/:id',
  measurementWriteLimiter(),
  validate({ params: memberPortalIdParamSchema, body: memberUpdateMeasurementSchema }),
  asyncHandler(memberPortalController.updateMeasurement.bind(memberPortalController)),
);
memberPortalRouter.delete(
  '/measurements/:id',
  measurementWriteLimiter(),
  validate({ params: memberPortalIdParamSchema }),
  asyncHandler(memberPortalController.deleteMeasurement.bind(memberPortalController)),
);

memberPortalRouter.get(
  '/invoices',
  paymentsGate,
  validate({ query: memberPortalPaginationSchema }),
  asyncHandler(memberPortalController.invoices.bind(memberPortalController)),
);
memberPortalRouter.get(
  '/invoices/:id',
  paymentsGate,
  validate({ params: memberPortalIdParamSchema }),
  asyncHandler(memberPortalController.invoiceDetail.bind(memberPortalController)),
);
memberPortalRouter.get(
  '/invoices/:id/download',
  paymentsGate,
  validate({ params: memberPortalIdParamSchema }),
  asyncHandler(memberPortalController.downloadInvoice.bind(memberPortalController)),
);
memberPortalRouter.post(
  '/invoices/:id/pay/checkout',
  paymentsGate,
  validate({ params: memberPortalIdParamSchema }),
  asyncHandler(memberPortalController.startInvoicePaymentCheckout.bind(memberPortalController)),
);
memberPortalRouter.post(
  '/invoices/:id/pay/checkout/:paymentId/verify',
  paymentsGate,
  validate({ params: memberInvoicePaymentParamSchema, body: memberVerifyInvoicePaymentSchema }),
  asyncHandler(memberPortalController.verifyInvoicePaymentCheckout.bind(memberPortalController)),
);

memberPortalRouter.get(
  '/classes',
  classesGate,
  validate({ query: memberPortalClassesQuerySchema }),
  asyncHandler(memberPortalController.classes.bind(memberPortalController)),
);
memberPortalRouter.get('/bookings', classesGate, asyncHandler(memberPortalController.myBookings.bind(memberPortalController)));
memberPortalRouter.post(
  '/classes/:id/book',
  classesGate,
  validate({ params: memberPortalIdParamSchema }),
  asyncHandler(memberPortalController.bookClass.bind(memberPortalController)),
);
memberPortalRouter.post(
  '/bookings/:id/cancel',
  classesGate,
  validate({ params: memberPortalIdParamSchema }),
  asyncHandler(memberPortalController.cancelBooking.bind(memberPortalController)),
);

// Push tokens belong to the notifications module: with it off the token registration 403s like the rest (the apps treat
// push registration as best-effort and swallow the error, so a disabled module never blocks login).
memberPortalRouter.post(
  '/device-token',
  notificationsGate,
  validate({ body: memberRegisterDeviceTokenSchema }),
  asyncHandler(memberPortalController.registerDeviceToken.bind(memberPortalController)),
);
memberPortalRouter.delete(
  '/device-token',
  notificationsGate,
  validate({ body: memberUnregisterDeviceTokenSchema }),
  asyncHandler(memberPortalController.unregisterDeviceToken.bind(memberPortalController)),
);

memberPortalRouter.get(
  '/notifications',
  notificationsGate,
  validate({ query: memberNotificationsQuerySchema }),
  asyncHandler(memberPortalController.notifications.bind(memberPortalController)),
);
memberPortalRouter.get(
  '/notifications/unread-count',
  notificationsGate,
  asyncHandler(memberPortalController.unreadNotificationCount.bind(memberPortalController)),
);
memberPortalRouter.post(
  '/notifications/read-all',
  notificationsGate,
  asyncHandler(memberPortalController.markAllNotificationsRead.bind(memberPortalController)),
);
memberPortalRouter.post(
  '/notifications/:id/read',
  notificationsGate,
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
