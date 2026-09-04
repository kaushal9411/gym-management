import { Router } from 'express';

import { NotFoundError } from '../../../core/errors/app-error';
import { sendSuccess } from '../../../core/http/response';
import { adminAppReleaseService } from '../services/admin-app-release.service';

export const publicAppReleaseRouter: Router = Router();

/**
 * No auth at all, deliberately — "any user can download and install" means
 * staff, members, and someone who hasn't signed up yet all need to reach
 * this without already having a session in one specific auth plane (staff
 * JWT / member JWT / admin JWT are three separate things elsewhere in this
 * codebase). An APK binary has no privacy concern the way a member document
 * does, so this mirrors the existing `/public/tenants` precedent rather
 * than requiring auth.
 */

/** @openapi { "/public/app-releases/latest": { get: { tags: [Authentication], summary: "The current active Android app release's metadata (version, notes, size, direct file URL) — no auth required", responses: { 200: { description: AppRelease }, 404: { description: No release published yet } } } } } */
publicAppReleaseRouter.get('/latest', async (_req, res, next) => {
  try {
    const release = await adminAppReleaseService.getActive();
    if (!release) throw new NotFoundError('No app release has been published yet.');
    sendSuccess(res, release);
  } catch (error) {
    next(error);
  }
});
