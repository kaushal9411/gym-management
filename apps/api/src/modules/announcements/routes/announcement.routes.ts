import { Router } from 'express';

import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { announcementController } from '../controllers/announcement.controller';

export const announcementRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

/**
 * @openapi
 * /announcements/active:
 *   get:
 *     tags: [Announcements]
 *     summary: Active announcements targeting the current tenant
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of active announcements }
 */
announcementRouter.get('/active', authenticateMiddleware, asyncHandler(announcementController.listActive.bind(announcementController)));
