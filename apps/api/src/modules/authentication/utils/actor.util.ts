import type { Request } from 'express';

/** Who performed an IAM action — threaded into every audit-log record. */
export interface IamActor {
  userId: string;
  role: string;
  ipAddress?: string;
  userAgent?: string;
}

/** Requires authenticateMiddleware to have run (req.auth present). */
export function actorFrom(req: Request): IamActor {
  return {
    userId: req.auth!.sub,
    role: req.auth!.role,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };
}
