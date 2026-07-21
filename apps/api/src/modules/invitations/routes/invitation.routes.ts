import { Router } from 'express';

import { createRateLimiter } from '../../../core/middleware/rate-limiter';
import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { invitationController } from '../controllers/invitation.controller';
import {
  acceptInvitationSchema,
  createInvitationSchema,
  invitationIdParamSchema,
  listInvitationsQuerySchema,
  lookupInvitationQuerySchema,
} from '../validators/invitation.validators';

export const invitationRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

const acceptRateLimiter = () => createRateLimiter({ windowMs: 15 * 60_000, max: 10, prefix: 'invite-accept' });

// ── Public (token is the credential) ──────────────────────────────────────

/**
 * @openapi
 * /invitations/lookup:
 *   get:
 *     tags: [Invitations]
 *     summary: Resolve an invitation token (public — shown on the accept page)
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "{ email, roleName, invitedBy, expiresAt }" }
 *       410: { description: Invalid or expired invitation }
 */
invitationRouter.get(
  '/lookup',
  validate({ query: lookupInvitationQuerySchema }),
  asyncHandler(invitationController.lookup.bind(invitationController)),
);

/**
 * @openapi
 * /invitations/accept:
 *   post:
 *     tags: [Invitations]
 *     summary: Accept an invitation — creates the staff account (public)
 *     responses:
 *       201: { description: Account created }
 *       410: { description: Invalid or expired invitation }
 */
invitationRouter.post(
  '/accept',
  acceptRateLimiter(),
  validate({ body: acceptInvitationSchema }),
  asyncHandler(invitationController.accept.bind(invitationController)),
);

// ── Staff-facing management ───────────────────────────────────────────────

/**
 * @openapi
 * /invitations:
 *   get:
 *     tags: [Invitations]
 *     summary: List invitations (filter by status)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated invitations }
 *   post:
 *     tags: [Invitations]
 *     summary: Invite a staff member (emails a tokenized accept link)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Invitation sent }
 *       409: { description: Email already registered or already invited }
 */
invitationRouter.get(
  '/',
  authenticateMiddleware,
  requirePermission('users:invite'),
  validate({ query: listInvitationsQuerySchema }),
  asyncHandler(invitationController.list.bind(invitationController)),
);
invitationRouter.post(
  '/',
  authenticateMiddleware,
  requirePermission('users:invite'),
  validate({ body: createInvitationSchema }),
  asyncHandler(invitationController.create.bind(invitationController)),
);

/** @openapi { "/invitations/{invitationId}/resend": { post: { tags: [Invitations], summary: Re-issue the invite with a fresh token/expiry, security: [{bearerAuth: []}], responses: { 200: { description: Resent } } } } } */
invitationRouter.post(
  '/:invitationId/resend',
  authenticateMiddleware,
  requirePermission('users:invite'),
  validate({ params: invitationIdParamSchema }),
  asyncHandler(invitationController.resend.bind(invitationController)),
);

/** @openapi { "/invitations/{invitationId}": { delete: { tags: [Invitations], summary: Revoke a pending invitation, security: [{bearerAuth: []}], responses: { 200: { description: Revoked } } } } } */
invitationRouter.delete(
  '/:invitationId',
  authenticateMiddleware,
  requirePermission('users:invite'),
  validate({ params: invitationIdParamSchema }),
  asyncHandler(invitationController.revoke.bind(invitationController)),
);
