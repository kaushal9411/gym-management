import type { NextFunction, Request, Response } from 'express';

import { ForbiddenError } from '../../../core/errors/app-error';

/**
 * Plan-gated feature flags (e.g. `chat`, `custom_roles`, `api_access`) live
 * on `saas_plans.features` per the platform architecture — a table that is
 * explicitly OUT OF SCOPE for this authentication-only phase (no
 * subscriptions/plans tables were requested here). This middleware is the
 * real, reusable gate the Subscriptions module will complete by attaching
 * a `features: Record<string, boolean>` map to `req.tenant` once that
 * table exists; today it only prevents accidental use before that data
 * exists, rather than pretending to enforce a feature list that doesn't.
 */
export function requireFeature(featureKey: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const features = (req.tenant as { features?: Record<string, boolean> } | null | undefined)?.features;

    if (!features) {
      next(
        new ForbiddenError(
          `Feature "${featureKey}" cannot be evaluated yet — plan/feature data is added by the Subscriptions module`,
        ),
      );
      return;
    }
    if (!features[featureKey]) {
      next(new ForbiddenError(`Your plan does not include the "${featureKey}" feature`));
      return;
    }
    next();
  };
}
