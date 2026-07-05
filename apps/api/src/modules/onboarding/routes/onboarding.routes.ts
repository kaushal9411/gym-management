import { Router } from 'express';

import { createRateLimiter } from '../../../core/middleware/rate-limiter';
import { validate } from '../../../core/middleware/validate.middleware';
import { onboardingController } from '../controllers/onboarding.controller';
import {
  checkSubdomainSchema,
  createTenantSchema,
  onboardingStatusSchema,
  paymentSchema,
  registerOnboardingSchema,
  selectPlanSchema,
  sendOtpSchema,
  verifyOtpSchema,
} from '../validators/onboarding.validators';

export const onboardingRouter: Router = Router();

/**
 * Close the TCP connection after every onboarding response instead of
 * keeping it alive. Endpoint-security/antivirus software on some developer
 * machines proxies browser HTTP traffic and buffers keep-alive responses
 * for scanning — observed in the field as the create-tenant response being
 * fully visible in DevTools yet never delivered to page JavaScript (the
 * same request via curl, which such tools don't intercept, always resolved
 * instantly). Closing the socket forces those interceptors to flush.
 * Costs one extra TCP handshake per step of a once-per-tenant wizard.
 */
onboardingRouter.use((_req, res, next) => {
  res.setHeader('Connection', 'close');
  next();
});

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

const registerRateLimiter = () => createRateLimiter({ windowMs: 60 * 60_000, max: 5, prefix: 'onboard-register' });
const otpRateLimiter = () =>
  createRateLimiter({
    windowMs: 60_000,
    max: 3,
    prefix: 'onboard-otp',
    keyGenerator: (req) => `${req.ip}:${String(req.body?.sessionId ?? '')}`,
  });
const subdomainCheckRateLimiter = () => createRateLimiter({ windowMs: 60_000, max: 30, prefix: 'onboard-subdomain' });

/**
 * @openapi
 * /onboarding/plans:
 *   get:
 *     tags: [Onboarding]
 *     summary: List active subscription plans (for the plan-selection wizard step)
 *     responses:
 *       200: { description: Active plans with features and limits }
 */
onboardingRouter.get('/plans', asyncHandler(onboardingController.listPlans.bind(onboardingController)));

/**
 * @openapi
 * /onboarding/check-subdomain:
 *   get:
 *     tags: [Onboarding]
 *     summary: Live subdomain availability check, with suggestions if taken
 *     parameters:
 *       - in: query
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "{ slug, available, reason?, suggestions[] }" }
 */
onboardingRouter.get(
  '/check-subdomain',
  subdomainCheckRateLimiter(),
  validate({ query: checkSubdomainSchema }),
  asyncHandler(onboardingController.checkSubdomain.bind(onboardingController)),
);

/**
 * @openapi
 * /onboarding/register:
 *   post:
 *     tags: [Onboarding]
 *     summary: Step 2 — submit the registration form, creating a wizard session and sending an OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [gymName, ownerFirstName, ownerLastName, email, mobile, country, state, city, timezone, currency, password, confirmPassword, acceptTerms, acceptPrivacyPolicy, captchaToken]
 *             properties:
 *               gymName: { type: string }
 *               ownerFirstName: { type: string }
 *               ownerLastName: { type: string }
 *               email: { type: string, format: email }
 *               mobile: { type: string }
 *               country: { type: string }
 *               state: { type: string }
 *               city: { type: string }
 *               timezone: { type: string }
 *               currency: { type: string, example: USD }
 *               password: { type: string, format: password }
 *               confirmPassword: { type: string, format: password }
 *               acceptTerms: { type: boolean }
 *               acceptPrivacyPolicy: { type: boolean }
 *               captchaToken: { type: string }
 *     responses:
 *       201: { description: "{ sessionId, maskedEmail }" }
 *       409: { description: "Duplicate email, mobile, or gym name" }
 *       429: { $ref: '#/components/responses/RateLimited' }
 */
onboardingRouter.post(
  '/register',
  registerRateLimiter(),
  validate({ body: registerOnboardingSchema }),
  asyncHandler(onboardingController.register.bind(onboardingController)),
);

/**
 * @openapi
 * /onboarding/send-otp:
 *   post:
 *     tags: [Onboarding]
 *     summary: Resend the email verification OTP for a wizard session
 *     requestBody:
 *       content: { application/json: { schema: { type: object, required: [sessionId], properties: { sessionId: { type: string, format: uuid } } } } }
 *     responses:
 *       200: { description: Code resent }
 */
onboardingRouter.post(
  '/send-otp',
  otpRateLimiter(),
  validate({ body: sendOtpSchema }),
  asyncHandler(onboardingController.sendOtp.bind(onboardingController)),
);

/**
 * @openapi
 * /onboarding/verify-otp:
 *   post:
 *     tags: [Onboarding]
 *     summary: Step 5 — verify the OTP sent to the registrant's email
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId, code]
 *             properties: { sessionId: { type: string, format: uuid }, code: { type: string, example: "123456" } }
 *     responses:
 *       200: { description: Email verified }
 *       401: { description: "Code invalid or expired" }
 */
onboardingRouter.post(
  '/verify-otp',
  otpRateLimiter(),
  validate({ body: verifyOtpSchema }),
  asyncHandler(onboardingController.verifyOtp.bind(onboardingController)),
);

/**
 * @openapi
 * /onboarding/select-plan:
 *   post:
 *     tags: [Onboarding]
 *     summary: Step 3 — choose a subscription plan and billing cycle
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId, planSlug, billingCycle]
 *             properties:
 *               sessionId: { type: string, format: uuid }
 *               planSlug: { type: string, example: professional }
 *               billingCycle: { type: string, enum: [MONTHLY, YEARLY] }
 *     responses:
 *       200: { description: Plan selected }
 */
onboardingRouter.post(
  '/select-plan',
  validate({ body: selectPlanSchema }),
  asyncHandler(onboardingController.selectPlan.bind(onboardingController)),
);

/**
 * @openapi
 * /onboarding/payment:
 *   post:
 *     tags: [Onboarding]
 *     summary: Step 6 — charge the selected plan (skip this call entirely for trial-eligible plans)
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId, provider, paymentToken]
 *             properties:
 *               sessionId: { type: string, format: uuid }
 *               provider: { type: string, enum: [stripe, razorpay, paypal] }
 *               paymentToken: { type: string }
 *     responses:
 *       200: { description: "{ paymentReference }" }
 *       402: { description: Payment failed }
 */
onboardingRouter.post(
  '/payment',
  validate({ body: paymentSchema }),
  asyncHandler(onboardingController.pay.bind(onboardingController)),
);

/**
 * @openapi
 * /onboarding/create-tenant:
 *   post:
 *     tags: [Onboarding]
 *     summary: Step 7 — run automatic provisioning and return a ready-to-use login session
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId, subdomain]
 *             properties: { sessionId: { type: string, format: uuid }, subdomain: { type: string, example: goldgym } }
 *     responses:
 *       201: { description: "{ tenantId, slug, portalUrl, userId, accessToken, refreshToken }" }
 *       409: { description: "Subdomain taken, or a prior step wasn't completed" }
 */
onboardingRouter.post(
  '/create-tenant',
  validate({ body: createTenantSchema }),
  asyncHandler(onboardingController.createTenant.bind(onboardingController)),
);

/**
 * @openapi
 * /onboarding/status:
 *   get:
 *     tags: [Onboarding]
 *     summary: Poll the current wizard step for a session (resume after redirect, e.g. from a payment gateway)
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: "{ step, emailVerified, planSlug, provisionedSlug }" }
 *       410: { description: Session expired or not found }
 */
onboardingRouter.get(
  '/status',
  validate({ query: onboardingStatusSchema }),
  asyncHandler(onboardingController.status.bind(onboardingController)),
);
