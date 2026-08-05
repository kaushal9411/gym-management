import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { memberAuthenticateMiddleware } from '../../member-auth/middlewares/member-authenticate.middleware';
import { memberPortalController } from '../controllers/member-portal.controller';
import {
  memberDietLogSchema,
  memberPortalClassesQuerySchema,
  memberPortalIdParamSchema,
  memberPortalPaginationSchema,
  memberWorkoutProgressSchema,
} from '../validators/member-portal.validators';

export const memberPortalRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

// Router-level gate — every route below requires a valid member-audience
// token, same "one line covers the whole module" pattern as the AI
// assistant module's `requirePermission('ai:use')` at router level. No
// permission-key catalog entries needed — the member auth plane has no RBAC.
memberPortalRouter.use(memberAuthenticateMiddleware);

memberPortalRouter.get('/me', asyncHandler(memberPortalController.me.bind(memberPortalController)));
memberPortalRouter.get('/gdpr-export', asyncHandler(memberPortalController.gdprExport.bind(memberPortalController)));

memberPortalRouter.get('/attendance', validate({ query: memberPortalPaginationSchema }), asyncHandler(memberPortalController.attendance.bind(memberPortalController)));

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

memberPortalRouter.get('/invoices', validate({ query: memberPortalPaginationSchema }), asyncHandler(memberPortalController.invoices.bind(memberPortalController)));
memberPortalRouter.get(
  '/invoices/:id/download',
  validate({ params: memberPortalIdParamSchema }),
  asyncHandler(memberPortalController.downloadInvoice.bind(memberPortalController)),
);

memberPortalRouter.get('/classes', validate({ query: memberPortalClassesQuerySchema }), asyncHandler(memberPortalController.classes.bind(memberPortalController)));
memberPortalRouter.get('/bookings', asyncHandler(memberPortalController.myBookings.bind(memberPortalController)));
memberPortalRouter.post('/classes/:id/book', validate({ params: memberPortalIdParamSchema }), asyncHandler(memberPortalController.bookClass.bind(memberPortalController)));
memberPortalRouter.post('/bookings/:id/cancel', validate({ params: memberPortalIdParamSchema }), asyncHandler(memberPortalController.cancelBooking.bind(memberPortalController)));
