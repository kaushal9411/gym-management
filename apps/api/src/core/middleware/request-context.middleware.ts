import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

import { runWithRequestContext } from '../logging/request-context';

/**
 * First middleware in the chain — assigns a request id (propagated as
 * X-Request-Id and echoed in every response envelope) and opens the
 * AsyncLocalStorage context that logging/tenant/auth middleware enrich.
 */
export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string | undefined) || randomUUID();
  res.setHeader('X-Request-Id', requestId);

  runWithRequestContext(
    {
      requestId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
    () => next(),
  );
}
