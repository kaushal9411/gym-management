import type { NextFunction, Request, Response } from 'express';

import { AppError, ValidationError } from '../errors/app-error';
import { ErrorCode } from '../errors/error-codes';
import { sendError, type ApiResponseBody } from '../http/response';
import { logger } from '../logging/logger';

/**
 * Single global error handler. AppError instances map to their declared
 * status/code; anything else is an unexpected 500 — logged in full, but
 * the client only ever sees a generic message (never a stack trace or SQL).
 */
export function errorHandlerMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by Express to be recognized as an error handler
  next: NextFunction,
): void {
  if (err instanceof AppError) {
    if (err.httpStatus >= 500) {
      logger.error(err.message, { code: err.code, stack: err.stack, details: err.details });
    }

    let errors: ApiResponseBody['errors'] = [{ code: err.code, message: err.message }];
    if (err instanceof ValidationError && Array.isArray(err.details?.fields)) {
      errors = (err.details.fields as Array<{ field: string; message: string }>).map((f) => ({
        field: f.field,
        code: err.code,
        message: f.message,
      }));
    }

    sendError(res, err.httpStatus, err.message, errors);
    return;
  }

  logger.error('Unhandled error', {
    message: (err as Error)?.message,
    stack: (err as Error)?.stack,
    path: req.originalUrl,
  });
  sendError(res, 500, 'Something went wrong. Please try again.', [
    { code: ErrorCode.INTERNAL_ERROR, message: 'Internal server error' },
  ]);
}

export function notFoundMiddleware(req: Request, res: Response): void {
  sendError(res, 404, `Route not found: ${req.method} ${req.originalUrl}`, [
    { code: ErrorCode.NOT_FOUND, message: 'Route not found' },
  ]);
}
