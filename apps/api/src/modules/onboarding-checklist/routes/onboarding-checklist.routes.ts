import { Router } from 'express';

import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { onboardingChecklistController } from '../controllers/onboarding-checklist.controller';

export const onboardingChecklistRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

onboardingChecklistRouter.use(authenticateMiddleware);

// Gated on settings:read (Owner/Manager only, same as Gym Settings itself)
// — every item on the checklist is something only they can act on
// (branding, profile, staff invites, plan/branch setup), so there's no
// value showing it to Trainer/Receptionist and no new permission key needed.
/** @openapi { "/onboarding-checklist": { get: { tags: [Onboarding Checklist], summary: "Get your gym set up™ dashboard widget status — auto-detected from real data", security: [{bearerAuth: []}], responses: { 200: { description: "{ items, completedCount, totalCount, dismissed }" } } } } } */
onboardingChecklistRouter.get('/', requirePermission('settings:read'), asyncHandler(onboardingChecklistController.getStatus.bind(onboardingChecklistController)));

/** @openapi { "/onboarding-checklist/dismiss": { post: { tags: [Onboarding Checklist], summary: Permanently dismiss the checklist widget, security: [{bearerAuth: []}], responses: { 200: { description: Dismissed } } } } } */
onboardingChecklistRouter.post('/dismiss', requirePermission('settings:read'), asyncHandler(onboardingChecklistController.dismiss.bind(onboardingChecklistController)));
