import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { classBookingController } from '../controllers/class-booking.controller';
import { createBookingSchema, idParamSchema } from '../validators/classes.validators';

export const classBookingRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

classBookingRouter.use(authenticateMiddleware);

// Staff/front-desk booking any member into any session — the member
// portal's own self-booking lives at `/portal/classes/*` (modules/member-portal),
// a completely separate, non-RBAC route (see that module's own router).
classBookingRouter.post('/', requirePermission('bookings:manage'), validate({ body: createBookingSchema }), asyncHandler(classBookingController.create.bind(classBookingController)));
classBookingRouter.post('/:id/cancel', requirePermission('bookings:manage'), validate({ params: idParamSchema }), asyncHandler(classBookingController.cancel.bind(classBookingController)));
