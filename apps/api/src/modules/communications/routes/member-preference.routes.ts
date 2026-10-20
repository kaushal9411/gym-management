import type { Request, Response } from 'express';
import { Router } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { createRateLimiter } from '../../../core/middleware/rate-limiter';
import { validate } from '../../../core/middleware/validate.middleware';
import { MemberPreferenceService } from '../services/member-preference.service';
import { memberPreferencesSchema, type MemberPreferencesInput } from '../validators/communications.validators';

/**
 * Mounted by the member-portal router at `/portal/notification-preferences` - it inherits that router's
 * `memberAuthenticateMiddleware`, so `req.memberAuth` is always set here and the member id never comes from the request.
 */
export const memberPreferenceRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

const writeLimiter = () =>
  createRateLimiter({
    windowMs: 15 * 60_000,
    max: 30,
    prefix: 'member-notification-prefs',
    keyGenerator: (req) => `${req.tenant?.id ?? 'platform'}:${req.memberAuth?.sub ?? req.ip}`,
  });

/**
 * @openapi
 * /portal/notification-preferences:
 *   get:
 *     tags: [Member Portal]
 *     summary: Own promotional opt-out per channel, plus the reminder categories that can never be switched off
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ channels: [{channel, label, promotionalOptOut}], nonBlockable: [{key,label}], note }" }
 *   put:
 *     tags: [Member Portal]
 *     summary: Set promotional opt-out for one or more channels (PUSH, EMAIL, SMS, WHATSAPP)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [channels], properties: { channels: { type: array, items: { type: object, required: [channel, promotionalOptOut], properties: { channel: { type: string, enum: [PUSH, EMAIL, SMS, WHATSAPP] }, promotionalOptOut: { type: boolean } } } } } }
 *     responses:
 *       200: { description: Updated preferences (same shape as GET) }
 *       422: { description: Validation error }
 */
memberPreferenceRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await new MemberPreferenceService(req.tenant!.id).get(req.memberAuth!.sub));
  }),
);

memberPreferenceRouter.put(
  '/',
  writeLimiter(),
  validate({ body: memberPreferencesSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await new MemberPreferenceService(req.tenant!.id).put(req.memberAuth!.sub, req.body as MemberPreferencesInput, { ipAddress: req.ip, userAgent: req.get('user-agent') });
    sendSuccess(res, result, 'Notification preferences saved.');
  }),
);
