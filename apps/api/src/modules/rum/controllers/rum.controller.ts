import type { Request, Response } from 'express';

import { logger } from '../../../core/logging/logger';
import type { ReportWebVitalInput } from '../validators/rum.validators';

/**
 * Real-user-monitoring sink — no vendor lock-in (no Vercel Analytics/Speed
 * Insights, since this app doesn't assume Vercel hosting). Web Vitals land
 * as structured log lines through the same Winston pipeline as everything
 * else; point a log-based dashboard/alert at `event: 'web-vital'` when
 * there's real traffic to look at. `sendBeacon` delivery means this can
 * fire after the user has already navigated away, so it deliberately does
 * as little work as possible and never touches the DB.
 */
export class RumController {
  async report(req: Request, res: Response): Promise<void> {
    const metric = req.body as ReportWebVitalInput;
    logger.info('web-vital', { event: 'web-vital', ...metric });
    res.status(204).end();
  }
}

export const rumController = new RumController();
