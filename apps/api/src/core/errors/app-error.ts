import { ErrorCode, type ErrorCodeValue } from './error-codes';

/**
 * Base class for every expected/handled error. The global error middleware
 * maps this to RFC 7807 problem+json; anything NOT an AppError is treated
 * as an unexpected 500 and its details are never leaked to the client.
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCodeValue,
    message: string,
    public readonly httpStatus: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Request validation failed', details?: Record<string, unknown>) {
    super(ErrorCode.VALIDATION_ERROR, message, 422, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(ErrorCode.NOT_FOUND, message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(code: ErrorCodeValue, message: string) {
    super(code, message, 409);
  }
}

export class RateLimitedError extends AppError {
  constructor(message = 'Too many requests. Please try again later.') {
    super(ErrorCode.RATE_LIMITED, message, 429);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(code: ErrorCodeValue = ErrorCode.UNAUTHENTICATED, message = 'Authentication required') {
    super(code, message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You don't have permission to perform this action") {
    super(ErrorCode.FORBIDDEN, message, 403);
  }
}

export class TenantError extends AppError {
  constructor(code: ErrorCodeValue, message: string, httpStatus: number) {
    super(code, message, httpStatus);
  }
}
