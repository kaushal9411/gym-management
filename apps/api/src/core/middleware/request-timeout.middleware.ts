import type { NextFunction, Request, Response } from 'express';

import { RequestTimeoutError } from '../errors/app-error';

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Global Loading & Performance Optimization (Prompt 23) — a safety net for
 * requests that hang (a stuck DB query, a deadlock, an external call with
 * no timeout of its own), so a client never waits forever even if it
 * ignores its own client-side timeout. Independent of tenant-web's axios
 * client timeout (15s) — that one fails fast from the browser's
 * perspective; this one protects the server itself and is set higher so it
 * only ever fires for requests that are genuinely stuck, not merely slow.
 * Does not touch any request/response body or business logic — purely a
 * ceiling on how long a handler is allowed to run before the connection is
 * cut with a clean, typed error instead of hanging indefinitely.
 */
export function requestTimeoutMiddleware(timeoutMs: number = DEFAULT_TIMEOUT_MS) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timer = setTimeout(() => {
      if (!res.headersSent) next(new RequestTimeoutError());
    }, timeoutMs);
    timer.unref?.();

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));
    next();
  };
}
